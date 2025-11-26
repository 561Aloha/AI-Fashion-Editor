// netlify/functions/remove-bg.ts
import type { Handler, HandlerEvent, HandlerResponse } from '@netlify/functions';
import { client, handle_file } from '@gradio/client';

// Exact URL from the Space API docs
// https://huggingface.co/spaces/briaai/BRIA-RMBG-1.4
const SPACE_API_URL = "https://briaai-bria-rmbg-1-4.hf.space/--replicas/9gtsr/";
const SPACE_BASE_URL = "https://briaai-bria-rmbg-1-4.hf.space";

interface RemoveBgRequestBody {
  imageBase64?: string; // base64 WITHOUT data: prefix
}

interface RemoveBgResponseBody {
  processedBase64: string; // base64 WITHOUT prefix
}

export const handler: Handler = async (
  event: HandlerEvent
): Promise<HandlerResponse> => {
  try {
    // Only allow POST (your frontend uses POST)
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: { Allow: "POST" },
        body: "Method not allowed",
      };
    }

    if (!event.body) {
      return {
        statusCode: 400,
        body: "Missing body",
      };
    }

    let body: RemoveBgRequestBody;
    try {
      body = JSON.parse(event.body);
    } catch {
      return {
        statusCode: 400,
        body: "Invalid JSON",
      };
    }

    if (!body.imageBase64) {
      return {
        statusCode: 400,
        body: "imageBase64 is required",
      };
    }

    // Convert base64 from frontend into a Buffer so we can send it as a "file"
    const buffer = Buffer.from(body.imageBase64, "base64");

    // Connect to the BRIA Space
    const app = await client(SPACE_API_URL);

    // Call the Space's /predict endpoint
    const result = await app.predict("/predict", [handle_file(buffer)]);

    console.log("[remove-bg] Raw Space result:", JSON.stringify(result, null, 2));

    const out = (result as any)?.data?.[0];
    if (!out) {
      return {
        statusCode: 500,
        body: "Space returned no data",
      };
    }

    let processedBase64: string | null = null;

    // Case 1: Space returns a string (data URL or raw base64)
    if (typeof out === "string") {
      const parts = out.split(",");
      processedBase64 = parts.length === 2 ? parts[1] : out;
    }

    // Case 2: Space returns an object with a file path (your current case)
    else if (typeof out === "object" && out !== null) {
      let imageUrl: string | null = null;

      // If they ever start returning a direct URL, this will work too
      if (typeof (out as any).url === "string" && (out as any).url) {
        imageUrl = (out as any).url;
      } else if (typeof (out as any).path === "string" && (out as any).path) {
        const path = (out as any).path;
        // Build a public URL from the tmp path
        // Pattern: <space-base-url>/file=<path>
        imageUrl = `${SPACE_BASE_URL}/file=${encodeURIComponent(path)}`;
        console.log("[remove-bg] Built file URL from path:", imageUrl);
      }

      if (!imageUrl) {
        const msg =
          "Space returned an object with no usable url/path: " +
          JSON.stringify(out);
        console.error("[remove-bg]", msg);
        return {
          statusCode: 500,
          body: msg,
        };
      }

      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) {
        const text = await imgRes.text();
        console.error(
          "[remove-bg] Failed to fetch image from Space:",
          imgRes.status,
          text
        );
        return {
          statusCode: 500,
          body: `Failed to fetch image from Space: ${imgRes.status} ${text.slice(
            0,
            200
          )}`,
        };
      }

      const arrayBuffer = await imgRes.arrayBuffer();
      processedBase64 = Buffer.from(arrayBuffer).toString("base64");
    }

    if (!processedBase64) {
      return {
        statusCode: 500,
        body: "Could not determine processed image from Space output",
      };
    }

    const responseBody: RemoveBgResponseBody = { processedBase64 };

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(responseBody),
    };
  } catch (err) {
    console.error("[remove-bg] Error:", err);
    const message =
      err instanceof Error ? err.message : "Internal server error";

    return {
      statusCode: 500,
      body: message,
    };
  }
};
