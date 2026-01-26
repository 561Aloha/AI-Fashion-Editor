import { getStorage, ref, listAll, getDownloadURL } from "firebase/storage";
import type { ClosetItem } from "./types";

function inferCategory(filename: string): ClosetItem["category"] {
  if (filename.startsWith("top-")) return "top";
  if (filename.startsWith("bottoms-")) return "bottoms";
  if (filename.startsWith("dress-")) return "dress";
  if (filename.startsWith("shoes-")) return "shoes";
  // fallback if naming isn’t consistent
  return "top";
}

export async function loadClosetFromStorage(userId: string): Promise<ClosetItem[]> {
  const storage = getStorage();

  const folderRef = ref(storage, `users/${userId}/closet`);

  const res = await listAll(folderRef);

  const items = await Promise.all(
    res.items.map(async (itemRef) => {
      const url = await getDownloadURL(itemRef);
      const name = itemRef.name;

      return {
        id: itemRef.fullPath,  
        category: inferCategory(name), // top/bottoms/dress/shoes
        imageUrl: url,                 // https download URL that <img> can render
        isFavorite: false,
        style: "both",                 // or infer from filename if you want
      } as ClosetItem;
    })
  );

  // optional: newest first if names include timestamps like top-1764...
  items.sort((a, b) => (a.id < b.id ? 1 : -1));

  return items;
}
