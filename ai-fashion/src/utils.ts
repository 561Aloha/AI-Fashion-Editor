
import type { Base64Image } from './types';

// Helper to resize image to reduce token usage for API
const resizeImage = (blob: Blob, maxWidth: number, maxHeight: number): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = URL.createObjectURL(blob);
        img.onload = () => {
            let width = img.width;
            let height = img.height;

            // Calculate new dimensions keeping aspect ratio
            if (width > maxWidth || height > maxHeight) {
                if (width > height) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                } else {
                    width = Math.round((width * maxHeight) / height);
                    height = maxHeight;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                // Compress to JPEG 0.7 to significantly reduce size/tokens while maintaining decent quality
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                resolve(dataUrl);
            } else {
                reject(new Error("Canvas context not available"));
            }
            URL.revokeObjectURL(img.src);
        };
        img.onerror = (err) => {
             URL.revokeObjectURL(img.src);
             reject(err);
        };
    });
};

export const fileToBase64Image = async (file: File): Promise<Base64Image> => {
    try {
        // Resize to max 1024x1024. This prevents hitting the input_token_count limit on the free tier.
        const resizedDataUrl = await resizeImage(file, 1024, 1024);
        const base64 = resizedDataUrl.split(',')[1];
        // Always return as jpeg after resize for consistency and size
        return { base64, mimeType: 'image/jpeg' };
    } catch (e) {
        console.warn("Image resize failed, falling back to original", e);
         return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const result = reader.result as string;
                const base64 = result.split(',')[1];
                resolve({ base64, mimeType: file.type });
            };
            reader.onerror = (error) => reject(error);
        });
    }
};

export const urlToBase64Image = async (url: string): Promise<Base64Image> => {
  const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
  
  let blob: Blob;

  try {
      // Try fetching directly first
      const response = await fetch(url);
      if (!response.ok) throw new Error("Direct fetch failed");
      blob = await response.blob();
  } catch(e) {
      // Fallback to proxy
      try {
        const response = await fetch(proxyUrl + url);
        if (!response.ok) throw new Error(`Failed to fetch image from ${url}`);
        blob = await response.blob();
      } catch (proxyError) {
          throw new Error(`Could not load image. It might be blocked by CORS or the link is broken.`);
      }
  }
  
  try {
      const resizedDataUrl = await resizeImage(blob, 1024, 1024);
      const base64 = resizedDataUrl.split(',')[1];
      return { base64, mimeType: 'image/jpeg' };
  } catch (e) {
      // Fallback
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          resolve({ base64, mimeType: blob.type });
        };
        reader.onerror = (error) => reject(error);
      });
  }
};
