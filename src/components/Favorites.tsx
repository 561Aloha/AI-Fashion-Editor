import React from 'react';
import type { FavoriteCreation } from '../types';
import { TrashIcon } from './icons';

interface MyCreationsProps {
    favoriteCreations: FavoriteCreation[];
    setFavoriteCreations: React.Dispatch<React.SetStateAction<FavoriteCreation[]>>;
}

export const MyCreations: React.FC<MyCreationsProps> = ({ favoriteCreations, setFavoriteCreations }) => {
    
    const handleDelete = (imageToDelete: string) => {
        setFavoriteCreations(prev => prev.filter(creation => creation.image !== imageToDelete));
    };

    if (favoriteCreations.length === 0) {
        return (
            <div className="text-center text-gray-500 py-10 h-[65vh] flex flex-col items-center justify-center">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">My Creations</h2>
                <p>You haven't saved any creations yet.</p>
                <p className="mt-2 text-sm">Your saved creations will appear here.</p>
            </div>
        );
    }

    return (
        <div className="w-full">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">My Creations</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto p-2">
                {favoriteCreations.map((creation, index) => (
                    <div key={index} className="relative group aspect-[3/4] overflow-hidden rounded-lg">
                        <img 
                            src={creation.image} 
                            alt={`Favorite creation ${index + 1}`} 
                            className="w-full h-full object-cover border-2 border-gray-300 rounded-lg" 
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                                onClick={() => handleDelete(creation.image)}
                                className="p-3 bg-white/90 rounded-full text-red-600 hover:bg-white transition-transform hover:scale-110"
                                title="Delete Creation"
                            >
                                <TrashIcon className="h-6 w-6" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
