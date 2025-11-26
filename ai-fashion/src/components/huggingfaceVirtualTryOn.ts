import type { Base64Image } from '../types';

const HF_API_TOKEN = import.meta.env.VITE_HF_API_KEY;

console.log('[HF] Has token?', !!HF_API_TOKEN);

export const generateVirtualTryOnHybrid = async (
  modelImageB64: string,
  clothingImages: Base64Image[],
  prompt: string
): Promise<string> => {
  try {
    if (!HF_API_TOKEN) {
      throw new Error('Hugging Face API key required');
    }

  console.log('[HF] Starting generation...');
  console.log('[HF] Has token?', !!HF_API_TOKEN);
// TEMP DEBUG
console.log('[HF] import.meta.env keys:', Object.keys(import.meta.env));
console.log('[HF] VITE_HF_API_KEY present?', 'VITE_HF_API_KEY' in import.meta.env);

    // Use Stable Diffusion XL - most reliable
    const modelId = 'stabilityai/stable-diffusion-xl-base-1.0';

    const enhancedPrompt = `${prompt}. Professional fashion photography. High quality, detailed, realistic. Studio lighting.`;

    console.log('[HF] Prompt:', enhancedPrompt);
    console.log('[HF] Sending to HF API...');

    const response = await fetch(
      `https://api-inference.huggingface.co/models/${modelId}`,
      {
        headers: {
          Authorization: `Bearer ${HF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({
          inputs: enhancedPrompt,
        }),
      }
    );

    console.log('[HF] Response status:', response.status);

    if (!response.ok) {
      const text = await response.text();
      console.error('[HF] Error response:', text);
      
      try {
        const errorData = JSON.parse(text);
        if (errorData.estimated_time) {
          throw new Error(
            `Model is loading. Please wait ${Math.ceil(errorData.estimated_time)} seconds and try again.`
          );
        }
        if (errorData.error) {
          const msg = Array.isArray(errorData.error) ? errorData.error[0] : errorData.error;
          throw new Error(msg);
        }
      } catch (e) {
        // If JSON parse fails, just use the text
        if (text.includes('loading')) {
          throw new Error('Model is loading. Please wait a moment and try again.');
        }
      }
      
      throw new Error(`API error ${response.status}`);
    }

    // Response should be an image blob
    const blob = await response.blob();
    
    if (!blob || blob.size === 0) {
      throw new Error('Received empty response from HF');
    }

    console.log('[HF] Image blob received, size:', blob.size);

    // Convert blob to base64
    const base64 = await blobToBase64(blob);
    
    console.log('[HF] Conversion complete');
    return base64;

  } catch (error: any) {
    console.error('[HF] Error:', error.message);
    throw error;
  }
};

/**
 * Helper function to convert blob to base64
 * Works reliably with any image format
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      try {
        const result = reader.result as string;
        // Result is "data:image/png;base64,xxxxx"
        // Extract just the base64 part
        const base64Part = result.split(',')[1];
        
        if (!base64Part) {
          reject(new Error('Failed to extract base64 from blob'));
          return;
        }
        
        resolve(base64Part);
      } catch (err) {
        reject(err);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read blob'));
    };
    
    reader.onabort = () => {
      reject(new Error('Blob reading aborted'));
    };
    
    try {
      reader.readAsDataURL(blob);
    } catch (err) {
      reject(new Error(`FileReader error: ${err}`));
    }
  });
}

/**
 * Alternative: Use text-to-image if image-to-image fails
 * Falls back to generating from scratch based on prompt
 */
export const generateVirtualTryOnTextToImage = async (
  modelImageB64: string,
  clothingImages: Base64Image[],
  prompt: string
): Promise<string> => {
  try {
    if (!HF_API_TOKEN) {
      throw new Error('Hugging Face API key required');
    }

    console.log('[HF Text-to-Image] Fallback: generating from prompt...');

    const modelId = 'stabilityai/stable-diffusion-xl-base-1.0';

    const enhancedPrompt = `Person wearing ${prompt}. Professional fashion photography, high quality, detailed, realistic clothing`;

    const response = await fetch(
      `https://api-inference.huggingface.co/models/${modelId}`,
      {
        headers: {
          Authorization: `Bearer ${HF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({
          inputs: enhancedPrompt,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`API error ${response.status}`);
    }

    const blob = await response.blob();
    return await blobToBase64(blob);

  } catch (error: any) {
    console.error('[HF Text-to-Image] Error:', error);
    throw error;
  }
};