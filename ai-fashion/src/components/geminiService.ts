
import { GoogleGenAI, Part } from "@google/genai";
import type { Base64Image } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const handleGeminiError = (error: any) => {
  console.error("Gemini API Error Details:", error);
  
  const message = error.message || '';
  const status = error.status || 0;

  if (status === 429 || message.includes('429') || message.includes('Quota') || message.includes('RESOURCE_EXHAUSTED')) {
    // Distinguish between simple rate limiting and token limits if possible, but generally guide user to wait.
    if (message.includes('token_count')) {
         throw new Error("The image was too large for the Free Tier limit. We've optimized it, please try again in 30 seconds.");
    }
    throw new Error("High traffic! 🚦 The AI model is busy. Please wait 30-60 seconds and try again.");
  }
  
  if (message.includes('modalities')) {
      throw new Error("The model is having trouble with this specific image format. Please try a different photo.");
  }

  throw new Error(message || "An unexpected error occurred with the AI service.");
};

export const removeImageBackground = async (imageBase64: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { text: 'Remove the background from this clothing item image. Make the background transparent or white.' },
          {
            inlineData: {
              mimeType: 'image/png',
              data: imageBase64
            }
          }
        ]
      },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return part.inlineData.data;
      }
    }

    throw new Error('No image data in response');
  } catch (error) {
    // If it's a quota error, we want to stop and tell the user
    try {
        handleGeminiError(error);
    } catch (rethrownError) {
        // If handleGeminiError throws (which it does), we catch it here.
        // However, for background removal, we previously returned the original image as fallback.
        // We should ONLY return the fallback if it's NOT a quota error.
        // If it IS a quota error, we want the UI to show the error so the user knows to wait.
        if ((error as any).status === 429 || (error as any).message?.includes('429')) {
             throw rethrownError;
        }
    }
    
    console.warn('Background removal failed, using original image as fallback.');
    return imageBase64;
  }
};

export const generateFashionImage = async (
  modelImageB64: string,
  clothingImages: Base64Image[],
  prompt: string
): Promise<string> => {
  try {
    const parts: Part[] = [
      { text: prompt },
      {
        inlineData: {
          mimeType: 'image/png', // The API handles jpeg input defined as png usually fine, but ideally should match.
          data: modelImageB64
        }
      },
      ...clothingImages.map(clothing => ({
        inlineData: {
          mimeType: clothing.mimeType,
          data: clothing.base64
        }
      }))
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: parts },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return part.inlineData.data;
      }
    }

    throw new Error('No image data in response');
  } catch (error) {
    handleGeminiError(error);
    throw error; // handleGeminiError throws, but just in case
  }
};
