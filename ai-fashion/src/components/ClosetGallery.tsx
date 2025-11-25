import React from 'react';
import type { ClosetItem, ClosetCategory } from '../types';
import type { View, ViewMode } from './MainMenu';

interface ClosetGalleryProps {
  onBack: () => void;
  closet: ClosetItem[];
  selectedItemIds: string[];
  onToggleSelect: (itemId: string) => void;
  onNavigate: (view: View, mode?: ViewMode) => void;
}

const CATEGORIES: ClosetCategory[] = ['top', 'bottoms', 'dress', 'shoes'];

export const ClosetGallery: React.FC<ClosetGalleryProps> = ({ 
    onBack, 
    closet, 
    selectedItemIds, 
    onToggleSelect,
    onNavigate
}) => {
    
    if(closet.length === 0) {
        return (
            <div className="w-full h-full relative">
                 <button 
                    onClick={onBack} 
                    className="absolute top-[-24px] right-0 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-1 px-3 rounded-lg transition-all border-2 border-black text-sm z-10 shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                >
                    Main Menu
                </button>
                <div className="flex flex-col items-center justify-center h-[400px] bg-gray-100 rounded-md p-4 text-center">
                    <p className="text-gray-500 text-lg mb-4">Your wardrobe is empty.</p>
                    <button 
                        onClick={() => onNavigate('closetManager')}
                        className="bg-blue-500 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-600 transition"
                    >
                        Add Items
                    </button>
                </div>
            </div>
        )
    }

    const handleDressMe = () => {
        // Navigate to designer, defaults to 'weekend' or a generic mode, 
        // but the designer will prioritize the selected IDs.
        onNavigate('designer', 'weekend');
    };

    return (
        <div className="w-full h-full relative flex flex-col min-h-[500px]">
             <button 
                onClick={onBack} 
                className="absolute top-[-24px] right-0 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-1 px-3 rounded-lg transition-all border-2 border-black text-sm z-10 shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
            >
                Main Menu
            </button>

            <div className="mb-4">
                <h2 className="text-2xl font-bold text-gray-800">Your Wardrobe</h2>
                <p className="text-gray-600 text-sm">Select items to mix and match in the Designer.</p>
            </div>

            <div className="flex-grow overflow-y-auto pb-20 pr-2">
                {CATEGORIES.map(category => {
                    const itemsInCategory = closet.filter(item => item.category === category);
                    if (itemsInCategory.length === 0) return null;

                    return (
                        <div key={category} className="mb-6">
                            <h4 className="font-bold text-gray-500 uppercase tracking-wide text-xs mb-3 border-b border-gray-200 pb-1">{category}</h4>
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                                {itemsInCategory.map(item => {
                                    const isSelected = selectedItemIds.includes(item.id);
                                    return (
                                        <div
                                            key={item.id}
                                            onClick={() => onToggleSelect(item.id)}
                                            className={`
                                                relative aspect-square rounded-xl overflow-hidden cursor-pointer transition-all duration-200
                                                bg-white shadow-sm border-2
                                                ${isSelected 
                                                    ? 'border-green-500 shadow-[0_0_0_2px_rgba(34,197,94,0.5)] scale-95' 
                                                    : 'border-transparent hover:border-gray-300 hover:shadow-md'
                                                }
                                            `}
                                        >
                                            <img 
                                                src={`data:image/png;base64,${item.imageB64}`} 
                                                alt={`Closet item ${item.id}`} 
                                                className="w-full h-full object-contain p-2" 
                                            />
                                            {isSelected && (
                                                <div className="absolute top-1 right-1 bg-green-500 text-white rounded-full p-0.5 shadow-sm">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
            
            {/* Floating Action Bar */}
            <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-gray-200 p-4 flex items-center justify-between shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] rounded-b-xl">
                 <div className="text-sm font-semibold text-gray-700">
                    {selectedItemIds.length} item{selectedItemIds.length !== 1 ? 's' : ''} selected
                 </div>
                 <button
                    onClick={handleDressMe}
                    disabled={selectedItemIds.length === 0}
                    className="py-2 px-6 bg-green-500 text-white font-bold rounded-lg border-2 border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all disabled:bg-gray-400 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0 disabled:cursor-not-allowed"
                 >
                    Dress Selected
                 </button>
            </div>
        </div>
    );
};