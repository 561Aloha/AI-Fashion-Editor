import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { ClosetItem, ImageFile, Base64Image, FavoriteCreation } from '../types';
import { clothingData } from '../data/clothing';
import { ClothingCarousel } from './ClothingCarousel';
import type { View, ViewMode } from './MainMenu';
import { ImageUploader } from './ImageUploader';
import { generateFashionImage } from './geminiService';
import { fileToBase64Image, urlToBase64Image } from '../utils';

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
    if (source.length > 500) { // Heuristic for b64
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
    }> = ({ mode, closet, setCloset, modelImage, setModelImage, onNavigate }) => {

    
    const [upperGarmentIndex, setUpperGarmentIndex] = useState(0);
    const [topIndex, setTopIndex] = useState(0);
    const [bottomIndex, setBottomIndex] = useState(0);
    const [dressIndex, setDressIndex] = useState(0);
    const [shoesIndex, setShoesIndex] = useState(0);

    const [tryOnOutfitType, setTryOnOutfitType] = useState<'dress' | 'top-bottom' | null>(null);
    const [isTryOnMode, setTryOnMode] = useState(false);
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
        setTryOnMode(true);
    };

    const handleGenerate = useCallback(async () => {
        console.log('[DEBUG: Designer] handleGenerate triggered.');
        if (modelImage.length === 0) {
            setError("Please upload a model image.");
            return;
        }

        const itemsToProcess: string[] = [];
        
        if (tryOnOutfitType === 'dress') {
            if (dresses.length > 0) itemsToProcess.push(dresses[dressIndex].source);
            if (shoes.length > 0) itemsToProcess.push(shoes[shoesIndex].source);
        } else if (tryOnOutfitType === 'top-bottom') {
            if (tops.length > 0) itemsToProcess.push(tops[topIndex].source);
            if (bottoms.length > 0) itemsToProcess.push(bottoms[bottomIndex].source);
        }
        
        if (itemsToProcess.length === 0) {
            setError("No clothing items to generate.");
            return;
        }

        const effectivePrompt = prompt.trim() || "Photoshop the selected clothing onto the model realistically.";
        console.log('[DEBUG: Designer] Generation parameters:', { tryOnOutfitType, itemsToProcess, prompt: effectivePrompt });

        setIsLoading(true);
        setError(null);
        setGeneratedImage(null);

        try {
            const modelB64 = await fileToBase64Image(modelImage[0].file);
            const clothingB64s: Base64Image[] = await Promise.all(
                itemsToProcess.map(async (source) => {
                    if (source.startsWith('data:image')) {
                        return { base64: source.split(',')[1], mimeType: 'image/png' };
                    }
                    if (source.length > 500) { 
                        return { base64: source, mimeType: 'image/png' };
                    }
                    return await urlToBase64Image(source);
                })
            );

            const resultB64 = await generateFashionImage(modelB64.base64, clothingB64s, effectivePrompt);
            const imageSrc = `data:image/png;base64,${resultB64}`;
            setGeneratedImage(imageSrc);
            console.log('[DEBUG: Designer] Image generation successful. Result snippet:', imageSrc.substring(0, 50) + '...');

        } catch (e: any) {
            setError(e.message || "An unexpected error occurred during image generation.");
            console.error('[DEBUG: Designer] Error during generation:', e);
        } finally {
            setIsLoading(false);
        }
    }, [modelImage, tryOnOutfitType, dresses, dressIndex, tops, topIndex, bottoms, bottomIndex, shoes, shoesIndex, prompt]);
    
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
                    {/* FIX: Replaced a malformed SVG causing JSX parsing errors with a correct spinner SVG. */}
                    <svg className="animate-spin h-10 w-10 text-purple-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="mt-3 text-lg font-semibold text-gray-700">Generating your look...</p>
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
                    onClick={() => { setTryOnMode(false); setTryOnOutfitType(null); setGeneratedImage(null); setError(null); }} 
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