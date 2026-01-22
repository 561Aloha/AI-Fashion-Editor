import type { Handler } from "@netlify/functions";
import { Client } from "@gradio/client";

const SPACE_ID = "yisol/IDM-VTON";

let cachedClient: any = null;
let cachedToken: string | null = null;

function isHfToken(x: string): x is `hf_${string}` {
  return typeof x === "string" && x.startsWith("hf_") && x.length > 10;
}

function resetClientIfTokenChanged(token: string) {
  if (cachedClient && cachedToken && cachedToken !== token) {
    cachedClient = null;
  }
  cachedToken = token;
}

function toDataUrl(b64OrDataUrl: string) {
  return b64OrDataUrl.includes("base64,")
    ? b64OrDataUrl
    : `data:image/png;base64,${b64OrDataUrl}`;
}

/**
 * Convert a data URL (data:image/...;base64,xxxx) to a Node Buffer
 */
function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; mime: string } {
  const match = dataUrl.match(/^data:(.+);base64,(.*)$/);
  if (!match) throw new Error("Invalid data URL format.");
  const mime = match[1];
  const b64 = match[2];
  return { buffer: Buffer.from(b64, "base64"), mime };
}

export const handler: Handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Use POST." }) };
  }

  try {
    const hfRaw = (process.env.HF_API_KEY || "").trim();
    if (!hfRaw) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Missing HF_API_KEY." }) };
    }
    if (!isHfToken(hfRaw)) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "HF_API_KEY must start with hf_." }),
      };
    }

    resetClientIfTokenChanged(hfRaw);

    const body = JSON.parse(event.body || "{}");
    const { personImage, garmentImage, garmentDescription } = body;

    if (!personImage || !garmentImage) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing personImage or garmentImage." }),
      };
    }

    // Connect once
    if (!cachedClient) {
      const hfToken: `hf_${string}` = hfRaw;
      cachedClient = await Client.connect(SPACE_ID, { token: hfToken });

      // Optional debug once
      const apiInfo = await cachedClient.view_api();
      console.log("[virtual-tryon] view_api:", JSON.stringify(apiInfo, null, 2));
    }

    // Convert incoming base64/dataURLs to Buffers (Gradio accepts Buffer for Image inputs)
    const personDataUrl = toDataUrl(personImage);
    const garmentDataUrl = toDataUrl(garmentImage);

    const { buffer: personBuf } = dataUrlToBuffer(personDataUrl);
    const { buffer: garmentBuf } = dataUrlToBuffer(garmentDataUrl);

    /**
     * IMPORTANT: view_api shows ONLY endpoint: "/tryon"
     * Parameters order:
     * 1) Imageeditor dict: { background, layers, composite }
     * 2) Garment image
     * 3) garment_des (string)
     * 4) is_checked (boolean, default true)
     * 5) is_checked_crop (boolean, default false)
     * 6) denoise_steps (number, default 30)
     * 7) seed (number, default 42)
     */
    const humanImageEditorValue = {
      background: personBuf, // background image
      layers: [],            // no mask layers provided
      composite: null,       // none
    };

    const inputs = [
      humanImageEditorValue,
      garmentBuf,
      garmentDescription ?? "", // you can pass your prompt here if you want
      true,  // is_checked (default true)
      false, // is_checked_crop (default false)
      20,    // denoise_steps (default 30)
      42,    // seed (default 42)
    ];

    // Call correct endpoint
    const result = await cachedClient.predict("/tryon", inputs);

    console.log("[virtual-tryon] result:", JSON.stringify(result, null, 2));

    // Returns show two outputs (Output, Masked image output).
    // Often these come back as a filepath string or a data URL or an object with url.
    const output0 = result?.data?.[0];

    if (typeof output0 === "string") {
      // If it's already a data URL:
      if (output0.startsWith("data:image")) {
        const base64 = output0.split(",")[1];
        return { statusCode: 200, headers, body: JSON.stringify({ imageBase64: base64 }) };
      }

      // If it's a URL or filepath-like string:
      if (output0.startsWith("http")) {
        return { statusCode: 200, headers, body: JSON.stringify({ imageUrl: output0 }) };
      }

      // Some gradio outputs are file paths; return raw so you can inspect
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ imagePath: output0, raw: result }),
      };
    }

    if (output0?.url) {
      return { statusCode: 200, headers, body: JSON.stringify({ imageUrl: output0.url }) };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Unexpected response format from Space", raw: result }),
    };
  } catch (err: any) {
    console.error("[virtual-tryon] Error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err?.message || "Server error", details: String(err?.stack || "") }),
    };
  }
};
