import type { Base64Image } from '../types';

const API_URL = 'http://localhost:3001'; 

export const generateVirtualTryOnHybrid = async (
  modelImageB64: string,
  clothingImages: Base64Image[],
  prompt: string
): Promise<string> => {
  try {
    console.log('[HF] Starting virtual try-on generation...');

    // Step 1: Extract base64 strings (no background removal needed - already done when added to closet)
    const processedClothing = clothingImages.map(clothing => clothing.base64);

    // Step 2: Composite clothing items into single image (client-side)
    console.log('[HF] Compositing clothing items...');
    const compositeClothing = await compositeClothingItems(processedClothing);

    // Step 3: Apply virtual try-on with composite image via backend
    console.log('[HF] Applying virtual try-on...');
    const result = await applyVirtualTryOnViaBackend(modelImageB64, compositeClothing);

    console.log('[HF] Generation successful');
    return result;
  } catch (error: any) {
    console.error('[HF] Error in virtual try-on:', error?.message || error);
    throw error;
  }
};

// Apply virtual try-on via backend proxy
const applyVirtualTryOnViaBackend = async (
  personImageB64: string,
  garmentImageB64: string
): Promise<string> => {
  try {
    const response = await fetch(`${API_URL}/api/virtual-tryon`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personImage: personImageB64.includes('base64,')
          ? personImageB64
          : `data:image/png;base64,${personImageB64}`,
        garmentImage: garmentImageB64.includes('base64,')
          ? garmentImageB64
          : `data:image/png;base64,${garmentImageB64}`,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Virtual try-on failed: ${error.error || response.status}`);
    }

    const data = await response.json();
    return data.imageBase64;
  } catch (error: any) {
    console.error('[applyVirtualTryOnViaBackend] Error:', error.message);
    throw error;
  }
};

// Composite multiple clothing items into a single image (client-side)
// Top item goes on top half, bottom item goes on bottom half
const compositeClothingItems = async (clothingB64Array: string[]): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (clothingB64Array.length === 0) {
      reject(new Error('No clothing items to composite'));
      return;
    }

    // If only one item, return it as-is
    if (clothingB64Array.length === 1) {
      resolve(clothingB64Array[0]);
      return;
    }

    // Load all images
    const images: HTMLImageElement[] = [];
    let loadedCount = 0;

    clothingB64Array.forEach((b64, index) => {
      const img = new Image();
      img.onload = () => {
        images[index] = img;
        loadedCount++;

        // Once all images are loaded, composite them
        if (loadedCount === clothingB64Array.length) {
          try {
            // Find max dimensions
            const maxWidth = Math.max(...images.map(img => img.width));
            const maxHeight = Math.max(...images.map(img => img.height));

            // Create canvas with enough space
            const canvas = document.createElement('canvas');
            canvas.width = maxWidth;
            canvas.height = maxHeight * 2; // Double height for top and bottom

            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('Could not get canvas context'));
              return;
            }

            // Clear canvas with transparency
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Assume first item is top, second is bottom
            // Draw top in upper half
            if (images[0]) {
              const topX = (canvas.width - images[0].width) / 2;
              ctx.drawImage(images[0], topX, 0);
            }

            // Draw bottom in lower half
            if (images[1]) {
              const bottomX = (canvas.width - images[1].width) / 2;
              const bottomY = maxHeight;
              ctx.drawImage(images[1], bottomX, bottomY);
            }

            // Convert to base64
            const compositeDataUrl = canvas.toDataURL('image/png');
            const base64 = compositeDataUrl.split(',')[1];
            resolve(base64);
          } catch (err) {
            reject(err);
          }
        }
      };

      img.onerror = () => {
        reject(new Error(`Failed to load clothing image ${index}`));
      };

      // Add data URL prefix if not present
      const dataUrl = b64.includes('data:image')
        ? b64
        : `data:image/png;base64,${b64}`;
      img.src = dataUrl;
    });
  });
};