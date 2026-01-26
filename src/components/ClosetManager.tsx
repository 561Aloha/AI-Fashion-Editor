import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { ImageFile, ClosetItem, Base64Image } from '../types';
import { generateFashionImage } from './geminiService';
import { fileToBase64Image } from '../utils';
import { ImageUploader } from './ImageUploader';
import { AddToCloset } from './AddToCloset';

interface AIStudioProps {
  closet: ClosetItem[];
  setCloset: React.Dispatch<React.SetStateAction<ClosetItem[]>>;
  modelImage: ImageFile[];
  onSaveCreation?: (image: string) => void;
  setModelImage: React.Dispatch<React.SetStateAction<ImageFile[]>>;
}

export const AIStudio: React.FC<AIStudioProps> = ({ modelImage, setModelImage,  onSaveCreation, }) => {
  const [outfitImage, setOutfitImage] = useState<ImageFile[]>([]);
  const [prompt, setPrompt] = useState<string>('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleModelUpload = (files: ImageFile[]) => {
    setModelImage(files.length > 0 ? [files[0]] : []);
  };

  const handleOutfitUpload = (files: ImageFile[]) => {
    setOutfitImage(files.length > 0 ? [files[0]] : []);
  };

  const handleGenerate = useCallback(async () => {
    console.log('[DEBUG: AIStudio] handleGenerate triggered for outfit swap.');
    if (modelImage.length === 0) {
      setError('Please upload a photo of yourself or a model.');
      return;
    }
    if (outfitImage.length === 0) {
      setError('Please upload a photo of the outfit you want to try on.');
      return;
    }

    console.log('[DEBUG: AIStudio] Generation parameters:', {
      modelImage: modelImage[0]?.file.name,
      outfitImage: outfitImage[0]?.file.name,
      prompt,
    });
    setIsLoading(true);
    setError(null);
    setGeneratedImage(null);

    try {
      const modelB64 = await fileToBase64Image(modelImage[0].file);
      const outfitB64 = await fileToBase64Image(outfitImage[0].file);

      const clothingImages: Base64Image[] = [outfitB64];

      const basePrompt =
        'Take the complete outfit from the second image (the clothing image) ' +
        'and realistically place it on the person from the first image (the model image). ' +
        "Preserve the model's pose and face. The background should be simple or match the model's original background.";
      const finalPrompt = prompt.trim()
        ? `${basePrompt} Additional instructions: ${prompt}`
        : basePrompt;

      const resultB64 = await generateFashionImage(
        modelB64.base64,
        clothingImages,
        finalPrompt,
      );
      const imageSrc = `data:image/png;base64,${resultB64}`;
      setGeneratedImage(imageSrc);
      console.log(
        '[DEBUG: AIStudio] Image generation successful. Result snippet:',
        imageSrc.substring(0, 50) + '...',
      );
    } catch (e: any) {
      setError(e.message || 'An unexpected error occurred during image generation.');
      console.error('[DEBUG: AIStudio] Error during generation:', e);
    } finally {
      setIsLoading(false);
    }
  }, [modelImage, outfitImage, prompt, onSaveCreation]);

  const renderMainContent = () => {
    if (isLoading) {
      return (
        <div className="w-full aspect-[3/4] border-2 border-black rounded-lg bg-gray-200 flex flex-col items-center justify-center text-center p-4">
          <svg
            className="animate-spin h-10 w-10 text-purple-500"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <p className="mt-3 text-lg font-semibold text-gray-700">
            Generating your look...
          </p>
          <p className="text-sm text-gray-600">This might take a moment.</p>
        </div>
      );
    }
  if (generatedImage) {
    return (
      <div className="space-y-3">
        <div className="w-full aspect-[3/4] border-2 border-black rounded-lg overflow-hidden bg-gray-200 flex items-center justify-center relative group">
          <img
            src={generatedImage}
            alt="Generated Outfit"
            className="w-full h-full object-cover"
          />
        </div>

        <button
          onClick={() => onSaveCreation?.(generatedImage)}
          className="w-full py-3 px-4 bg-purple-600 text-white font-bold rounded-lg border-2 border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all"
        >
          Dress Me
        </button>
      </div>
    );
  }

    return (
      <ImageUploader
        images={modelImage}
        onImagesUpload={handleModelUpload}
        label="1. Upload a Photo of Yourself"
        multiple={false}
        helpText="Use a clear, full-body shot"
      />
    );
  };

  return (
    <div className="w-full text-gray-800">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column: model uploader / loader / result */}
        <div className="space-y-4">{renderMainContent()}</div>

        <div className="space-y-6 flex flex-col">
          <ImageUploader
            images={outfitImage}
            onImagesUpload={handleOutfitUpload}
            label="2. Upload a Photo of the Outfit"
            multiple={false}
            helpText="A photo of someone wearing the outfit"
          />
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="3. Optional: Add specific instructions (e.g., 'change the color to blue', 'make it a daytime scene')..."
            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
            rows={4}
          />
          <button
            onClick={handleGenerate}
            disabled={
              isLoading || modelImage.length === 0 || outfitImage.length === 0
            }
            className="w-full py-3 px-4 bg-green-500 text-white font-bold rounded-lg border-2 border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all disabled:bg-gray-400 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Generating...' : '4. Generate Outfit'}
          </button>
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        </div>
      </div>
    </div>
  );
};

interface ClosetManagerProps {
  closet: ClosetItem[];
  setCloset: React.Dispatch<React.SetStateAction<ClosetItem[]>>;
  userId: string;
}

export const ClosetManager: React.FC<ClosetManagerProps> = ({
  closet,
  setCloset,
  userId,
}) => {
  console.log('[DEBUG: ClosetManager] Closet state:', closet);
  const [lastAddedItemId, setLastAddedItemId] = useState<string | null>(null);

  const handleSaveToCloset = (
    newItem: Omit<ClosetItem, 'id' | 'isFavorite'>,
  ) => {
    const itemWithId: ClosetItem = {
      ...newItem,
      id: Date.now().toString(),
      isFavorite: false,
    };
    console.log('[DEBUG: ClosetManager] Saving new item to closet:', itemWithId);
    setCloset((prev) => [...prev, itemWithId]);
    setLastAddedItemId(itemWithId.id);
  };

  // Get the last added item
  const lastAddedItem = lastAddedItemId
    ? closet.find((i) => i.id === lastAddedItemId)
    : null;

  return (
    <div className="w-full text-gray-800 flex flex-col items-center justify-center">
      <div className="w-full max-w-md space-y-6">
        <AddToCloset onSave={handleSaveToCloset} userId={userId} />

        {/* ✅ Show newly added items below */}
        {lastAddedItem && (
          <div className="mt-8 pt-6 border-t-2 border-gray-300">
            <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">
              Recently Added
            </h3>
            <div className="w-full aspect-[3/4] border-2 border-black rounded-lg overflow-hidden bg-gray-200 flex items-center justify-center">
              {lastAddedItem.imageUrl ? (
                <img
                  src={lastAddedItem.imageUrl}
                  alt={`Recently added ${lastAddedItem.category}`}
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/placeholder.png';
                  }}
                />
              ) : (
                <span className="text-gray-500">No image</span>
              )}
            </div>
            <div className="mt-2 text-center text-sm text-gray-600">
              <p className="capitalize font-semibold">{lastAddedItem.category}</p>
              <p className="capitalize text-xs">{lastAddedItem.style}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};