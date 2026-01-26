// src/utils.ts
import { storage } from "./firebase";
import { ref, getBytes } from "firebase/storage";
import type { Base64Image } from "./types";

/**
 * Turn "data:image/png;base64,AAAA" into "AAAA"
 */
export function stripDataUrlHeader(dataUrlOrBase64: string): string {
  if (!dataUrlOrBase64) return "";
  const s = dataUrlOrBase64.trim();
  if (s.startsWith("data:image")) {
    const parts = s.split(",");
    return parts[1] ?? "";
  }
  return s;
}

/**
 * Turn Base64Image into a usable <img src="..."> data URL
 */
export function toDataUrl(img: Base64Image): string {
  const base64 = stripDataUrlHeader(img.base64);
  const mime = img.mimeType || "image/png";
  return `data:${mime};base64,${base64}`;
}

/**
 * Resize an image Blob in the browser and return a data URL.
 * - Use JPEG/WebP for photos (smaller).
 * - Use PNG if you must preserve transparency (garments).
 */
const resizeImage = (
  blob: Blob,
  maxWidth: number,
  maxHeight: number,
  opts?: { format?: "image/png" | "image/jpeg" | "image/webp"; quality?: number }
): Promise<string> => {
  const format = opts?.format ?? "image/jpeg";
  const quality = opts?.quality ?? 0.82;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      try {
        let width = img.width;
        let height = img.height;

        // scale down while keeping aspect ratio
        if (width > maxWidth || height > maxHeight) {
          const scale = Math.min(maxWidth / width, maxHeight / height);
          width = Math.max(1, Math.round(width * scale));
          height = Math.max(1, Math.round(height * scale));
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas context not available");

        // JPEG has no alpha; paint a background for model photos
        if (format === "image/jpeg") {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);
        }

        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl =
          format === "image/png"
            ? canvas.toDataURL("image/png")
            : format === "image/webp"
              ? canvas.toDataURL("image/webp", quality)
              : canvas.toDataURL("image/jpeg", quality);

        resolve(dataUrl);
      } catch (e) {
        reject(e);
      } finally {
        URL.revokeObjectURL(url);
      }
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };

    img.src = url;
  });
};

/**
 * Convert File, Blob, or base64 string to Base64Image.
 *
 * Notes:
 * - If input is a URL/path string, this throws (use urlToBase64Image instead).
 * - If input is already base64 (no data URL header), it returns it as PNG by default.
 */
export const fileToBase64Image = async (
  input: File | Blob | string,
  opts?: {
    maxWidth?: number;
    maxHeight?: number;
    format?: "image/png" | "image/jpeg" | "image/webp";
    quality?: number;
  }
): Promise<Base64Image> => {
  try {
    // If it's a string, treat it as base64 (or data URL), NOT a URL.
    if (typeof input === "string") {
      const s = input.trim();

      if (s.startsWith("http") || s.startsWith("/")) {
        throw new Error(
          "fileToBase64Image received a URL/path string; use urlToBase64Image instead."
        );
      }

      // Data URL → parse mime + base64
      if (s.startsWith("data:image")) {
        const header = s.split(",")[0] ?? "";
        const mimeType =
          header.match(/data:(.*?);base64/)?.[1] ?? "image/png";
        const base64 = stripDataUrlHeader(s);
        return { base64, mimeType: mimeType as Base64Image["mimeType"] };
      }

      // Raw base64 string
      return { base64: s, mimeType: "image/png" };
    }

    const maxWidth = opts?.maxWidth ?? 1024;
    const maxHeight = opts?.maxHeight ?? 1024;
    const format = opts?.format ?? "image/jpeg";
    const quality = opts?.quality ?? 0.82;

    const outMime: Base64Image["mimeType"] =
      format === "image/png"
        ? "image/png"
        : format === "image/webp"
          ? "image/webp"
          : "image/jpeg";

    // Try resizing first (fast + smaller output)
    try {
      const resizedDataUrl = await resizeImage(input, maxWidth, maxHeight, {
        format,
        quality,
      });
      const base64 = stripDataUrlHeader(resizedDataUrl);
      return { base64, mimeType: outMime };
    } catch (resizeError) {
      console.warn(
        "[fileToBase64Image] Resize failed, falling back to original",
        resizeError
      );

      // Fallback: convert without resizing
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(input);
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = stripDataUrlHeader(result);

          // Prefer File.type when available
          const mimeType =
            input instanceof File && input.type
              ? (input.type as Base64Image["mimeType"])
              : ("image/png" as const);

          resolve({ base64, mimeType });
        };
        reader.onerror = (error) => reject(error);
      });
    }
  } catch (e: any) {
    console.error("[fileToBase64Image] Error:", e?.message);
    throw e;
  }
};

/**
 * Load image from URL into Base64Image.
 * Supports Firebase Storage download URLs using the Storage SDK.
 *
 * kind:
 * - 'model'  : optimize for photos (JPEG)
 * - 'garment': preserve transparency if PNG/WebP; slightly smaller size
 */
export async function urlToBase64Image(
  url: string,
  opts?: { kind?: "model" | "garment" }
): Promise<Base64Image> {
  const kind = opts?.kind ?? "model";
  const max = kind === "garment" ? 768 : 1024;

  try {
    // Firebase Storage download URL
    if (url.includes("firebasestorage.googleapis.com") && url.includes("/o/")) {
      const u = new URL(url);

      // everything after "/o/" is url-encoded object path
      const encoded = u.pathname.split("/o/")[1];
      if (!encoded) throw new Error("Could not parse Firebase Storage path from URL");

      const fullPath = decodeURIComponent(encoded);
      console.log("[urlToBase64Image] Using Storage SDK, path =", fullPath);

      const storageRef = ref(storage, fullPath);
      const bytes = await getBytes(storageRef);

      const ext = fullPath.split(".").pop()?.toLowerCase();
      const mimeType: Base64Image["mimeType"] =
        ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

      const blob = new Blob([bytes], { type: mimeType });

      const format: "image/png" | "image/jpeg" | "image/webp" =
        kind === "garment"
          ? mimeType === "image/png"
            ? "image/png"
            : mimeType === "image/webp"
              ? "image/webp"
              : "image/jpeg"
          : "image/jpeg";

      return await fileToBase64Image(blob, {
        maxWidth: max,
        maxHeight: max,
        format,
        quality: 0.82,
      });
    }

    // Non-firebase URL
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();

    const format: "image/png" | "image/jpeg" | "image/webp" =
      kind === "garment"
        ? blob.type === "image/png"
          ? "image/png"
          : blob.type === "image/webp"
            ? "image/webp"
            : "image/jpeg"
        : "image/jpeg";

    return await fileToBase64Image(blob, {
      maxWidth: max,
      maxHeight: max,
      format,
      quality: 0.82,
    });
  } catch (err) {
    console.error("[urlToBase64Image] Error loading URL:", url, err);
    throw new Error("Could not load image. It might be blocked by CORS or the link is broken.");
  }
}
