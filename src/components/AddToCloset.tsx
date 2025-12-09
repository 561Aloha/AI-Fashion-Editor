import React, { useState } from 'react';
import { ImageUploader } from './ImageUploader';
import { removeImageBackgroundWithFallback } from '../removeBackground';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import { auth } from '../firebase';
import { db } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

import type {
  ImageFile,
  ClosetCategory,
  ClosetItem,
  ClothingStyle,
} from '../types';

import { fileToBase64Image } from '../utils';

const dataUrlToBlob = (dataUrl: string): Blob => {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/data:(.*);base64/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);

  return new Blob([byteArray], { type: mimeType });
};

interface AddToClosetProps {
  onSave: (item: Omit<ClosetItem, 'id' | 'isFavorite'>) => void;
  userId: string; // new
}

const CATEGORIES: ClosetCategory[] = ['top', 'bottoms', 'dress', 'shoes'];
const STYLES: ClothingStyle[] = ['work', 'weekend', 'both'];

export const AddToCloset: React.FC<AddToClosetProps> = ({ onSave, userId }) => {
  const [uploadedImage, setUploadedImage] = useState<ImageFile[]>([]);
  const [processedImageSrc, setProcessedImageSrc] = useState<string | null>(null);

  const [category, setCategory] = useState<ClosetCategory>('top');
  const [style, setStyle] = useState<ClothingStyle>('weekend');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [processingMethod, setProcessingMethod] = useState<'hf' | 'canvas'>('hf');

  const handleImageUpload = async (files: ImageFile[]) => {
    setIsSaved(false);

    if (files.length === 0) {
      setUploadedImage([]);
      setProcessedImageSrc(null);
      setError(null);
      return;
    }

    console.log(
      '[DEBUG: AddToCloset] New image uploaded, starting background removal process...',
    );
    setUploadedImage([files[0]]);
    setIsLoading(true);
    setError(null);
    setProcessedImageSrc(null);
    setProcessingMethod('hf');

    try {
      const imageBase64 = await fileToBase64Image(files[0].file); // { base64, mimeType }
      const resultBase64 = await removeImageBackgroundWithFallback(
        imageBase64.base64,
      );

      // Normalize: always store a full data URL in state
      const dataUrl = resultBase64.startsWith('data:')
        ? resultBase64
        : `data:image/png;base64,${resultBase64}`;

      setProcessedImageSrc(dataUrl);

      console.log(
        '[DEBUG: AddToCloset] Background removal successful. Processed image data URL snippet:',
        dataUrl.substring(0, 50) + '...',
      );
    } catch (e: any) {
      console.error('[DEBUG: AddToCloset] Error during background removal:', e);
      setError(e?.message || 'Failed to process image.');
    } finally {
      setIsLoading(false);
    }
  };

const handleSave = async () => {
  if (!processedImageSrc) return;

  try {
    setIsSaved(false);
    setIsLoading(true);
    setError(null);

    const blob = dataUrlToBlob(processedImageSrc);
    const timestamp = Date.now();
    const filename = `${category}-${timestamp}.jpg`;
    const path = `users/${userId}/closet/${filename}`;
    const storageRef = ref(storage, path);

    await uploadBytes(storageRef, blob);
    const downloadUrl = await getDownloadURL(storageRef);

    // ✅ ADD THIS: write a doc to Firestore subcollection users/{userId}/closet/{docId}
    await setDoc(doc(db, "users", userId, "closet", `${category}-${timestamp}`), {
      category,
      imageUrl: downloadUrl,
      createdAt: serverTimestamp(),
      style,                 // use the chosen style, not hardcoded
      storagePath: path,     // optional but super useful later (delete/cleanup)
      filename,              // optional
    });

    const newItem: Omit<ClosetItem, 'id' | 'isFavorite'> = {
      imageUrl: downloadUrl,
      category,
      style,
    };

    onSave(newItem);
    setIsSaved(true);
  } catch (err: any) {
    console.error('[DEBUG: AddToCloset] Save error:', err);
    setError('Failed to save item.');
  } finally {
    setIsLoading(false);
  }
};

  const handleAddMore = () => {
    setUploadedImage([]);
    setProcessedImageSrc(null);
    setCategory('top');
    setStyle('weekend');
    setError(null);
    setIsSaved(false);
    setProcessingMethod('hf');
  };

  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-700 mb-4">Add New Item</h3>

      {error && error.includes('API key') && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
          <p className="font-semibold mb-1">📝 Setup Required</p>
          <p className="mb-2">
            To use AI background removal, you need a free Hugging Face API key:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>
              Visit{' '}
              <a
                href="https://huggingface.co/settings/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                huggingface.co/settings/tokens
              </a>
            </li>
            <li>Create a free account or sign in</li>
            <li>Generate a new token (read access is fine)</li>
            <li>
              Add to your{' '}
              <code className="bg-blue-100 px-1 rounded">.env.local</code>:{' '}
              <code className="bg-blue-100 px-1 rounded">
                VITE_HF_API_KEY=your_token_here
              </code>
            </li>
            <li>Restart your development server</li>
          </ol>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* Left column: Uploader */}
        <div>
          <ImageUploader
            images={uploadedImage}
            onImagesUpload={handleImageUpload}
            label="1. Upload Clothing"
            multiple={false}
            helpText="PNG, JPG, etc."
          />
        </div>

        {/* Right column: Preview, Categorize & Save */}
        <div className="space-y-4">
          <label className="block text-sm font-medium text-gray-700">
            2. Categorize & Save
          </label>

          <div className="flex items-center justify-center p-4 bg-gray-200/50 rounded-md min-h-[210px]">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center text-gray-500">
                <svg
                  className="animate-spin h-8 w-8 text-indigo-500"
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
                <p className="mt-2">Removing background...</p>
                {processingMethod === 'canvas' && (
                  <p className="text-xs text-gray-400 mt-1">
                    (Using canvas fallback)
                  </p>
                )}
              </div>
            ) : processedImageSrc ? (
              <img
                src={processedImageSrc}
                alt="Processed clothing item"
                className="max-h-48 object-contain"
              />
            ) : (
              <p className="text-gray-500 text-center">
                Upload an image to see a preview.
              </p>
            )}
          </div>

          {error && !error.includes('API key') && (
            <p className="text-red-500 text-sm text-center -mt-2 pb-2">{error}</p>
          )}

          {isSaved ? (
            <div className="text-center space-y-4 pt-4">
              <p className="font-semibold text-green-600 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 mr-2"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                Saved to Closet!
              </p>
              <button
                onClick={handleAddMore}
                className="w-full py-2 px-4 bg-indigo-600 text-white font-bold rounded-lg border-2 border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all"
              >
                Add More
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="category"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Category
                  </label>
                  <select
                    id="category"
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as ClosetCategory)
                    }
                    className="w-full p-2 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition disabled:bg-gray-100"
                    disabled={!processedImageSrc || isLoading}
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat} className="capitalize">
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="style"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Style
                  </label>
                  <select
                    id="style"
                    value={style}
                    onChange={(e) =>
                      setStyle(e.target.value as ClothingStyle)
                    }
                    className="w-full p-2 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition disabled:bg-gray-100"
                    disabled={!processedImageSrc || isLoading}
                  >
                    {STYLES.map((st) => (
                      <option key={st} value={st} className="capitalize">
                        {st.charAt(0).toUpperCase() + st.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={!processedImageSrc || isLoading || isSaved}
                className="w-full mt-4 py-2 px-4 bg-indigo-600 text-white font-bold rounded-lg border-2 border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] disabled:bg-gray-400 disabled:border-gray-600 disabled:shadow-none hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all"
              >
                {isLoading ? 'Saving...' : isSaved ? 'Saved' : 'Save to Closet'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
