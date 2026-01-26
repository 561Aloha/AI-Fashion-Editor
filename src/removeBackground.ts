
// Model options - choose the one that works best for your use case
const HF_MODELS = {
  RMBG: 'briaai/RMBG-1.4', // Background remover that returns an image
};

const SELECTED_MODEL = HF_MODELS.RMBG;

export async function removeImageBackgroundHF(
  imageBase64: string
): Promise<string> {
  console.log('[DEBUG: removeImageBackgroundHF] Calling Netlify function /remove-bg');

  const res = await fetch('/.netlify/functions/remove-bg', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64 }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('[DEBUG: removeImageBackgroundHF] Function error:', text);
    throw new Error(text || 'Background removal failed via function');
  }

  const data = await res.json(); // { processedBase64 }
  console.log('[DEBUG: removeImageBackgroundHF] Function success');
  return data.processedBase64;
}


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


export async function removeImageBackgroundWithFallback(
  imageBase64: string
): Promise<string> {
  try {
    return await removeImageBackgroundHF(imageBase64);
  } catch (hfError: any) {
    console.warn(
      '[DEBUG: removeImageBackgroundWithFallback] HF function failed, falling back to canvas:',
      hfError.message
    );

    try {
      return await removeImageBackgroundCanvas(imageBase64);
    } catch (canvasError) {
      console.error('[DEBUG: removeImageBackgroundWithFallback] Both methods failed');
      throw new Error(
        `Background removal failed with both methods. HF Error: ${hfError.message}`
      );
    }
  }
}
