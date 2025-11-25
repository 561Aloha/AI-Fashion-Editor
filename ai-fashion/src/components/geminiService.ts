import type { Base64Image } from '../types';

const API_KEY = (import.meta as any).env.VITE_GEMINI_API_KEY || '';

export const generateFashionImage = async (
  modelImageB64: string,
  clothingImages: Base64Image[],
  prompt: string
): Promise<string> => {
  try {
    const parts = [
      { text: prompt },
      {
        inline_data: {
          mime_type: 'image/png',
          data: modelImageB64
        }
      },
      ...clothingImages.map(clothing => ({
        inline_data: {
          mime_type: clothing.mimeType,
          data: clothing.base64
        }
      }))
    ];

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: parts
          }],
          generationConfig: {
            response_modalities: ['image']
          }
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error: ${error}`);
    }

    const data = await response.json();
    
    // Extract image from response
    if (data.candidates?.[0]?.content?.parts) {
      for (const part of data.candidates[0].content.parts) {
        if (part.inline_data) {
          return part.inline_data.data;
        }
      }
    }

    throw new Error('No image data in response');
  } catch (error) {
    console.error('Error generating fashion image:', error);
    throw error;
  }
};

export const removeImageBackground = async (imageBase64: string): Promise<string> => {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: 'Remove the background from this clothing item image. Make the background transparent or white.' },
              {
                inline_data: {
                  mime_type: 'image/png',
                  data: imageBase64
                }
              }
            ]
          }],
          generationConfig: {
            response_modalities: ['image']
          }
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error: ${error}`);
    }

    const data = await response.json();
    
    if (data.candidates?.[0]?.content?.parts) {
      for (const part of data.candidates[0].content.parts) {
        if (part.inline_data) {
          return part.inline_data.data;
        }
      }
    }

    // Return original if no image generated
    return imageBase64;
  } catch (error) {
    console.error('Error removing background:', error);
    return imageBase64;
  }
};