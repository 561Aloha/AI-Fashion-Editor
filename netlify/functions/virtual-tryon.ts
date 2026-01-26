// netlify/functions/virtual-tryon.ts
import type { Handler } from '@netlify/functions';
import { Client, handle_file } from '@gradio/client';

type Body = {
  personImage: string;       // base64 OR data URL
  garmentImage: string;      // base64 OR data URL
  prompt?: string;
  denoiseSteps?: number;     // optional: lets you tune speed/quality from client
  seed?: number;
  crop?: boolean;
};

function toDataUrl(input: string, fallbackMime = 'image/png') {
  if (!input) return '';
  if (input.startsWith('data:image/')) return input;
  return `data:${fallbackMime};base64,${input}`;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(',');
  const mime = header.match(/data:(.*?);base64/)?.[1] ?? 'image/png';
  const bytes = Buffer.from(b64, 'base64');
  return new Blob([bytes], { type: mime });
}

function buildGarmentDes(userPrompt?: string) {
  const p = (userPrompt ?? '').trim().toLowerCase();
  const isJeans = /\bjeans?\b|\bdenim\b/.test(p) && !/\bjacket\b/.test(p);
  const isSkirt = /\bskirt\b/.test(p);
  const isShorts = /\bshorts?\b/.test(p);
  const isPants = /\bpants\b|\btrousers\b/.test(p);

  // Prioritize garment design over body mask
  const priorityOverride = "The garment's designed length takes priority over the model's silhouette. Generate missing fabric/pixels if needed.";

  let constraints = 'Preserve garment identity, silhouette, length, seams, and texture. Photorealistic.';

  if (isJeans) {
    constraints = `Full-length denim jeans extending to ankles. ${priorityOverride} Preserve denim wash, detailed seams, whiskering, pockets, and hem. Photorealistic.`;
  } else if (isSkirt) {
    constraints = `Skirt with designed length preserved. ${priorityOverride} Keep pleats/shape, fabric texture, seams, and hem. Photorealistic.`;
  } else if (isShorts) {
    constraints = `Shorts with designed inseam length. ${priorityOverride} Preserve fit, seams, and hem. Photorealistic.`;
  } else if (isPants) {
    constraints = `Pants with full length. ${priorityOverride} Preserve length, fit, seams, and fabric texture. Photorealistic.`;
  }

  const ignoreExtras = 'Use only the clothing item; ignore any mannequin/body/hands/background in the garment image.';
  const negative = 'Do not change garment category. Do not invent extra straps/cuts.';

  const prefix = userPrompt?.trim() ? `${userPrompt.trim()}. ` : '';
  const finalPrompt = `${negative} ${constraints} ${prefix}${ignoreExtras}`.slice(0, 1000);

  return finalPrompt;
}

// ---- Reuse Gradio client on warm invocations ----
let cachedClient: any | null = null;
async function getClient() {
  if (cachedClient) return cachedClient;

  const token = process.env.HF_TOKEN;
  cachedClient = await Client.connect('yisol/IDM-VTON', {
    headers: token
      ? { Authorization: `Bearer ${token}`, 'X-HF-Token': token }
      : undefined,
  } as any);

  return cachedClient;
}

// Simple timeout wrapper so you fail fast with a clear message
async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(t!);
  }
}

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const body = JSON.parse(event.body || '{}') as Body;
    const { personImage, garmentImage, prompt } = body;

    const person = toDataUrl(personImage, 'image/png');
    const garment = toDataUrl(garmentImage, 'image/png');

    if (!person || !garment) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'personImage and garmentImage are required.' }),
      };
    }

    const denoiseSteps = Math.max(6, Math.min(30, body.denoiseSteps ?? 20));
    const seed = Number.isFinite(body.seed) ? (body.seed as number) : 42;
    const crop = body.crop ?? true;

    const client = await getClient();

    const humanFile = await handle_file(dataUrlToBlob(person));
    const garmFile = await handle_file(dataUrlToBlob(garment));
    const garment_des = buildGarmentDes(prompt);

    // HF can queue; give it enough time in dev (but still bounded)
    const result = await withTimeout(
      client.predict('/tryon', {
        dict: { background: humanFile, layers: [], composite: null },
        garm_img: garmFile,
        garment_des,
        is_checked: true,
        is_checked_crop: crop,
        denoise_steps: denoiseSteps,
        seed,
      }),
      110_000,
      'IDM-VTON /tryon'
    );

    const out = (result as any)?.data?.[0];
    const outUrl = typeof out === 'string' ? out : out?.url;

    if (!outUrl) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'No output URL returned from IDM-VTON', raw: result }),
      };
    }

    // Download output image and convert to base64
    const imgRes = await withTimeout(fetch(outUrl), 30_000, 'Downloading output image');
    if (!imgRes.ok) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: `Failed to download output image: ${imgRes.status}` }),
      };
    }

    const arrayBuf = await imgRes.arrayBuffer();
    const base64 = Buffer.from(arrayBuf).toString('base64');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64 }),
    };
  } catch (err: any) {
    // If Gradio client got into a bad state, force reconnect next time
    cachedClient = null;

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: err?.message || 'Unknown error',
      }),
    };
  }
};
