import React from 'react';
import type { ClosetItem, ClosetCategory } from '../types';
import { StarIcon } from './icons';

interface FavoriteItemsProps {
  closet: ClosetItem[];
  setCloset: React.Dispatch<React.SetStateAction<ClosetItem[]>>;
}

const CATEGORIES: ClosetCategory[] = ['top', 'bottoms', 'dress', 'shoes'];

export const FavoriteItems: React.FC<FavoriteItemsProps> = ({ closet, setCloset }) => {
    const favoriteItems = closet.filter(item => item.isFavorite);

    const handleToggleFavorite = (itemId: string) => {
        setCloset(prevCloset =>
            prevCloset.map(item =>
                item.id === itemId ? { ...item, isFavorite: !item.isFavorite } : item
            )
        );
    };

    if (favoriteItems.length === 0) {
        return (
            <div className="text-center text-gray-500 py-10 h-[65vh] flex flex-col items-center justify-center">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Favorite Items</h2>
                <p>You haven't favorited any items yet.</p>
                <p className="mt-2 text-sm">Click the star icon on items in your closet to add them here!</p>
            </div>
        );
    }

    return (
        <div className="w-full">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Favorite Items</h2>
            <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
                {CATEGORIES.map(category => {
                    const itemsInCategory = favoriteItems.filter(item => item.category === category);
                    if (itemsInCategory.length === 0) return null;

                    return (
                        <div key={category}>
                            <h4 className="font-semibold text-gray-600 capitalize mb-2 border-b border-gray-300 pb-1">{category.charAt(0).toUpperCase() + category.slice(1)}s</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                {itemsInCategory.map(item => (
                                    <div
                                        key={item.id}
                                        className="aspect-square rounded-lg overflow-hidden group relative border-2 border-gray-300"
                                    >
                                        <img 
                                            src={`data:image/png;base64,${item.imageB64}`} 
                                            alt={`Favorite ${item.category}`}
                                            className="w-full h-full object-contain p-2" 
                                        />
                                        <button
                                            onClick={() => handleToggleFavorite(item.id)}
                                            className="absolute top-2 right-2 p-1.5 bg-black/50 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/75"
                                            title="Remove from favorites"
                                        >
                                            <StarIcon className="h-5 w-5 text-yellow-400" filled={true} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
