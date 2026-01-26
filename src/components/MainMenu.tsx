import React from "react";
import type { ImageFile } from "../types";
import "../css/MainMenu.css";

export type View =
  | "menu"
  | "designer"
  | "closetManager"
  | "aiStudio"
  | "myCreations"
  | "wardrobe";

export type ViewMode = "work" | "weekend";

interface MainMenuProps {
  onNavigate: (view: View, mode?: ViewMode) => void;
  modelImage: ImageFile[];
}

type Tile = {
  src: string;
  label: string;
  onClick: () => void;
};

export const MainMenu: React.FC<MainMenuProps> = ({ onNavigate, modelImage }) => {
  const youSrc =
    modelImage.length > 0 && modelImage[0].preview
      ? modelImage[0].preview
      : "/clueless.jpeg";

  const tiles: Tile[] = [
    { src: "/favorites.jpeg", label: "Favorites", onClick: () => onNavigate("myCreations") },
    { src: "/work_cover.jpeg", label: "Work", onClick: () => onNavigate("designer", "work") },
    { src: "/weekend_cover.jpeg", label: "Weekend", onClick: () => onNavigate("designer", "weekend") },
    { src: youSrc, label: "Dress Me", onClick: () => onNavigate("designer", "weekend") },
  ];

  return (
    <div className="menu">
      <div className="menu__grid">
        {tiles.map((t) => (
          <div key={t.label} className="menu__tile">
            <div className="menu__frame">
              <img className="menu__img" src={t.src} alt={t.label} />
            </div>
            <button className="menu__btn menu__btn--pink" onClick={t.onClick}>
              {t.label}
            </button>
          </div>
        ))}
      </div>
      
      <div className="menu__bottom">
        <button
          className="menu__btn menu__btn--blue menu__btn--wide"
          onClick={() => onNavigate("wardrobe")}>
          My Closet </button>
        <button
          className="menu__btn menu__btn--blue menu__btn--wide"
          onClick={() => onNavigate("closetManager")} > 
          Manage Closet </button>
        <button
          className="menu__btn menu__btn--green menu__btn--wide"
          onClick={() => onNavigate("aiStudio")}>
          Try New Outfits
        </button>
      </div>
    </div>
  );
};
