import React, { useCallback } from 'react';
import type { ImageFile } from '../types';
import { UploadIcon, TrashIcon } from './icons';

interface ImageUploaderProps {
  onImagesUpload: (files: ImageFile[]) => void;
  images: ImageFile[];
  label: string;
  multiple?: boolean;
  helpText: string;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImagesUpload, images, label, multiple = false, helpText }) => {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const filesArray = Array.from(event.target.files).map((file: File) => ({
        file: file,  // ← Make sure this is a File, not a Blob
        preview: URL.createObjectURL(file)
      }));
      onImagesUpload(filesArray);
    }
  };

  const removeImage = (indexToRemove: number) => {
    const newImages = images.filter((_, index) => index !== indexToRemove);
    const previewsToRevoke = images.filter((_, index) => index === indexToRemove);
    previewsToRevoke.forEach(img => URL.revokeObjectURL(img.preview));
    onImagesUpload(newImages);
  };
  
  const hasImages = images.length > 0;
  return (
    <div className="w-full h-full flex flex-col">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <div
        className={`relative flex-1 flex justify-center items-center w-full px-6 border-2 border-gray-300 border-dashed rounded-lg overflow-hidden ${
          hasImages ? "" : "hover:border-indigo-500 transition-colors"
        }`}
      >

        {!hasImages && (
          <div className="text-center">
            <UploadIcon className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">
              <span className="font-semibold text-indigo-600">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-gray-500">{helpText}</p>

            <input
              type="file"
              multiple={multiple}
              accept="image/*"
              onChange={handleFileChange}
              className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
        )}

        {hasImages && (
          <div className={`w-full h-full grid gap-4 ${multiple ? "grid-cols-2 md:grid-cols-3" : "grid-cols-1"}`}>
            {images.map((image, index) => (
              <div key={index} className="relative group w-full h-full">
                <img
                  src={image.preview}
                  alt="Preview"
                  className="w-full h-full object-contain rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute top-1 right-1 p-1.5 bg-black bg-opacity-60 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

};
