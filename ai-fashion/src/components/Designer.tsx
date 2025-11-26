import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { ClosetItem, ImageFile, Base64Image, FavoriteCreation } from '../types';
import { clothingData } from '../data/clothing';
import { ClothingCarousel } from './ClothingCarousel';
import type { View, ViewMode } from './MainMenu';
import { ImageUploader } from './ImageUploader';
import { generateVirtualTryOnHybrid } from './huggingfaceVirtualTryOn';
import { fileToBase64Image, urlToBase64Image } from '../utils';

// ============ IMAGE COMPRESSION FUNCTION ============
const compressBase64Image = async (base64: string, maxWidth = 600, maxHeight = 800, quality = 0.55): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = `data:image/png;base64,${base64}`;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width *= maxHeight / height;
                    height = maxHeight;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            const compressed = reader.result as string;
                            resolve(compressed.split(',')[1]);
                        };
                        reader.readAsDataURL(blob);
                    }
                },
                'image/jpeg',
                quality
            );
        };
    });
};

const ActionButton: React.FC<{
    onClick: () => void;
    children: React.ReactNode;
    color?: string;
    disabled?: boolean;
}> = ({ onClick, children, color = "bg-pink-300", disabled=false }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={`py-2 px-8 rounded-lg font-semibold text-gray-800 border-2 border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[3px] hover:translate-y-[3px] transition-all ${color} disabled:bg-gray-400 disabled:shadow-none disabled:translate-y-0 disabled:translate-x-0 disabled:cursor-not-allowed`}
    >
        {children}
    </button>
);

const getImageSrc = (source: string) => {
    if (!source) return '';
    if (source.startsWith('data:image')) return source;
    if (source.length > 500) {
        return `data:image/png;base64,${source}`;
    }
    return source;
};

