import type { Base64Image } from "../types";

/**
 * IMPORTANT:
 * - In local dev, Netlify Functions are served by `netlify dev` (default: http://localhost:8888)
 * - If you use Vite alone, "/.netlify/functions/*" won't work reliably.
 *
 * This file fixes "Failed to fetch" by:
 * 1) Using an explicit Netlify dev endpoint in DEV
 * 2) Guarding against huge payloads that can crash the dev server (ERR_EMPTY_RESPONSE)
 */

const getFunctionEndpoint = () => {
  // If you set a custom port in netlify dev, change it here
  const devBase = "http://localhost:8888";
  return import.meta.env.DEV
    ? `${devBase}/.netlify/functions/virtual-tryon`
    : "/.netlify/functions/virtual-tryon";
};

const toDataUrl = (b64OrDataUrl: string) => {
  return b64OrDataUrl.includes("base64,")
    ? b64OrDataUrl
    : `data:image/png;base64,${b64OrDataUrl}`;
};

export const generateVirtualTryOnHybrid = async (
  modelImageB64: string,
  clothingImages: Base64Image[],
  prompt: string // currently unused, but kept for your pipeline
): Promise<string> => {
  try {
    console.log("[HF] Starting virtual try-on generation...");

    // Step 1: Extract base64 strings (no background removal needed)
    const processedClothing = clothingImages.map((clothing) => clothing.base64);

    // Step 2: Composite clothing items (client-side)
    console.log("[HF] Compositing clothing items...");
    const compositeClothing = await compositeClothingItems(processedClothing);

    // Step 3: Call Netlify function
    console.log("[HF] Applying virtual try-on...");
    const result = await applyVirtualTryOnViaBackend(modelImageB64, compositeClothing);

    console.log("[HF] Generation successful");
    return result;
  } catch (error: any) {
    console.error("[HF] Error in virtual try-on:", error?.message || error);
    throw error;
  }
};

const applyVirtualTryOnViaBackend = async (
  personImageB64: string,
  garmentImageB64: string
): Promise<string> => {
  try {
    const endpoint = getFunctionEndpoint();

    const payload = {
      personImage: toDataUrl(personImageB64),
      garmentImage: toDataUrl(garmentImageB64),
    };

    // Payload size guard (prevents dev server crash → ERR_EMPTY_RESPONSE)
    const bytes = new Blob([JSON.stringify(payload)]).size;
    console.log(`[applyVirtualTryOnViaBackend] payload bytes: ${bytes}`);

    // ~6MB is already big for JSON; adjust as needed
    if (bytes > 6_000_000) {
      throw new Error(
        `Payload too large (${(bytes / 1024 / 1024).toFixed(
          2
        )}MB). Compress images or switch to URL-based upload.`
      );
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(`Virtual try-on failed: ${error.error || response.status}`);
    }

    const data = await response.json();

    // Handle both base64 and url return formats
    if (data.imageBase64) return data.imageBase64;
    if (data.imageUrl) return data.imageUrl;

    throw new Error("Virtual try-on returned no imageBase64 or imageUrl");
  } catch (error: any) {
    console.error("[applyVirtualTryOnViaBackend] Error:", error.message || error);
    throw error;
  }
};

// Composite multiple clothing items into a single image (client-side)
// Top item goes on top half, bottom item goes on bottom half
const compositeClothingItems = async (clothingB64Array: string[]): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (clothingB64Array.length === 0) {
      reject(new Error("No clothing items to composite"));
      return;
    }

    // If only one item, return it as-is
    if (clothingB64Array.length === 1) {
      resolve(clothingB64Array[0]);
      return;
    }

    const images: HTMLImageElement[] = [];
    let loadedCount = 0;

    clothingB64Array.forEach((b64, index) => {
      const img = new Image();

      img.onload = () => {
        images[index] = img;
        loadedCount++;

        if (loadedCount === clothingB64Array.length) {
          try {
            const maxWidth = Math.max(...images.map((im) => im.width));
            const maxHeight = Math.max(...images.map((im) => im.height));

            const canvas = document.createElement("canvas");
            canvas.width = maxWidth;
            canvas.height = maxHeight * 2;

            const ctx = canvas.getContext("2d");
            if (!ctx) {
              reject(new Error("Could not get canvas context"));
              return;
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw top (first image) in upper half
            if (images[0]) {
              const topX = (canvas.width - images[0].width) / 2;
              ctx.drawImage(images[0], topX, 0);
            }

            // Draw bottom (second image) in lower half
            if (images[1]) {
              const bottomX = (canvas.width - images[1].width) / 2;
              const bottomY = maxHeight;
              ctx.drawImage(images[1], bottomX, bottomY);
            }

            const compositeDataUrl = canvas.toDataURL("image/png");
            const base64 = compositeDataUrl.split(",")[1];
            resolve(base64);
          } catch (err) {
            reject(err);
          }
        }
      };

      img.onerror = () => reject(new Error(`Failed to load clothing image ${index}`));

      const dataUrl = b64.includes("data:image") ? b64 : `data:image/png;base64,${b64}`;
      img.src = dataUrl;
    });
  });
};
