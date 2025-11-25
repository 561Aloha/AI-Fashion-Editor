import React from 'react';
import type { ImageFile } from '../types';


export type View = 'menu' | 'designer' | 'closetManager' | 'aiStudio' | 'myCreations' | 'wardrobe';
export type ViewMode = 'work' | 'weekend';

interface MainMenuProps {
    onNavigate: (view: View, mode?: ViewMode) => void;
    modelImage: ImageFile[];
}

const MenuButton: React.FC<{ onClick: () => void, color: string, children: React.ReactNode }> = ({ onClick, color, children }) => (
    <button
        onClick={onClick}
        className={`w-full py-2 px-4 rounded-lg font-semibold text-gray-800 border-2 border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all ${color}`}
    >
        {children}
    </button>
);

export const MainMenu: React.FC<MainMenuProps> = ({ onNavigate, modelImage }) => {
    const placeholderImages = [
        "/public/work_cover.jpeg",
        "/public/weekend_cover.jpeg", 
        modelImage.length > 0 && modelImage[0].preview 
            ? modelImage[0].preview 
            : "/public/clueless.jpeg",
    ];

    return (
        <div className="w-full">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                {placeholderImages.map((src, index) => (
                    <div key={index} className="flex flex-col items-center gap-3">
                        <div className="w-full aspect-[3/4] border-2 border-black rounded-lg overflow-hidden bg-gray-200">
                            <img src={src} alt={`Outfit ${index + 1}`} className="w-full h-full object-cover" />
                        </div>
                    </div>
                ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <MenuButton onClick={() => onNavigate('designer', 'work')} color="bg-pink-300">Work</MenuButton>
                <MenuButton onClick={() => onNavigate('designer', 'weekend')} color="bg-pink-300">Weekend</MenuButton>
                <MenuButton onClick={() => onNavigate('designer', 'weekend')} color="bg-pink-300">
                    <div className="flex items-center justify-center gap-2">
                        <span>Dress Me</span>
                    </div>
                </MenuButton>
            </div>
            <div className="grid grid-cols-4 gap-4 max-w-2xl mx-auto">
                <MenuButton onClick={() => onNavigate('wardrobe')} color="bg-purple-300">My Wardrobe</MenuButton>
                <MenuButton onClick={() => onNavigate('closetManager')} color="bg-blue-300">Manage Closet</MenuButton>
                <MenuButton onClick={() => onNavigate('aiStudio')} color="bg-green-300">Try New Outfits</MenuButton>
                <MenuButton onClick={() => onNavigate('myCreations')} color="bg-yellow-300">Past Looks</MenuButton>
            </div>
        </div>
    );
};