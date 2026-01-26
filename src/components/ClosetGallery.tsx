import React, { useState, useMemo } from 'react';
import type { ClosetItem } from '../types';
import type { View, ViewMode } from './MainMenu';
import { deleteDoc, doc } from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import { db, storage, auth } from '../firebase';
import "../css/closetGallery.css";


interface ClosetGalleryProps {
  closet: ClosetItem[];
  selectedItemIds: string[];
  onToggleSelect: (id: string) => void;
  onBack: () => void;
  onNavigate: (view: View, mode?: ViewMode) => void;
  setCloset: React.Dispatch<React.SetStateAction<ClosetItem[]>>;
}

export const ClosetGallery: React.FC<ClosetGalleryProps> = ({
  closet,
  selectedItemIds,
  onToggleSelect,
  onBack,
  onNavigate,
  setCloset,
}) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const hasItems = closet.length > 0;

  // ✅ Get the currently selected item in each category
  const selectedByCategory = useMemo(() => {
    const selected: Record<string, string | null> = {
      top: null,
      bottoms: null,
      dress: null,
      shoes: null,
    };

    selectedItemIds.forEach((id) => {
      const item = closet.find((i) => i.id === id);
      if (item && item.category in selected) {
        selected[item.category] = id;
      }
    });

    return selected;
  }, [selectedItemIds, closet]);
  const handleCategorySelect = (itemId: string) => {
    const item = closet.find((i) => i.id === itemId);
    if (!item) return;
    const currentSelectionForCategory = selectedByCategory[item.category];

    if (currentSelectionForCategory === itemId) {
      // If clicking the same item, deselect it
      onToggleSelect(itemId);
    } else {
      // If clicking a different item in the same category, deselect old and select new
      if (currentSelectionForCategory) {
        onToggleSelect(currentSelectionForCategory); // Deselect old
      }
      onToggleSelect(itemId); // Select new
    }
  };

  const canDressMe = useMemo(() => {
  const hasDress = !!selectedByCategory.dress;
  const hasTopAndBottom = !!selectedByCategory.top && !!selectedByCategory.bottoms;
  return hasDress || hasTopAndBottom;
}, [selectedByCategory]);

  const handleDelete = async (item: ClosetItem) => {
    if (!auth.currentUser) {
      setError('Not authenticated');
      return;
    }

    setDeletingId(item.id);
    setError(null);

    try {
      await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'closet', item.id));
      if (item.storagePath) {
        const storageRef = ref(storage, item.storagePath);
        await deleteObject(storageRef);
      }
      setCloset((prev) => prev.filter((i) => i.id !== item.id));
      console.log('[ClosetGallery] Item deleted successfully:', item.id);
    } catch (err: any) {
      console.error('[ClosetGallery] Delete error:', err);
      setError(err?.message || 'Failed to delete item');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="closet-gallery-root">
      <div className="cg-topbar">
        <button type="button" onClick={onBack} className="cg-btn ">
          &larr; Back
        </button>
        <h2 className="cg-title">My Wardrobe</h2>
        <button
          type="button"
          onClick={() => onNavigate("designer", "weekend")}
          className="cg-btn cg-btn--primary"
          disabled={!canDressMe}
          title={!canDressMe ? "Select a dress, or a top + bottoms" : undefined}
        >
          Dress Me
        </button>
      </div>


      {error && <div className="cg-error">{error}</div>}

      {!hasItems && (
        <div className="cg-empty">
          <p className="cg-empty__headline">Your wardrobe is empty.</p>
          <p className="cg-empty__sub">
            Go to <span className="cg-empty__bold">Manage Closet</span> to add items.
          </p>
          <button
            type="button"
            onClick={() => onNavigate("closetManager")}
            className="cg-btn cg-btn--secondary"
          >
            Manage Closet
          </button>
        </div>
      )}

      {/* Grid */}
      {hasItems && (
        <div className="closet-grid">
          {closet.map((item) => {
            const isSelected = selectedByCategory[item.category] === item.id;
            const src = item.imageUrl || "";
            const isDeleting = deletingId === item.id;
            const isHovered = hoveredId === item.id;

            return (
              <div
                key={item.id}
                className="cg-card"
                onMouseEnter={() => setHoveredId(item.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <button
                  type="button"
                  onClick={() => handleCategorySelect(item.id)}
                  disabled={isDeleting}
                  className={[
                    "cg-card__button",
                    isSelected ? "is-selected" : "",
                    isDeleting ? "is-deleting" : "",
                  ].join(" ")}
                >
                  <div className="cg-card__media">
                    {src ? (
                      <img
                        src={src}
                        alt={`${item.category} item`}
                        className="cg-card__img"
                        loading="lazy"
                        onError={(e) => {
                          console.error("[ClosetGallery] Failed to load imageUrl:", src);
                          (e.target as HTMLImageElement).src = "/placeholder.png";
                        }}
                      />
                    ) : (
                      <div className="cg-card__noimg">No image</div>
                    )}

                    {/* tags */}
                    <div className="cg-card__tags">
                      <span className="cg-card__tag">{item.category}</span>
                      <span className="cg-card__tag">{item.style}</span>
                    </div>

                    {/* selected badge */}
                    {isSelected && <div className="cg-card__selected">Selected</div>}

                    {/* delete (hover only) */}
                    {isHovered && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete this ${item.category}?`)) {
                            handleDelete(item);
                          }
                        }}
                        disabled={isDeleting}
                        className="cg-card__delete"
                        title="Delete item"
                      >
                        {isDeleting ? "..." : "✕"}
                      </button>
                    )}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

};