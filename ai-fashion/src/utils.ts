
import type { Base64Image } from './src/types';

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

export const urlToBase64Image = async (url: string): Promise<Base64Image> => {
  // Use a CORS proxy to fetch images from domains that might block direct requests.
  const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
  const response = await fetch(proxyUrl + url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image from ${url}. Status: ${response.status}. This could be a CORS issue or the link may be broken.`);
  }
  const blob = await response.blob();
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
};