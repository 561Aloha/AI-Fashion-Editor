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

/**
 * Convert File, Blob, or base64 string to Base64Image
 * Handles all input types safely
 */
export const fileToBase64Image = async (input: File | Blob | string): Promise<Base64Image> => {
    try {
        // If it's already a base64 string, return it
        if (typeof input === 'string') {
            console.log('[fileToBase64Image] Input is already a string');
            return {
                base64: input,
                mimeType: 'image/jpeg',
            };
        }

        // If it's a File or Blob, resize and convert
        if (input instanceof File || input instanceof Blob) {
            console.log('[fileToBase64Image] Input is a File/Blob, resizing...');
            
            try {
                // Resize to max 1024x1024. This prevents hitting the input_token_count limit on the free tier.
                const resizedDataUrl = await resizeImage(input, 1024, 1024);
                const base64 = resizedDataUrl.split(',')[1];
                
                console.log('[fileToBase64Image] Resize successful, base64 length:', base64.length);
                
                // Always return as jpeg after resize for consistency and size
                return { 
                    base64, 
                    mimeType: 'image/jpeg' 
                };
            } catch (resizeError) {
                console.warn("[fileToBase64Image] Resize failed, falling back to original", resizeError);
                
                // Fallback: convert without resizing
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(input);
                    reader.onload = () => {
                        const result = reader.result as string;
                        const base64 = result.split(',')[1];
                        resolve({ 
                            base64, 
                            mimeType: input instanceof File ? input.type : 'image/jpeg' 
                        });
                    };
                    reader.onerror = (error) => {
                        console.error('[fileToBase64Image] FileReader error:', error);
                        reject(error);
                    };
                });
            }
        }

        // If we get here, input was invalid
        throw new Error(`Input must be File, Blob, or base64 string, got: ${typeof input}`);

    } catch (e: any) {
        console.error("[fileToBase64Image] Error:", e.message);
        throw e;
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