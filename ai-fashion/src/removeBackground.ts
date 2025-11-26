/**
 * Background Removal Service using Hugging Face's free models
 * 
 * This service uses the Hugging Face Inference API with free models to remove backgrounds from clothing images.
 * Supported models:
 * - REMBG (via Hugging Face): Uses the rembg model for high-quality background removal
 * - Alternative: briaai/BRIA-2.0 for more detail preservation
 */

// Model options - choose the one that works best for your use case
const HF_MODELS = {
  REMBG: 'briaai/BRIA-2.0', // Better for clothing, preserves fine details
  REMBG_ALT: 'facebook/detr-resnet50-panoptic', // Alternative semantic segmentation
};

const SELECTED_MODEL = HF_MODELS.REMBG; // Using BRIA-2.0 as it's better for fashion items

/**
 * Remove background from an image using Hugging Face's free model
 * @param imageBase64 - Base64 encoded image string (without data URI prefix)
 * @param hfApiKey - Hugging Face API key (get free one at huggingface.co)
 * @returns Promise<string> - Base64 encoded image with transparent background
 */
export async function removeImageBackgroundHF(
  imageBase64: string,
  hfApiKey?: string
): Promise<string> {
  // If no API key provided, use environment variable or throw error
  const apiKey = hfApiKey || process.env.REACT_APP_HF_API_KEY;
  
  if (!apiKey) {
    throw new Error(
      'Hugging Face API key is required. ' +
      'Get a free one at https://huggingface.co/settings/tokens ' +
      'and set it as REACT_APP_HF_API_KEY environment variable.'
    );
  }

  console.log('[DEBUG: removeImageBackgroundHF] Starting background removal with model:', SELECTED_MODEL);

  try {
    // Convert base64 to blob if needed
    const imageBlob = base64ToBlob(imageBase64);

    const response = await fetch(
      `https://api-inference.huggingface.co/models/${SELECTED_MODEL}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        method: 'POST',
        body: imageBlob,
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[DEBUG: removeImageBackgroundHF] API Error:', errorData);
      
      // Check if model is loading
      if (errorData.estimated_time) {
        throw new Error(
          `Hugging Face model is loading. Please try again in ${Math.ceil(errorData.estimated_time)} seconds.`
        );
      }
      
      throw new Error(
        errorData.error || 
        `Hugging Face API error: ${response.status} ${response.statusText}`
      );
    }

    // Get the result as a blob and convert to base64
    const resultBlob = await response.blob();
    const resultBase64 = await blobToBase64(resultBlob);

    console.log('[DEBUG: removeImageBackgroundHF] Background removal successful');
    
    return resultBase64;
  } catch (error: any) {
    console.error('[DEBUG: removeImageBackgroundHF] Error:', error);
    throw new Error(`Background removal failed: ${error.message}`);
  }
}

/**
 * Alternative: Use a simple approach with canvas for quick testing
 * This removes the background by creating a transparent PNG
 */
export async function removeImageBackgroundCanvas(imageBase64: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Could not get canvas context');
        }

        // Draw the image
        ctx.drawImage(img, 0, 0);

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Simple background detection: assumes white/light backgrounds
        // Adjust the threshold based on your needs
        const threshold = 240;

        // Make light backgrounds transparent
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // If pixel is light (close to white), make it transparent
          if (r > threshold && g > threshold && b > threshold) {
            data[i + 3] = 0; // Set alpha to 0
          }
        }

        ctx.putImageData(imageData, 0, 0);
        const result = canvas.toDataURL('image/png').split(',')[1];
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = `data:image/png;base64,${imageBase64}`;
  });
}

/**
 * Utility: Convert base64 string to Blob
 */
function base64ToBlob(base64: string, mimeType: string = 'image/png'): Blob {
  // Remove data URI prefix if present
  const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '');
  
  const byteCharacters = atob(cleanBase64);
  const byteNumbers = new Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * Utility: Convert Blob to base64 string
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // Remove data URI prefix to return just the base64 string
      resolve(base64.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Wrapper function that tries HF first, falls back to canvas if needed
 */
export async function removeImageBackgroundWithFallback(
  imageBase64: string,
  hfApiKey?: string
): Promise<string> {
  try {
    // Try Hugging Face first (better quality)
    return await removeImageBackgroundHF(imageBase64, hfApiKey);
  } catch (hfError: any) {
    console.warn('[DEBUG: removeImageBackgroundWithFallback] HF failed, falling back to canvas:', hfError.message);
    
    try {
      // Fall back to canvas-based removal
      return await removeImageBackgroundCanvas(imageBase64);
    } catch (canvasError) {
      console.error('[DEBUG: removeImageBackgroundWithFallback] Both methods failed');
      throw new Error(
        `Background removal failed with both methods. HF Error: ${hfError.message}`
      );
    }
  }
}