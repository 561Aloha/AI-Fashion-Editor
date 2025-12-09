
export interface ImageFile {
  file: File;
  preview: string;
}

export interface Base64Image {
  mimeType: string;
  base64: string;
}

export type ClosetCategory = 'top' | 'bottoms' | 'dress' | 'shoes';
export type ClothingStyle = 'work' | 'weekend' | 'both';

export interface ClosetItem {
  id: string;
  imageUrl: string; 
  category: ClosetCategory;
  style: ClothingStyle;
  isFavorite: boolean;
}


export interface FavoriteCreation {
  image: string;
  outfit?: {  
    type: 'ai-studio' | 'designer';
  };
}


// ---- Vite env typings ----
declare global {
  interface ImportMetaEnv {
    readonly VITE_HF_API_KEY: string;
    // add other VITE_ vars here if you make more
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

// Make this file a module so the global declarations work
export {};
