import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { RewindIcon, PauseIcon, PlayIcon, FastForwardIcon } from "./icons";
import "../clothingCarousel.css";

interface CarouselItem {
  source?: string;
}

interface ClothingCarouselProps {
  items: CarouselItem[];
  currentIndex: number;
  onNext: () => void;
  onPrev: () => void;
  title: string;
  autoPlayMs?: number;
}

type Dir = "next" | "prev";

export const ClothingCarousel: React.FC<ClothingCarouselProps> = ({
  items,
  currentIndex,
  onNext,
  onPrev,
  title,
  autoPlayMs = 1200,
}) => {
  const hasItems = items.length > 0;
  const canMove = items.length > 1;

  const safeIndex = hasItems
    ? (currentIndex % items.length + items.length) % items.length
    : 0;

  // Normalize image src
  const getSrc = (item?: CarouselItem | null) => {
    const src = item?.source?.trim();
    if (!src) return "";
    if (src.startsWith("data:image")) return src;
    if (src.length > 500 && !src.startsWith("/") && !src.startsWith("http")) {
      return `data:image/png;base64,${src}`;
    }
    return src;
  };

  const currentItem = hasItems ? items[safeIndex] : null;
  const currentSrc = useMemo(() => getSrc(currentItem), [currentItem]);

  // ---- Transition state (ONLY when animating) ----
  const [transition, setTransition] = useState<{
    active: boolean;
    fromSrc: string;
    toSrc: string;
    dir: Dir;
    key: number;
  }>({
    active: false,
    fromSrc: "",
    toSrc: "",
    dir: "next",
    key: 0,
  });

  // If items/currentIndex changes from outside (mode switch / reset),
  // kill any transition and just show the current image.
  const lastSignatureRef = useRef<string>("");
  useEffect(() => {
    const sig = `${items.length}|${safeIndex}|${currentSrc}`;
    if (lastSignatureRef.current && lastSignatureRef.current !== sig) {
      setTransition((t) => (t.active ? { ...t, active: false } : t));
    }
    lastSignatureRef.current = sig;
  }, [items.length, safeIndex, currentSrc]);

  // ---- Stable refs for autoplay callbacks ----
  const onNextRef = useRef(onNext);
  const onPrevRef = useRef(onPrev);
  useEffect(() => {
    onNextRef.current = onNext;
    onPrevRef.current = onPrev;
  }, [onNext, onPrev]);

  const [isPlaying, setIsPlaying] = useState(false);

  const startTransition = useCallback(
    (dir: Dir) => {
      if (!canMove || !hasItems) return;

      const from = currentSrc;
      const nextIndex = (safeIndex + 1) % items.length;
      const prevIndex = (safeIndex - 1 + items.length) % items.length;
      const targetItem = dir === "next" ? items[nextIndex] : items[prevIndex];
      const to = getSrc(targetItem) || from;

      setTransition((t) => ({
        active: true,
        fromSrc: from,
        toSrc: to,
        dir,
        key: t.key + 1,
      }));
    },
    [canMove, hasItems, currentSrc, safeIndex, items]
  );

  // Autoplay (does not depend on onNext function identity anymore)
  useEffect(() => {
    if (!isPlaying || !canMove) return;

    const id = window.setInterval(() => {
      startTransition("next");
      onNextRef.current();
    }, autoPlayMs);

    return () => window.clearInterval(id);
  }, [isPlaying, canMove, autoPlayMs, startTransition]);

  const handlePrev = () => {
    if (!canMove) return;
    setIsPlaying(false);
    startTransition("prev");
    onPrevRef.current();
  };

  const handleNext = () => {
    if (!canMove) return;
    setIsPlaying(false);
    startTransition("next");
    onNextRef.current();
  };

  const togglePlay = () => {
    if (!canMove) return;
    setIsPlaying((p) => !p);
  };

  // Optional: stop showing transition after animation finishes
  // Match this timeout to your CSS animation duration.
  useEffect(() => {
    if (!transition.active) return;
    const timeout = window.setTimeout(() => {
      setTransition((t) => ({ ...t, active: false }));
    }, 420); // <-- set to your slide animation duration
    return () => window.clearTimeout(timeout);
  }, [transition.active, transition.key]);

  return (
    <div className="cc-carousel">
      <div className="cc-frame">
        {hasItems && currentSrc ? (
          transition.active ? (
            <div
              className={`cc-slideStage ${
                transition.dir === "next" ? "cc-slide--next" : "cc-slide--prev"
              }`}
              key={transition.key}
            >
              {/* outgoing */}
              <img
                src={transition.fromSrc}
                alt={`${title} item ${safeIndex + 1}`}
                className="cc-slide cc-slide--out"
                loading="lazy"
                onError={(e) => {
                  console.error(`Failed to load image: ${currentItem?.source}`);
                  (e.currentTarget as HTMLImageElement).src = "/placeholder.png";
                }}
              />

              {/* incoming */}
              <img
                src={transition.toSrc}
                alt={`${title} incoming item`}
                className="cc-slide cc-slide--in"
                loading="lazy"
                onError={(e) => {
                  console.error(`Failed to load incoming image`);
                  (e.currentTarget as HTMLImageElement).src = "/placeholder.png";
                }}
              />
            </div>
          ) : (
            // ✅ No transition happening: render ONE image only (prevents “jump forward” on mode switch)
            <img
              src={currentSrc}
              alt={`${title} item ${safeIndex + 1}`}
              className="cc-single"
              loading="lazy"
              onError={(e) => {
                console.error(`Failed to load image: ${currentItem?.source}`);
                (e.currentTarget as HTMLImageElement).src = "/placeholder.png";
              }}
            />
          )
        ) : (
          <span className="cc-empty">No {title} items found.</span>
        )}
      </div>

      <div className="cc-controls">
        <button
          onClick={handlePrev}
          className="cc-btn"
          disabled={!canMove}
          aria-label={`Previous ${title}`}
        >
          <RewindIcon className="h-5 w-5" />
        </button>

        <button
          className="cc-btn"
          type="button"
          onClick={togglePlay}
          disabled={!canMove}
          aria-label={isPlaying ? "Pause carousel" : "Play carousel"}
        >
          {isPlaying ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
        </button>

        <button
          onClick={handleNext}
          className="cc-btn"
          disabled={!canMove}
          aria-label={`Next ${title}`}
        >
          <FastForwardIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};
