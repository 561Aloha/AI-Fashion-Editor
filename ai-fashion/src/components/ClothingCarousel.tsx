import React from 'react';
import { RewindIcon, PlayIcon, FastForwardIcon } from './icons';

interface CarouselItem {
    source: string;
}

interface ClothingCarouselProps {
    items: CarouselItem[];
    currentIndex: number;
    onNext: () => void;
    onPrev: () => void;
    title: string;
}

export const ClothingCarousel: React.FC<ClothingCarouselProps> = ({ items, currentIndex, onNext, onPrev, title }) => {
    const validIndex = currentIndex >= items.length ? 0 : currentIndex;
    const currentItem = items.length > 0 ? items[validIndex] : null;

    const currentImageSrc = () => {
        if (!currentItem) return '';
        const src = currentItem.source;
        if (src.startsWith('data:image')) return src;
        if (src.length > 500) { // Heuristic to guess if it's a b64 string vs a URL
             return `data:image/png;base64,${src}`;
        }
        return src;
    }

    return (
        <div className="flex flex-col items-center gap-2">
            <div className="w-full aspect-[3/4] border-2 border-black rounded-lg overflow-hidden bg-gray-200 flex items-center justify-center relative group">
                {items.length > 0 && currentItem ? (
                    <img src={currentImageSrc()} alt={`${title} item ${validIndex + 1}`} className="w-full h-full object-cover" />
                ) : (
                    <span className="text-gray-500 text-center">No {title} items found for this category.</span>
                )}
            </div>
            <div className="w-full flex justify-center items-center gap-4 bg-pink-300 p-2 rounded-lg border-2 border-black">
                <button onClick={onPrev} className="text-black hover:text-gray-700 transition-colors disabled:opacity-50" disabled={items.length < 2}>
                    <RewindIcon className="h-6 w-6" />
                </button>
                <button className="text-black hover:text-gray-700 transition-colors">
                    <PlayIcon className="h-6 w-6" />
                </button>
                <button onClick={onNext} className="text-black hover:text-gray-700 transition-colors disabled:opacity-50" disabled={items.length < 2}>
                    <FastForwardIcon className="h-6 w-6" />
                </button>
            </div>
        </div>
    );
};