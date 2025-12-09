// src/components/huggingfaceVirtualTryOn.ts
import type { Base64Image } from '../types';

export async function compositeClothingItems(clothingB64Array: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    if (clothingB64Array.length === 0) {
      reject(new Error('No clothing items to composite'));
      return;
    }
    if (clothingB64Array.length === 1) {
      resolve(clothingB64Array[0]);
      return;
    }

    const images: HTMLImageElement[] = [];
    let loadedCount = 0;

    clothingB64Array.slice(0, 2).forEach((b64, index) => {
      const img = new Image();
      img.onload = () => {
        images[index] = img;
        loadedCount++;

        if (loadedCount === 2) {
          try {
            const maxWidth = Math.max(images[0].width, images[1].width);
            const maxHeight = Math.max(images[0].height, images[1].height);

            const canvas = document.createElement('canvas');
            canvas.width = maxWidth;
            canvas.height = maxHeight;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Could not get canvas context'));
              return;
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const halfH = maxHeight / 2;

            // Draw TOP into upper half (scaled to fit)
            {
              const top = images[0];
              const scale = Math.min(maxWidth / top.width, halfH / top.height);
              const dw = top.width * scale;
              const dh = top.height * scale;
              const dx = (maxWidth - dw) / 2;
              const dy = (halfH - dh) / 2;
              ctx.drawImage(top, dx, dy, dw, dh);
            }

            // Draw BOTTOM into lower half (scaled to fit)
            {
              const bottom = images[1];
              const scale = Math.min(maxWidth / bottom.width, halfH / bottom.height);
              const dw = bottom.width * scale;
              const dh = bottom.height * scale;
              const dx = (maxWidth - dw) / 2;
              const dy = halfH + (halfH - dh) / 2;
              ctx.drawImage(bottom, dx, dy, dw, dh);
            }

            // PNG keeps transparency if present
            const compositeDataUrl = canvas.toDataURL('image/png');
            resolve(compositeDataUrl.split(',')[1]);
          } catch (err) {
            reject(err);
          }
        }
      };

      img.onerror = () => reject(new Error(`Failed to load clothing image ${index}`));

      const dataUrl = b64.startsWith('data:image') ? b64 : `data:image/png;base64,${b64}`;
      img.src = dataUrl;
    });
  });
}

function extractBase64FromData(data: unknown): string | null {
  if (!data) return null;

  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return extractBase64FromData(JSON.parse(trimmed));
      } catch {
        // fall through
      }
    }
    return trimmed;
  }

  if (Array.isArray(data)) {
    for (const item of data) {
      const found = extractBase64FromData(item);
      if (found) return found;
    }
    return null;
  }

  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const preferredKeys = ['imageBase64', 'image_base64', 'image', 'output', 'result', 'body', 'data', 'response'];

    for (const key of preferredKeys) {
      if (key in obj) {
        const found = extractBase64FromData(obj[key]);
        if (found) return found;
      }
    }

    for (const key of Object.keys(obj)) {
      const found = extractBase64FromData(obj[key]);
      if (found) return found;
    }
  }

  return null;
}

async function applyVirtualTryOnViaBackend(
  personImageB64: string,
  garmentImageB64: string,
  prompt?: string,
  opts?: {
    denoiseSteps?: number;
    crop?: boolean;
    seed?: number;
  }
): Promise<string> {
  const response = await fetch('/.netlify/functions/virtual-tryon', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personImage: personImageB64.includes('base64,')
        ? personImageB64
        : `data:image/png;base64,${personImageB64}`,
      garmentImage: garmentImageB64.includes('base64,')
        ? garmentImageB64
        : `data:image/png;base64,${garmentImageB64}`,
      prompt,
      denoiseSteps: opts?.denoiseSteps,
      crop: opts?.crop,
      seed: opts?.seed,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    let msg = `HTTP ${response.status}`;
    try {
      msg = (JSON.parse(text) as any).error || msg;
    } catch {
      if (text) msg = text;
    }
    throw new Error(`Virtual try-on failed: ${msg}`);
  }

  const text = await response.text();

  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    // keep as string
  }

  const base64 = extractBase64FromData(data);
  if (!base64) {
    throw new Error(
      'Virtual try-on backend did not return a recognizable base64 field.'
    );
  }

  return base64;
}

export async function generateVirtualTryOnHybrid(
  modelImageB64: string,
  clothingImages: Base64Image[],
  prompt: string
): Promise<string> {
  const garmentB64s = clothingImages
    .map((c) => c?.base64)
    .filter(Boolean) as string[];

  if (garmentB64s.length === 0) {
    throw new Error('No clothing images provided.');
  }

  // One composite garment (top upper half, bottom lower half)
  const compositeGarmentB64 =
    garmentB64s.length === 1 ? garmentB64s[0] : await compositeClothingItems(garmentB64s);

  // Single inference call
  return await applyVirtualTryOnViaBackend(
    modelImageB64,
    compositeGarmentB64,
    prompt
  );
}

