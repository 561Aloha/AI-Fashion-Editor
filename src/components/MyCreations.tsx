import React, { useState } from "react";
import type { FavoriteCreation } from "../types";
import { TrashIcon } from "./icons";

interface MyCreationsProps {
  favoriteCreations: FavoriteCreation[];
  setFavoriteCreations: React.Dispatch<React.SetStateAction<FavoriteCreation[]>>;
}

export const MyCreations: React.FC<MyCreationsProps> = ({
  favoriteCreations,
  setFavoriteCreations,
}) => {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const handleDeleteConfirmed = () => {
    if (!confirmId) return;
    setFavoriteCreations((prev) => prev.filter((c) => c.id !== confirmId));
    setConfirmId(null);
  };

  const closeModal = () => setConfirmId(null);

  // Optional: let ESC close it
  React.useEffect(() => {
    if (!confirmId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmId]);

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
      <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
        My Creations
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto p-2">
        {favoriteCreations.map((creation, index) => (
          <div
            key={creation.id}
            className="relative group aspect-[3/4] overflow-hidden rounded-lg"
          >
            <img
              src={creation.image}
              alt={`Favorite creation ${index + 1}`}
              className="w-full h-full object-cover border-2 border-gray-300 rounded-lg"
            />

            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <button
                type="button"
                onClick={() => setConfirmId(creation.id)}
                className="p-3 bg-white/90 rounded-full text-red-600 hover:bg-white transition-transform hover:scale-110"
                title="Delete Creation"
              >
                <TrashIcon className="h-6 w-6" />
              </button>
            </div>

            {creation.outfit?.type && (
              <div className="absolute top-2 left-2 text-xs bg-white/90 border border-black px-2 py-1 rounded">
                {creation.outfit.type === "ai-studio" ? "AI Studio" : "Designer"}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* CONFIRM MODAL / LIGHTBOX */}
      {confirmId && (
        <div
          className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-sm bg-white border-2 border-black rounded-2xl shadow-[6px_6px_0_rgba(0,0,0,1)] p-5"
            onClick={(e) => e.stopPropagation()} // prevent closing when clicking inside
            role="dialog"
            aria-modal="true"
            aria-label="Confirm delete"
          >
            <h3 className="text-lg font-bold text-gray-900">
              Delete this creation?
            </h3>
            <p className="text-sm text-gray-600 mt-2">
              Are you sure? This can’t be undone.
            </p>

            <div className="mt-5 flex gap-3 justify-end">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 rounded-xl border-2 border-black bg-white font-semibold shadow-[3px_3px_0_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              >
                No
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirmed}
                className="px-4 py-2 rounded-xl border-2 border-black bg-red-500 text-white font-semibold shadow-[3px_3px_0_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              >
                Yes, delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
