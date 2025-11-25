
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
  imageB64: string; // The base64 string of the image with background removed
  category: ClosetCategory;
  style: ClothingStyle;
  // FIX: Add optional `isFavorite` property to track favorited items. This resolves type errors in FavoriteItems.tsx.
  isFavorite?: boolean;
}

export interface FavoriteCreation {
  image: string;
  outfit?: {  
    type: 'ai-studio' | 'designer';
  };
}

