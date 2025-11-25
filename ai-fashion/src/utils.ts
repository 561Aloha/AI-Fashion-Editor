import type { Base64Image } from '../src/types';

export const fileToBase64Image = (file: File): Promise<Base64Image> => {
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
};

export const urlToBase64Image = (url: string): Promise<Base64Image> => {
  return new Promise((resolve, reject) => {
    // If it's already a base64 string (long string, not a URL path)
    if (url.length > 500 && !url.startsWith('/') && !url.startsWith('http')) {
      resolve({ base64: url, mimeType: 'image/png' });
      return;
    }

    // If it's already a data URL
    if (url.startsWith('data:image')) {
      const parts = url.split(',');
      const mimeMatch = parts[0].match(/data:(.*?);/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
      resolve({ base64: parts[1], mimeType });
      return;
    }

    // For local files (/whitetee.jpeg) or external URLs
    // Use Image + Canvas approach - NO CORS proxy needed for local files!
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0);
        const dataURL = canvas.toDataURL('image/png');
        const base64 = dataURL.split(',')[1];
        resolve({ base64, mimeType: 'image/png' });
      } catch (e) {
        reject(new Error(`Failed to convert image to base64: ${url}`));
      }
    };

    img.onerror = () => {
      reject(new Error(`Failed to load image: ${url}`));
    };

    // Use the URL directly - no proxy!
    img.src = url;
  });
};

export const urlToBase64 = async (url: string): Promise<string> => {
  // If it's already base64, return as-is
  if (url.startsWith('data:image') || url.length > 500) {
    return url.replace(/^data:image\/\w+;base64,/, '');
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const dataURL = canvas.toDataURL('image/png');
      const base64 = dataURL.replace(/^data:image\/\w+;base64,/, '');
      resolve(base64);
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
};