// src/components/ClosetGallery.tsx
import React from 'react';
import type { ClosetItem } from '../types';
import type { View, ViewMode } from './MainMenu';

interface ClosetGalleryProps {
  closet: ClosetItem[];
  selectedItemIds: string[];
  onToggleSelect: (id: string) => void;
  onBack: () => void;
  onNavigate: (view: View, mode?: ViewMode) => void;
}

export const ClosetGallery: React.FC<ClosetGalleryProps> = ({
  closet,
  selectedItemIds,
  onToggleSelect,
  onBack,
  onNavigate,
}) => {
  const hasItems = closet.length > 0;

  return (
    <div className="w-full text-gray-800">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="py-1 px-3 rounded-lg font-semibold text-gray-800 border-2 border-black bg-gray-200 shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all text-sm"
        >
          &larr; Back
        </button>
        <h2 className="text-xl font-bold">My Wardrobe</h2>
        <button
          onClick={() => onNavigate('designer', 'weekend')}
          className="py-1 px-3 rounded-lg font-semibold text-gray-800 border-2 border-black bg-pink-300 shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all text-sm"
        >
          Dress Me
        </button>
      </div>

      {!hasItems && (
        <div className="w-full flex flex-col items-center justify-center py-12 text-center text-gray-500">
          <p className="font-semibold mb-2">Your wardrobe is empty.</p>
          <p className="text-sm mb-4">
            Go to <span className="font-semibold">Manage Closet</span> to add items.
          </p>
          <button
            onClick={() => onNavigate('closetManager')}
            className="py-2 px-4 rounded-lg font-semibold text-gray-800 border-2 border-black bg-blue-300 shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all text-sm"
          >
            Manage Closet
          </button>
        </div>
      )}

      {hasItems && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {closet.map((item) => {
            const isSelected = selectedItemIds.includes(item.id);
            const src = item.imageUrl || ''; // ← THIS is the key field

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onToggleSelect(item.id)}
                className={`relative border-2 rounded-lg overflow-hidden shadow-[3px_3px_0px_rgba(0,0,0,1)] transition-all ${
                  isSelected
                    ? 'border-pink-500 ring-2 ring-pink-400'
                    : 'border-black hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none'
                }`}
              >
                <div className="aspect-[3/4] bg-gray-200">
                  {src ? (
                    <img
                      src={src}
                      alt={`${item.category} item`}
                      className="w-full h-full object-contain bg-white"
                      onError={(e) => {
                        console.error('[ClosetGallery] Failed to load imageUrl:', src);
                        (e.target as HTMLImageElement).src = '/placeholder.png';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 p-2">
                      No image
                    </div>
                  )}
                </div>

                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-2 py-1 flex justify-between items-center">
                  <span className="capitalize">{item.category}</span>
                  <span className="capitalize">{item.style}</span>
                </div>

                {isSelected && (
                  <div className="absolute top-1 right-1 bg-pink-500 text-white text-[10px] font-bold px-2 py-1 rounded-full">
                    Selected
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
