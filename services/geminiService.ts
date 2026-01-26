// services/geminiService.ts
import { GoogleGenAI } from "@google/genai";

// Strip a data URL header if present, otherwise return as-is
const cleanBase64 = (value: string): string => {
  if (!value) return "";

  // If it's a full data URL (data:image/...;base64,xxxxx)
  const commaIndex = value.indexOf(",");
  if (value.startsWith("data:") && commaIndex !== -1) {
    return value.slice(commaIndex + 1);
  }

  // Fallback: older simple pattern
  return value.replace(/^data:image\/\w+;base64,/, "");
};

// Detect mime type from a data URL, defaulting to JPEG
const detectMime = (value: string): string => {
  if (!value) return "image/jpeg";
  const match = value.match(/^data:(.*?);base64,/);
  return match?.[1] ?? "image/jpeg";
};

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  console.warn(
    "VITE_GEMINI_API_KEY is not set; Gemini virtual try-on will fail until this is configured."
  );
}

export const generateTryOn = async (
  modelImage: string,
  topImage?: string,
  bottomImage?: string
): Promise<string> => {
  console.log("🧪 geminiService.generateTryOn called", {
    modelHasData: !!modelImage,
    hasTop: !!topImage,
    hasBottom: !!bottomImage,
  });

  if (!API_KEY) {
    throw new Error("API Key missing (VITE_GEMINI_API_KEY).");
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });

  const parts: any[] = [
    {
      inlineData: {
        mimeType: detectMime(modelImage),
        data: cleanBase64(modelImage),
      },
    },
    { text: "Here is the model." },
  ];

  if (topImage) {
    parts.push({
      inlineData: {
        mimeType: detectMime(topImage),
        data: cleanBase64(topImage),
      },
    });
    parts.push({ text: "Here is the selected top/dress." });
  }

  if (bottomImage) {
    parts.push({
      inlineData: {
        mimeType: detectMime(bottomImage),
        data: cleanBase64(bottomImage),
      },
    });
    parts.push({ text: "Here is the selected bottom." });
  }

  parts.push({
    text: `Generate a photorealistic image of the model wearing the provided clothing item(s).
- If both a top and bottom are provided, wear both.
- If only a dress/top is provided, wear it.
- If only a bottom is provided, wear it.
- Maintain the model's exact pose, face, body shape, and background.
- Adjust the clothing fit naturally to the model's body.
- Do not change the background.
- High quality, fashion photography style.`,
  });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: { parts },
    });

    const candidate = response.candidates?.[0];
    const respParts = candidate?.content?.parts || [];
    const imagePart = respParts.find(
      (p: any) => p.inlineData && p.inlineData.data
    );

    if (!imagePart) {
      console.error("Gemini response had no inlineData image part", response);
      throw new Error("No image generated");
    }

    const mimeType = imagePart.inlineData.mimeType || "image/png";
    const data = imagePart.inlineData.data;

    return `data:${mimeType};base64,${data}`;
  } catch (error) {
    console.error("Gemini TryOn Error", error);
    throw error; // important so Designer can fall back to Hugging Face
  }
};
