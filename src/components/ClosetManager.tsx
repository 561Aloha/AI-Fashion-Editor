// components/ClosetManager.tsx (AIStudio + ClosetManager)
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import type { ImageFile, ClosetItem, Base64Image } from '../types';
import { generateFashionImage } from './geminiService';
import { fileToBase64Image } from '../utils';
import { ImageUploader } from './ImageUploader';
import { AddToCloset } from './AddToCloset';
import { ClothingCarousel } from './ClothingCarousel';
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";

async function loadClosetFromFirestore(userId: string) {
  const q = query(collection(db, "users", userId, "closet"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() })) as any; // cast to ClosetItem[]
}

interface AIStudioProps {
  closet: ClosetItem[];
  setCloset: React.Dispatch<React.SetStateAction<ClosetItem[]>>; // unused, also fine
  modelImage: ImageFile[];
  setModelImage: React.Dispatch<React.SetStateAction<ImageFile[]>>;
}

export const AIStudio: React.FC<AIStudioProps> = ({ modelImage, setModelImage }) => {
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
  }, [modelImage, outfitImage, prompt]);

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
        <div className="w-full aspect-[3/4] border-2 border-black rounded-lg overflow-hidden bg-gray-200 flex items-center justify-center relative group">
          <img
            src={generatedImage}
            alt="Generated Outfit"
            className="w-full h-full object-cover"
          />
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

        {/* Right Column: outfit + prompt */}
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

// =================================================================
// ClosetManager Component
// =================================================================

interface ClosetManagerProps {
  closet: ClosetItem[];
  setCloset: React.Dispatch<React.SetStateAction<ClosetItem[]>>;
  userId: string; // not used, but ok to leave
}

export const ClosetManager: React.FC<ClosetManagerProps> = ({
  closet,
  setCloset,
  userId,
}) => {
  console.log('[DEBUG: ClosetManager] Closet state:', closet);
  const [topIndex, setTopIndex] = useState(0);
  const [bottomIndex, setBottomIndex] = useState(0);
  const [dressIndex, setDressIndex] = useState(0);
  const [shoesIndex, setShoesIndex] = useState(0);

  const { tops, bottoms, dresses, shoes } = useMemo(() => {
    return {
      tops: closet.filter((i) => i.category === 'top'),
      bottoms: closet.filter((i) => i.category === 'bottom'),
      dresses: closet.filter((i) => i.category === 'dress'),
      shoes: closet.filter((i) => i.category === 'shoes'),
    };
  }, [closet]);

  useEffect(() => {
    setTopIndex(0);
  }, [tops]);
  useEffect(() => {
    setBottomIndex(0);
  }, [bottoms]);
  useEffect(() => {
    setDressIndex(0);
  }, [dresses]);
  useEffect(() => {
    setShoesIndex(0);
  }, [shoes]);
  useEffect(() => {
  if (!userId) return;
  loadClosetFromFirestore(userId).then(setCloset).catch(console.error);
  }, [userId, setCloset]);


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
  };

  const createIndexChanger =
    (setter: React.Dispatch<React.SetStateAction<number>>, max: number) =>
    (direction: 'next' | 'prev') => {
      if (max === 0) return;
      setter((prev) => {
        const newIndex = direction === 'next' ? prev + 1 : prev - 1;
        if (newIndex >= max) return 0;
        if (newIndex < 0) return max - 1;
        return newIndex;
      });
    };

  const handleNextTop = createIndexChanger(setTopIndex, tops.length);
  const handlePrevTop = createIndexChanger(setTopIndex, tops.length);
  const handleNextBottom = createIndexChanger(setBottomIndex, bottoms.length);
  const handlePrevBottom = createIndexChanger(setBottomIndex, bottoms.length);
  const handleNextDress = createIndexChanger(setDressIndex, dresses.length);
  const handlePrevDress = createIndexChanger(setDressIndex, dresses.length);
  const handleNextShoes = createIndexChanger(setShoesIndex, shoes.length);
  const handlePrevShoes = createIndexChanger(setShoesIndex, shoes.length);

  return (
    <div className="w-full text-gray-800 relative">
      <div className="space-y-6">
      <AddToCloset onSave={handleSaveToCloset} userId={userId} />


        <div className="mt-8 pt-6 border-t-2 border-gray-300">
          <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">
            Browse Your Closet
          </h3>
          <div className="w-full max-w-xs mx-auto space-y-4">
            {tops.length > 0 && (
              <ClothingCarousel
                title="Tops"
                items={tops
                  .filter((i) => !!i.imageUrl)
                  .map((i) => ({ source: i.imageUrl }))}
                currentIndex={topIndex}
                onNext={() => handleNextTop('next')}
                onPrev={() => handlePrevTop('prev')}
              />
            )}
            {bottoms.length > 0 && (
              <ClothingCarousel
                title="Bottoms"
                items={bottoms
                  .filter((i) => !!i.imageUrl)
                  .map((i) => ({ source: i.imageUrl }))}
                currentIndex={bottomIndex}
                onNext={() => handleNextBottom('next')}
                onPrev={() => handlePrevBottom('prev')}
              />
            )}
            {dresses.length > 0 && (
              <ClothingCarousel
                title="Dresses"
                items={dresses
                  .filter((i) => !!i.imageUrl)
                  .map((i) => ({ source: i.imageUrl }))}
                currentIndex={dressIndex}
                onNext={() => handleNextDress('next')}
                onPrev={() => handlePrevDress('prev')}
              />
            )}
            {shoes.length > 0 && (
              <ClothingCarousel
                title="Shoes"
                items={shoes
                  .filter((i) => !!i.imageUrl)
                  .map((i) => ({ source: i.imageUrl }))}
                currentIndex={shoesIndex}
                onNext={() => handleNextShoes('next')}
                onPrev={() => handlePrevShoes('prev')}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