export const Designer: React.FC<{ 
    mode: ViewMode;
    closet: ClosetItem[];
    setCloset: React.Dispatch<React.SetStateAction<ClosetItem[]>>;
    modelImage: ImageFile[];
    setModelImage: React.Dispatch<React.SetStateAction<ImageFile[]>>;
    onNavigate: (view: View, mode?: ViewMode) => void;
    selectedItemIds?: string[];
    }> = ({ mode, closet, setCloset, modelImage, setModelImage, onNavigate, selectedItemIds = [] }) => {

    const [upperGarmentIndex, setUpperGarmentIndex] = useState(0);
    const [topIndex, setTopIndex] = useState(0);
    const [bottomIndex, setBottomIndex] = useState(0);
    const [dressIndex, setDressIndex] = useState(0);
    const [shoesIndex, setShoesIndex] = useState(0);

    const [tryOnOutfitType, setTryOnOutfitType] = useState<'dress' | 'top-bottom' | null>(null);
    const [isTryOnMode, setIsTryOnMode] = useState(false);
    const [prompt, setPrompt] = useState<string>('');
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { tops, bottoms, dresses, shoes, upperGarments } = useMemo(() => {
        const defaultWork = clothingData.work;
        const defaultWeekend = clothingData.weekend;

        const mapClosetItem = (i: ClosetItem) => ({ source: i.imageB64, style: i.style });
        const closetTops = closet.filter(i => i.category === 'top').map(mapClosetItem);
        const closetBottoms = closet.filter(i => i.category === 'bottoms').map(mapClosetItem);
        const closetDresses = closet.filter(i => i.category === 'dress').map(mapClosetItem);
        const closetShoes = closet.filter(i => i.category === 'shoes').map(mapClosetItem);

        const allTops = [
            ...closetTops,
            ...defaultWork.tops.map(url => ({ source: url, style: 'work' as const })),
            ...defaultWeekend.tops.map(url => ({ source: url, style: 'weekend' as const }))
        ];
        const allBottoms = [
            ...closetBottoms,
            ...defaultWork.bottoms.map(url => ({ source: url, style: 'work' as const })),
            ...defaultWeekend.bottoms.map(url => ({ source: url, style: 'weekend' as const }))
        ];
        
        const allDresses = [
            ...closetDresses,
            ...defaultWeekend.dresses.map(url => ({ source: url, style: 'weekend' as const }))
        ];
        
        const allShoes = [...closetShoes];

        let filteredTops, filteredBottoms, filteredDresses, filteredShoes;

        switch (mode) {
            case 'work':
                filteredTops = allTops.filter(i => i.style === 'work' || i.style === 'both');
                filteredBottoms = allBottoms.filter(i => i.style === 'work' || i.style === 'both');
                filteredDresses = allDresses.filter(i => i.style === 'work' || i.style === 'both');
                filteredShoes = allShoes.filter(i => i.style === 'work' || i.style === 'both');
                break;
            case 'weekend':
                filteredTops = allTops.filter(i => i.style === 'weekend' || i.style === 'both');
                filteredBottoms = allBottoms.filter(i => i.style === 'weekend' || i.style === 'both');
                filteredDresses = allDresses.filter(i => i.style === 'weekend' || i.style === 'both');
                filteredShoes = allShoes.filter(i => i.style === 'weekend' || i.style === 'both');
                break;
            default:
                filteredTops = [];
                filteredBottoms = [];
                filteredDresses = [];
                filteredShoes = [];
                break;
        }

        const combinedUpperGarments = [
            ...filteredTops.map(i => ({ ...i, type: 'top' as const })),
            ...filteredDresses.map(i => ({ ...i, type: 'dress' as const })),
        ];

        return { tops: filteredTops, bottoms: filteredBottoms, dresses: filteredDresses, shoes: filteredShoes, upperGarments: combinedUpperGarments };
    }, [mode, closet]);

    useEffect(() => { setUpperGarmentIndex(0); }, [upperGarments]);
    useEffect(() => { setTopIndex(0); }, [tops]);
    useEffect(() => { setBottomIndex(0); }, [bottoms]);
    useEffect(() => { setDressIndex(0); }, [dresses]);
    useEffect(() => { setShoesIndex(0); }, [shoes]);
    
    const currentUpperGarment = upperGarments.length > 0 ? upperGarments[upperGarmentIndex] : null;
    const isBrowsingDress = currentUpperGarment?.type === 'dress';

    const handleEnterTryOn = () => {
        if (!currentUpperGarment) return;

        if (isBrowsingDress) {
            const currentDressInDressesArray = dresses.findIndex(d => d.source === currentUpperGarment.source);
            setDressIndex(currentDressInDressesArray >= 0 ? currentDressInDressesArray : 0);
            setTryOnOutfitType('dress');
        } else {
            const currentTopInTopsArray = tops.findIndex(t => t.source === currentUpperGarment.source);
            setTopIndex(currentTopInTopsArray >= 0 ? currentTopInTopsArray : 0);
            setTryOnOutfitType('top-bottom');
        }
        setIsTryOnMode(true);
    };
    // Helper function to convert any source (URL, path, or base64) to Base64Image
    const convertSourceToBase64 = async (source: string): Promise<Base64Image> => {
        // If it's already base64 (long string without slashes)
        if (source.length > 500 && !source.startsWith('/') && !source.startsWith('http')) {
            return {
                base64: source,
                mimeType: 'image/png'
            };
        }
        
        // local inital clothing URL before they populate with their own items
        if (source.startsWith('/')) {
            const response = await fetch(source);
            const blob = await response.blob();
            return await fileToBase64Image(blob);
        }
        
        if (source.startsWith('http')) {
            return await urlToBase64Image(source);
        }
        
        return {
            base64: source,
            mimeType: 'image/png'
        };
    };
    const handleGenerate = useCallback(async () => {
        console.log('🎨 DESIGNER: handleGenerate triggered.');
        if (modelImage.length === 0) {
            setError("Please upload a model image.");
            return;
        }

        const clothingToSend: Base64Image[] = [];
        
        // Filter to only selected items if any are selected
        const itemsToUse = selectedItemIds && selectedItemIds.length > 0 
            ? closet.filter(item => selectedItemIds.includes(item.id))
            : [];

        if (tryOnOutfitType === 'dress') {
            const selectedDress = itemsToUse.find(item => item.category === 'dress');
            if (selectedDress) {
                // imageB64 is already a base64 string stored in closet
                clothingToSend.push({
                    base64: selectedDress.imageB64,
                    mimeType: 'image/png'
                });
            } else if (dresses.length > 0) {
                const dressSource = dresses[dressIndex].source;
                // ← FIX: Check if it's a URL/path or base64
                const dressB64 = await convertSourceToBase64(dressSource);
                clothingToSend.push(dressB64);
            }
        } else if (tryOnOutfitType === 'top-bottom') {
            const selectedTop = itemsToUse.find(item => item.category === 'top');
            if (selectedTop) {
                clothingToSend.push({
                    base64: selectedTop.imageB64,
                    mimeType: 'image/png'
                });
            } else if (tops.length > 0) {
                const topSource = tops[topIndex].source;
                // ← FIX: Check if it's a URL/path or base64
                const topB64 = await convertSourceToBase64(topSource);
                clothingToSend.push(topB64);
            }

            const selectedBottom = itemsToUse.find(item => item.category === 'bottoms');
            if (selectedBottom) {
                clothingToSend.push({
                    base64: selectedBottom.imageB64,
                    mimeType: 'image/png'
                });
            } else if (bottoms.length > 0) {
                const bottomSource = bottoms[bottomIndex].source;
                // ← FIX: Check if it's a URL/path or base64
                const bottomB64 = await convertSourceToBase64(bottomSource);
                clothingToSend.push(bottomB64);
            }
        }
        
        if (clothingToSend.length === 0) {
            setError("No clothing items to generate.");
            return;
        }

        const effectivePrompt = prompt.trim() 
            ? `Person wearing outfit. ${prompt}`
            : `Person wearing outfit. Professional fashion photography.`;

        setIsLoading(true);
        setError(null);
        setGeneratedImage(null);

        try {
            console.log('🎨 DESIGNER: Converting model image to base64...');
            
            const fileInput = modelImage[0]?.file;
            if (!fileInput) {
                throw new Error('No file in modelImage');
            }

            let modelB64 = await fileToBase64Image(fileInput);
            console.log('🎨 DESIGNER: Model image converted');
            console.log('🎨 DESIGNER: Base64 length:', modelB64.base64.length);
            console.log('🎨 DESIGNER: Clothing items count:', clothingToSend.length);

            console.log('🎨 DESIGNER: Calling Hugging Face Virtual Try-On...');
            const resultB64 = await generateVirtualTryOnHybrid(
                modelB64.base64,
                clothingToSend,
                effectivePrompt
            );
            
            const imageSrc = `data:image/png;base64,${resultB64}`;
            setGeneratedImage(imageSrc);
            console.log('🎨 DESIGNER: Image generation successful!');

        } catch (e: any) {
            console.error('❌ DESIGNER ERROR:', e.message);
            setError(e.message || "An unexpected error occurred during image generation.");
            console.error('[DEBUG: Designer] Error during generation:', e);
        } finally {
            setIsLoading(false);
        }
    }, [modelImage, tryOnOutfitType, closet, selectedItemIds, dresses, dressIndex, tops, topIndex, bottoms, bottomIndex, prompt]);
        const createIndexChanger = (setter: React.Dispatch<React.SetStateAction<number>>, max: number) => (direction: 'next' | 'prev') => {
            if (max === 0) return;
            setter(prev => {
                const newIndex = direction === 'next' ? prev + 1 : prev - 1;
                if (newIndex >= max) return 0;
                if (newIndex < 0) return max - 1;
                return newIndex;
            });
        };
    
    const handleNextUpperGarment = createIndexChanger(setUpperGarmentIndex, upperGarments.length);
    const handlePrevUpperGarment = createIndexChanger(setUpperGarmentIndex, upperGarments.length);
    const handleNextTop = createIndexChanger(setTopIndex, tops.length);
    const handlePrevTop = createIndexChanger(setTopIndex, tops.length);
    const handleNextBottom = createIndexChanger(setBottomIndex, bottoms.length);
    const handlePrevBottom = createIndexChanger(setBottomIndex, bottoms.length);
    const handleNextDress = createIndexChanger(setDressIndex, dresses.length);
    const handlePrevDress = createIndexChanger(setDressIndex, dresses.length);
    const handleNextShoes = createIndexChanger(setShoesIndex, shoes.length);
    const handlePrevShoes = createIndexChanger(setShoesIndex, shoes.length);

    const renderModelPanel = () => {
        if (isLoading) {
            return (
                <div className="w-full aspect-[3/4] border-2 border-black rounded-lg bg-gray-200 flex flex-col items-center justify-center text-center p-4">
                    <svg className="animate-spin h-10 w-10 text-purple-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="mt-3 text-lg font-semibold text-gray-700">Generating your look...</p>
                    <p className="text-sm text-gray-600 mt-2">This may take 30-60 seconds</p>
                </div>
            );
        }
        if (generatedImage) {
            return (
                <div className="w-full aspect-[3/4] border-2 border-black rounded-lg overflow-hidden bg-gray-200 relative group">
                    <img src={generatedImage} alt="Generated Outfit" className="w-full h-full object-cover" />
                </div>
            )
        }
        return (
            <ImageUploader
                images={modelImage}
                onImagesUpload={(files) => setModelImage(files.length > 0 ? [files[0]] : [])}
                label="Upload a Photo of Your Model"
                multiple={false}
                helpText="Use a clear, full-body shot"
            />
        )
    }

    if (isTryOnMode) {
        return (
            <div className="w-full text-gray-800 relative">
                <button 
                    onClick={() => { setIsTryOnMode(false); setTryOnOutfitType(null); setGeneratedImage(null); setError(null); }} 
                    className="absolute top-[-24px] left-0 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-1 px-3 rounded-lg transition-all border-2 border-black text-sm z-10 shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                >
                    &larr; Back to Browse
                </button>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Left Column: Clothing */}
                    <div className="space-y-4 flex flex-col">
                        <div className="flex-grow space-y-4">
                           {tryOnOutfitType === 'dress' ? (
                                <>
                                    <ClothingCarousel
                                        title="Dress"
                                        items={dresses}
                                        currentIndex={dressIndex}
                                        onNext={() => handleNextDress('next')}
                                        onPrev={() => handlePrevDress('prev')}
                                    />
                                    <ClothingCarousel
                                        title="Shoes"
                                        items={shoes}
                                        currentIndex={shoesIndex}
                                        onNext={() => handleNextShoes('next')}
                                        onPrev={() => handlePrevShoes('prev')}
                                    />
                                </>
                            ) : (
                                <>
                                    <ClothingCarousel
                                        title="Top"
                                        items={tops}
                                        currentIndex={topIndex}
                                        onNext={() => handleNextTop('next')}
                                        onPrev={() => handlePrevTop('prev')}
                                    />
                                    <ClothingCarousel
                                        title="Bottom"
                                        items={bottoms}
                                        currentIndex={bottomIndex}
                                        onNext={() => handleNextBottom('next')}
                                        onPrev={() => handlePrevBottom('prev')}
                                    />
                                </>
                            )}
                        </div>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Optional: Add specific instructions..."
                            className="w-full p-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                            rows={2}
                        />
                        <ActionButton onClick={handleGenerate} color="bg-green-400" disabled={isLoading || modelImage.length === 0}>
                            Dress Me
                        </ActionButton>
                    </div>

                    {/* Right Column: Model */}
                    <div className="space-y-4">
                        {renderModelPanel()}
                        {error && <p className="text-red-500 text-sm text-center pt-2">{error}</p>}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="w-full text-gray-800 flex flex-col items-center justify-center relative">
            <div className="w-full max-w-xs space-y-4">
                {upperGarments.length > 0 ? (
                    <>
                        <ClothingCarousel
                            title={isBrowsingDress ? "Dress" : "Top"}
                            items={upperGarments}
                            currentIndex={upperGarmentIndex}
                            onNext={() => handleNextUpperGarment('next')}
                            onPrev={() => handlePrevUpperGarment('prev')}
                        />
                        {isBrowsingDress ? (
                            <ClothingCarousel
                                title="Shoes"
                                items={shoes}
                                currentIndex={shoesIndex}
                                onNext={() => handleNextShoes('next')}
                                onPrev={() => handlePrevShoes('prev')}
                            />
                        ) : (
                             <ClothingCarousel
                                title="Bottom"
                                items={bottoms}
                                currentIndex={bottomIndex}
                                onNext={() => handleNextBottom('next')}
                                onPrev={() => handlePrevBottom('prev')}
                            />
                        )}
                        <div className="flex w-full items-center justify-between pt-2">
                            <ActionButton onClick={() => onNavigate('closetManager')}>Browse</ActionButton>
                            <ActionButton onClick={handleEnterTryOn}>Dress Me</ActionButton>
                        </div>
                    </>
                ) : (
                    <div className="text-center text-gray-500 py-10 h-[400px] flex flex-col justify-center">
                         <p className="font-semibold">No items found for this category.</p>
                        <p className="text-sm mt-2">Go to the Closet Manager to add items!</p>
                    </div>
                )}
            </div>
        </div>
    );
};