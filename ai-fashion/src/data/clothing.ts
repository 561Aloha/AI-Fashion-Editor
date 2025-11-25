export type StyleCategory = 'weekend' | 'work';
export type ClothingType = 'tops' | 'bottoms' | 'dresses';

export const clothingData = {
  weekend: {
    model: '/weekend_cover.jpeg',
    tops: [
      '/girltop.jpeg',
      '/girltop2.jpeg',
    ],
    bottoms: [
      '/womenjean.jpeg',
    ],
    dresses: [],
  },
  work: {
    model: '/work_cover.jpeg',
    tops: [
      '/whitetee.jpeg',
      '/black tee.jpeg',
    ],
    bottoms: [
      '/blackskirt.jpeg',
      '/pants.jpeg',
    ],
    dresses: [],
  },
};

// Separate male data for future use
export const maleClothingData = {
  weekend: {
    model: '/weekend_cover.jpeg',
    tops: [
      '/guyjacket.jpeg',
      '/guywhitejacket.jpeg',
    ],
    bottoms: [
      '/guyjeans.jpeg',
      '/guypants.jpeg',
    ],
    dresses: [],
  },
  work: {
    model: '/work_cover.jpeg',
    tops: [
      '/guyjacket.jpeg',
      '/guywhitejacket.jpeg',
    ],
    bottoms: [
      '/guyjeans.jpeg',
      '/guypants.jpeg',
    ],
    dresses: [],
  },
};