
import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import type { ClosetItem, ImageFile, Base64Image, FavoriteCreation } from "../types";
import { clothingData } from "../data/clothing";
import { ClothingCarousel } from "./ClothingCarousel";
import type { View, ViewMode } from "./MainMenu";
import { ImageUploader } from "./ImageUploader";
import { generateVirtualTryOnHybrid } from "./huggingfaceVirtualTryOn";
import { fileToBase64Image, urlToBase64Image } from "../utils";
import { generateTryOn as generateTryOnGemini } from "../../services/geminiService";

import "../css/designer.css";

const ActionButton: React.FC<{
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}> = ({ onClick, children, className = "designerBtn", disabled = false }) => (
  <button type="button" onClick={onClick} disabled={disabled} className={className}>
    {children}
  </button>
);

export const Designer: React.FC<{
  mode: ViewMode;
  closet: ClosetItem[];
  setCloset: React.Dispatch<React.SetStateAction<ClosetItem[]>>;
  modelImage: ImageFile[];
  setModelImage: React.Dispatch<React.SetStateAction<ImageFile[]>>;
  onNavigate: (view: View, mode?: ViewMode) => void;
  selectedItemIds?: string[];
  userId?: string;
  favoriteCreations: FavoriteCreation[];
  setFavoriteCreations: React.Dispatch<React.SetStateAction<FavoriteCreation[]>>;
}> = ({
  mode,
  closet,
  setCloset, // (kept for API compatibility even if not used here)
  modelImage,
  setModelImage,
  onNavigate,
  selectedItemIds = [],
  userId, // (kept for API compatibility even if not used here)
  favoriteCreations, // (kept for API compatibility even if not used here)
  setFavoriteCreations,
}) => {

  const [upperGarmentIndex, setUpperGarmentIndex] = useState(0);
  const [topIndex, setTopIndex] = useState(0);
  const [bottomIndex, setBottomIndex] = useState(0);
  const [dressIndex, setDressIndex] = useState(0);
  const [shoesIndex, setShoesIndex] = useState(0);

  const [tryOnOutfitType, setTryOnOutfitType] = useState<"dress" | "top-bottom" | null>(null);
  const [isTryOnMode, setIsTryOnMode] = useState(false);

  const [prompt, setPrompt] = useState("");
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const b64CacheRef = useRef<Map<string, Base64Image>>(new Map());
  const inFlightRef = useRef(false);
  const tryOnCountRef = useRef(0);

  const { tops, bottoms, dresses, shoes, upperGarments } = useMemo(() => {
    const defaultWork = clothingData?.work ?? { tops: [], bottoms: [], dresses: [] };
    const defaultWeekend = clothingData?.weekend ?? { tops: [], bottoms: [], dresses: [] };

    const mapClosetItem = (i: ClosetItem) => ({
      source: i.imageUrl, // imageUrl
      style: i.style,
    });

    const closetTops = closet.filter((i) => i.category === "top").map(mapClosetItem);
    const closetBottoms = closet.filter((i) => i.category === "bottoms").map(mapClosetItem);
    const closetDresses = closet.filter((i) => i.category === "dress").map(mapClosetItem);
    const closetShoes = closet.filter((i) => i.category === "shoes").map(mapClosetItem);

    const allTops = [
      ...closetTops,
      ...defaultWork.tops.map((url) => ({ source: url, style: "work" as const })),
      ...defaultWeekend.tops.map((url) => ({ source: url, style: "weekend" as const })),
    ];

    const allBottoms = [
      ...closetBottoms,
      ...((defaultWork.bottoms ?? [])).map((url) => ({ source: url, style: "work" as const })),
      ...((defaultWeekend.bottoms ?? [])).map((url) => ({ source: url, style: "weekend" as const })),
    ];

    const allDresses = [
      ...closetDresses,
      ...defaultWeekend.dresses.map((url) => ({ source: url, style: "weekend" as const })),
    ];

    const allShoes = [...closetShoes];

    let filteredTops: typeof allTops = [];
    let filteredBottoms: typeof allBottoms = [];
    let filteredDresses: typeof allDresses = [];
    let filteredShoes: typeof allShoes = [];

    if (mode === "work") {
      filteredTops = allTops.filter((i) => i.style === "work" || i.style === "both");
      filteredBottoms = allBottoms.filter((i) => i.style === "work" || i.style === "both");
      filteredDresses = allDresses.filter((i) => i.style === "work" || i.style === "both");
      filteredShoes = allShoes.filter((i) => i.style === "work" || i.style === "both");
    } else if (mode === "weekend") {
      filteredTops = allTops.filter((i) => i.style === "weekend" || i.style === "both");
      filteredBottoms = allBottoms.filter((i) => i.style === "weekend" || i.style === "both");
      filteredDresses = allDresses.filter((i) => i.style === "weekend" || i.style === "both");
      filteredShoes = allShoes.filter((i) => i.style === "weekend" || i.style === "both");
    }

    const combinedUpperGarments = [
      ...filteredTops.map((i) => ({ ...i, type: "top" as const })),
      ...filteredDresses.map((i) => ({ ...i, type: "dress" as const })),
    ];

    return {
      tops: filteredTops,
      bottoms: filteredBottoms,
      dresses: filteredDresses,
      shoes: filteredShoes,
      upperGarments: combinedUpperGarments,
    };
  }, [mode, closet]);

  useEffect(() => setUpperGarmentIndex(0), [upperGarments]);
  useEffect(() => setTopIndex(0), [tops]);
  useEffect(() => setBottomIndex(0), [bottoms]);
  useEffect(() => setDressIndex(0), [dresses]);
  useEffect(() => setShoesIndex(0), [shoes]);

  const currentUpperGarment =
    upperGarments.length > 0
      ? upperGarmentIndex < upperGarments.length
        ? upperGarments[upperGarmentIndex]
        : upperGarments[0]
      : null;

  const isBrowsingDress = currentUpperGarment?.type === "dress";

  const handleEnterTryOn = () => {
    if (!currentUpperGarment) return;

    if (isBrowsingDress) {
      const idx = dresses.findIndex((d) => d.source === currentUpperGarment.source);
      setDressIndex(idx >= 0 ? idx : 0);
      setTryOnOutfitType("dress");
    } else {
      const idx = tops.findIndex((t) => t.source === currentUpperGarment.source);
      setTopIndex(idx >= 0 ? idx : 0);
      setTryOnOutfitType("top-bottom");
    }

    setGeneratedImage(null);
    setError(null);
    setIsTryOnMode(true);
  };

  const handleBackToBrowse = () => {
    setIsTryOnMode(false);
    setTryOnOutfitType(null);
    setGeneratedImage(null);
    setError(null);
  };

  const createIndexChanger =
    (setter: React.Dispatch<React.SetStateAction<number>>, max: number) =>
    (direction: "next" | "prev") => {
      if (max === 0) return;
      setter((prev) => {
        const newIndex = direction === "next" ? prev + 1 : prev - 1;
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

  const convertSourceToBase64 = useCallback(
    async (source: string): Promise<Base64Image> => {
      if (!source) return { base64: "", mimeType: "image/png" };

      const cached = b64CacheRef.current.get(source);
      if (cached) return cached;

      let result: Base64Image;

      if (source.startsWith("data:image")) {
        const [header, data] = source.split(",");
        const mimeType = header.match(/data:(.*?);base64/)?.[1] ?? "image/png";
        result = { base64: data ?? "", mimeType };
      } else if (source.length > 500 && !source.startsWith("/") && !source.startsWith("http")) {
        // raw base64
        result = { base64: source, mimeType: "image/png" };
      } else if (source.startsWith("/")) {
        const response = await fetch(source);
        const blob = await response.blob();
        result = await fileToBase64Image(blob);
      } else if (source.startsWith("http")) {
        result = await urlToBase64Image(source);
      } else {
        result = { base64: source, mimeType: "image/png" };
      }

      b64CacheRef.current.set(source, result);
      return result;
    },
    []
  );

  const handleGenerate = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    if (modelImage.length === 0) {
      setError("Please upload a model image.");
      inFlightRef.current = false;
      return;
    }

    if (!tryOnOutfitType) {
      setError("Please select an outfit type (dress or top-bottom).");
      inFlightRef.current = false;
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedImage(null);

    try {
      const fileInput = modelImage[0]?.file;
      if (!fileInput) throw new Error("No file in modelImage");

      const modelB64 = await fileToBase64Image(fileInput);
      const clothingToSend: Base64Image[] = [];
      const itemsToUse =
        selectedItemIds && selectedItemIds.length > 0
          ? closet.filter((item) => selectedItemIds.includes(item.id))
          : [];

      if (tryOnOutfitType === "dress") {
        const selectedDress = itemsToUse.find((item) => item.category === "dress");
        const dressSource = selectedDress?.imageUrl ?? dresses[dressIndex]?.source;

        if (!dressSource) throw new Error("No dress selected.");
        const dressB64 = await convertSourceToBase64(dressSource);
        clothingToSend.push(dressB64);
      }

      if (tryOnOutfitType === "top-bottom") {
        const selectedTop = itemsToUse.find((item) => item.category === "top");
        const topSource = selectedTop?.imageUrl ?? tops[topIndex]?.source;

        if (!topSource) throw new Error("No top selected.");
        const topB64 = await convertSourceToBase64(topSource);
        clothingToSend.push(topB64); // top first

        const selectedBottom = itemsToUse.find((item) => item.category === "bottoms");
        const bottomSource = selectedBottom?.imageUrl ?? bottoms[bottomIndex]?.source;

        if (!bottomSource) throw new Error("No bottoms selected.");
        const bottomB64 = await convertSourceToBase64(bottomSource);
        clothingToSend.push(bottomB64); // bottom second
      }

      if (clothingToSend.length === 0) throw new Error("No clothing items to generate.");

      const effectivePrompt = prompt.trim()
        ? `Person wearing outfit. ${prompt}`
        : `Person wearing outfit. Professional fashion photography.`;

      const useGemini = tryOnCountRef.current < 2;
      let rawResult: string | null = null;

      if (useGemini) {
        tryOnCountRef.current += 1;

        const modelDataUrl = `data:${modelB64.mimeType};base64,${modelB64.base64}`;
        const topDataUrl = clothingToSend[0]
          ? `data:${clothingToSend[0].mimeType};base64,${clothingToSend[0].base64}`
          : undefined;
        const bottomDataUrl = clothingToSend[1]
          ? `data:${clothingToSend[1].mimeType};base64,${clothingToSend[1].base64}`
          : undefined;

        try {
          rawResult = await generateTryOnGemini(modelDataUrl, topDataUrl, bottomDataUrl);
        } catch (gemErr) {
          console.error("❌ Gemini try-on failed, will fallback to HF:", gemErr);
        }
      }

      if (!rawResult) {
        rawResult = await generateVirtualTryOnHybrid(modelB64.base64, clothingToSend, effectivePrompt);
      }

      if (!rawResult) throw new Error("Virtual try-on returned no image data.");

      const cleaned = String(rawResult).replace(/\s/g, "");
      const imageSrc = cleaned.startsWith("data:image") ? cleaned : `data:image/png;base64,${cleaned}`;

      setGeneratedImage(imageSrc);

      setFavoriteCreations((prev) => [
        {
          id: crypto.randomUUID(),
          image: imageSrc,
          createdAt: Date.now(),
          outfit: { type: "designer" },
        },
        ...prev,
      ]);
    } catch (e: any) {
      console.error("❌ DESIGNER ERROR:", e?.message);
      setError(e?.message || "An unexpected error occurred during image generation.");
    } finally {
      inFlightRef.current = false;
      setIsLoading(false);
    }
  }, [
    modelImage,
    tryOnOutfitType,
    closet,
    selectedItemIds,
    dresses,
    dressIndex,
    tops,
    topIndex,
    bottoms,
    bottomIndex,
    prompt,
    convertSourceToBase64,
    setFavoriteCreations,
  ]);

  const renderModelPanel = () => {
    if (isLoading) {
      return (
        <div className="designerModel designerModel--loading">
          <svg className="designerSpinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="designerSpinner__track" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="designerSpinner__head" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="designerLoadingTitle">Generating your look...</p>
          <p className="designerLoadingSub">This may take 30–60 seconds</p>
        </div>
      );
    }

    if (generatedImage) {
      return (
        <div className="designerModel designerModel--result">
          <img src={generatedImage} alt="Generated Outfit" className="designerModelImg" />
        </div>
      );
    }

    return (
      <div className="designerModel designerModel--uploader">
        <ImageUploader
          images={modelImage}
          onImagesUpload={(files) => setModelImage(files.length > 0 ? [files[0]] : [])}
          label="Upload a Photo of Your Model"
          multiple={false}
          helpText="Use a clear, full-body shot"
        />
      </div>
    );
  };

if (isTryOnMode) {
  const canDressMe = !isLoading && modelImage.length > 0 && !!tryOnOutfitType;
  return (
    <div className="designer designer--tryon">
      <div className="designerTopbar">
        <button
          type="button"
          onClick={handleBackToBrowse}
          className="designerTopbar__btn designerTopbar__btn--left"
          disabled={isLoading}
        >
          &larr; Back
        </button>

        <button
          type="button"
          onClick={handleGenerate}
          className="designerTopbar__btn designerTopbar__btn--primary designerTopbar__btn--right"
          disabled={!canDressMe}
          title={
            modelImage.length === 0
              ? "Upload a model photo first"
              : !tryOnOutfitType
              ? "Pick dress or top + bottoms"
              : undefined
          }
        >
          Dress Me
        </button>
      </div>

      <div className="designerTryOn__wrap">
        <div className="designerTryOn__grid">
          <div className="designerTryOn__left">
            <div className="designerTryOn__leftGrow">
              {tryOnOutfitType === "dress" ? (
                <>
                  <ClothingCarousel
                    title="Dress"
                    items={dresses}
                    currentIndex={dressIndex}
                    onNext={() => handleNextDress("next")}
                    onPrev={() => handlePrevDress("prev")}
                  />
                  <ClothingCarousel
                    title="Shoes"
                    items={shoes}
                    currentIndex={shoesIndex}
                    onNext={() => handleNextShoes("next")}
                    onPrev={() => handlePrevShoes("prev")}
                  />
                </>
              ) : (
                <>
                  <ClothingCarousel
                    title="Top"
                    items={tops}
                    currentIndex={topIndex}
                    onNext={() => handleNextTop("next")}
                    onPrev={() => handlePrevTop("prev")}
                  />
                  <ClothingCarousel
                    title="Bottom"
                    items={bottoms}
                    currentIndex={bottomIndex}
                    onNext={() => handleNextBottom("next")}
                    onPrev={() => handlePrevBottom("prev")}
                  />
                </>
              )}
            </div>
          </div>

          <div className="designerTryOn__right">
            {renderModelPanel()}

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Optional: Add specific instructions..."
              rows={3}
              className="designerTryOn__prompt"
            />

            {error && <p className="designerTryOn__error">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
return (
  <div className="designer designer--browse">
    <div className="designerTopbar">
      <button
        type="button"
        onClick={() => onNavigate("closetManager")}
        className="designerTopbar__btn designerTopbar__btn--left"
      >
        &larr; Back
      </button>
          <div className="designer__center">
      <div className="designer__inner">
        {upperGarments.length > 0 ? (
          <>
            <ClothingCarousel
              title={isBrowsingDress ? "Dress" : "Top"}
              items={upperGarments}
              currentIndex={upperGarmentIndex}
              onNext={() => handleNextUpperGarment("next")}
              onPrev={() => handlePrevUpperGarment("prev")}
            />

            {isBrowsingDress ? (
              <ClothingCarousel
                title="Shoes"
                items={shoes}
                currentIndex={shoesIndex}
                onNext={() => handleNextShoes("next")}
                onPrev={() => handlePrevShoes("prev")}
              />
            ) : (
              <ClothingCarousel
                title="Bottom"
                items={bottoms}
                currentIndex={bottomIndex}
                onNext={() => handleNextBottom("next")}
                onPrev={() => handlePrevBottom("prev")}
              />
            )}
          </>
        ) : (
          <div className="designer__empty">
            <p className="designer__emptyTitle">No items found for this category.</p>
            <p className="designer__emptySub">Go to the Closet Manager to add items!</p>
          </div>
        )}
      </div>
    </div> 
      <button
        type="button"
        onClick={handleEnterTryOn}
        className="designerTopbar__btn designerTopbar__btn--primary designerTopbar__btn--right"
        disabled={upperGarments.length === 0}
        title={upperGarments.length === 0 ? "No items available" : undefined}
      >
        Dress Me
      </button>
    </div>
  </div>
);

};

export default Designer;
