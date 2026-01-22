import React, { useEffect, useMemo, useRef, useState } from "react";
import { db, auth } from "./firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut, User } from "firebase/auth";

import { MainMenu } from "./components/MainMenu";
import { Designer } from "./components/Designer";
import { DonationModal } from "./components/DonationModal";
import { ClosetManager, AIStudio } from "./components/ClosetManager";
import { MyCreations } from "./components/Favorites";
import { ClosetGallery } from "./components/ClosetGallery";
import { Login } from "./components/Login";

import type { View, ViewMode } from "./components/MainMenu";
import type { ClosetItem, ImageFile, Base64Image, FavoriteCreation } from "./types";

import { fileToBase64Image } from "./utils";
import "./App.css";

interface StorableImage extends Base64Image {
  name: string;
}

const base64ToImageFile = (storableImage: StorableImage): ImageFile => {
  const byteCharacters = atob(storableImage.base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: storableImage.mimeType });
  const file = new File([blob], storableImage.name, { type: storableImage.mimeType });
  const preview = URL.createObjectURL(file);
  return { file, preview };
};

export default function App() {
  // ---------- debug (mount only) ----------
  useEffect(() => {
    console.log("[DEBUG: App] App component mounted.");
  }, []);

  // ---------- auth ----------
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // ---------- ui state ----------
  const [view, setView] = useState<View>("menu");
  const [viewMode, setViewMode] = useState<ViewMode>("weekend");
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);

  // ---------- data state ----------
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [closet, setCloset] = useState<ClosetItem[]>([]);
  const [modelImage, setModelImage] = useState<ImageFile[]>([]);
  const [favoriteCreations, setFavoriteCreations] = useState<FavoriteCreation[]>([]);

  // Keep track of last saved model signature so we don't re-save endlessly
  const lastSavedModelSigRef = useRef<string | null>(null);

  // ---------- auth listener ----------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log("[DEBUG: App] Auth state changed:", currentUser?.email);
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // ---------- load user data ----------
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    (async () => {
      try {
        const userRef = doc(db, "users", user.uid);
        const snapshot = await getDoc(userRef);

        if (cancelled) return;

        if (snapshot.exists()) {
          const data = snapshot.data();

          if (Array.isArray(data.closet)) {
            setCloset(data.closet);
            console.log("[DEBUG: App] Loaded closet from Firebase");
          }

          // modelImage can be null or undefined
          if (data.modelImage && typeof data.modelImage === "object") {
            const storable = data.modelImage as StorableImage;
            if (typeof storable.base64 === "string" && typeof storable.mimeType === "string" && typeof storable.name === "string") {
              const imageFile = base64ToImageFile(storable);
              setModelImage([imageFile]);

              // set last saved signature so we don't immediately re-save it
              lastSavedModelSigRef.current = `${storable.name}:${storable.mimeType}:${storable.base64.length}`;
              console.log("[DEBUG: App] Loaded model image from Firebase");
            }
          }

          if (Array.isArray(data.favoriteCreations)) {
            setFavoriteCreations(data.favoriteCreations);
            console.log("[DEBUG: App] Loaded favorite creations from Firebase");
          }
        } else {
          console.log("[DEBUG: App] No data found in Firebase.");
        }
      } catch (error) {
        console.error("[DEBUG: App] Error loading from Firebase:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // ---------- save closet ----------
  useEffect(() => {
    if (!user) return;
    // If you want to allow saving empty closet, remove this guard:
    if (closet.length === 0) return;

    let cancelled = false;

    (async () => {
      try {
        const userRef = doc(db, "users", user.uid);
        await setDoc(userRef, { closet }, { merge: true });
        if (!cancelled) console.log("[DEBUG: App] Saved closet to Firebase");
      } catch (error) {
        if (!cancelled) console.error("[DEBUG: App] Error saving closet:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [closet, user]);

  // ---------- save model image (IMPORTANT) ----------
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    (async () => {
      try {
        const userRef = doc(db, "users", user.uid);

        // Case 1: removed image
        if (modelImage.length === 0) {
          // Only write if we previously had one saved
          if (lastSavedModelSigRef.current !== null) {
            await setDoc(userRef, { modelImage: null }, { merge: true });
            if (!cancelled) console.log("[DEBUG: App] Deleted model image from Firebase");
            lastSavedModelSigRef.current = null;
          }
          return;
        }

        // Case 2: has image
        const file = modelImage[0]?.file;
        if (!file) return;

        // Convert to base64 (resized)
        const { base64, mimeType } = await fileToBase64Image(file);
        if (cancelled) return;

        // Create a stable signature
        const sig = `${file.name}:${mimeType}:${base64.length}`;

        // Prevent resaving same image repeatedly
        if (lastSavedModelSigRef.current === sig) return;

        // Firestore-safe payload (NO File/Blob/preview objects)
        const payload: { modelImage: StorableImage } = {
          modelImage: { base64, mimeType, name: file.name },
        };

        // Sanity debug (optional)
        // console.log("Saving modelImage payload types:", {
        //   base64Type: typeof base64,
        //   mimeTypeType: typeof mimeType,
        //   nameType: typeof file.name,
        // });

        await setDoc(userRef, payload, { merge: true });

        if (!cancelled) console.log("[DEBUG: App] Saved model image to Firebase");
        lastSavedModelSigRef.current = sig;
      } catch (error) {
        if (!cancelled) console.error("[DEBUG: App] Error saving model image:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [modelImage, user]);

  // ---------- save favorites ----------
  useEffect(() => {
    if (!user) return;
    if (favoriteCreations.length === 0) return;

    let cancelled = false;

    (async () => {
      try {
        const userRef = doc(db, "users", user.uid);
        await setDoc(userRef, { favoriteCreations }, { merge: true });
        if (!cancelled) console.log("[DEBUG: App] Saved favorite creations to Firebase");
      } catch (error) {
        if (!cancelled) console.error("[DEBUG: App] Error saving favorite creations:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [favoriteCreations, user]);

  // ---------- handlers ----------
  const handleToggleSelect = (itemId: string) => {
    setSelectedItemIds((prev) => (prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]));
  };

  const handleNavigate = (targetView: View, mode?: ViewMode) => {
    console.log(`[DEBUG: App] Navigating to view: ${targetView}, mode: ${mode || "N/A"}`);
    setView(targetView);
    if (mode) setViewMode(mode);
  };

  const handleBackToMenu = () => {
    console.log("[DEBUG: App] Navigating back to menu.");
    setView("menu");
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);

      // Revoke previews to avoid leaks
      modelImage.forEach((img) => URL.revokeObjectURL(img.preview));

      // Reset state
      setCloset([]);
      setModelImage([]);
      setFavoriteCreations([]);
      setSelectedItemIds([]);
      setView("menu");

      lastSavedModelSigRef.current = null;
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  // ---------- view renderer ----------
  const renderView = () => {
    switch (view) {
      case "designer":
        return (
          <Designer
            mode={viewMode}
            closet={closet}
            setCloset={setCloset}
            modelImage={modelImage}
            setModelImage={setModelImage}
            onNavigate={handleNavigate}
          />
        );
      case "closetManager":
        return <ClosetManager closet={closet} setCloset={setCloset} userId={user?.uid || ""} />;
      case "aiStudio":
        return <AIStudio closet={closet} setCloset={setCloset} modelImage={modelImage} setModelImage={setModelImage} />;
      case "myCreations":
        return <MyCreations favoriteCreations={favoriteCreations} setFavoriteCreations={setFavoriteCreations} />;
      case "wardrobe":
        return (
          <ClosetGallery
            onBack={handleBackToMenu}
            closet={closet}
            selectedItemIds={selectedItemIds}
            onToggleSelect={handleToggleSelect}
            onNavigate={handleNavigate}
          />
        );
      case "menu":
      default:
        return <MainMenu onNavigate={handleNavigate} modelImage={modelImage} />;
    }
  };

  // ---------- auth loading ----------
  if (authLoading) {
    return (
      <div
        className="app-container"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1574868808703-a3b3f75b8394?q=80&w=2574&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D')",
        }}
      >
        <div className="card-wrapper">
          <div className="flex items-center justify-center min-h-[400px]">
            <p className="text-gray-600 text-lg">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  // ---------- login screen ----------
  if (!user) {
    return (
      <div
        className="app-container"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1574868808703-a3b3f75b8394?q=80&w=2574&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D')",
        }}
      >
        <button
          onClick={() => setIsDonationModalOpen(true)}
          className="fixed top-4 right-4 z-40 bg-green-400 hover:bg-green-500 text-black font-bold h-12 w-12 rounded-full border-2 border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex items-center justify-center"
          title="Support the Developer"
        >
          <span className="text-2xl">$</span>
        </button>

        <DonationModal isOpen={isDonationModalOpen} onClose={() => setIsDonationModalOpen(false)} />

        <div className="card-wrapper">
          <header className="app-header">
            <h1>Cyber Closet</h1>
          </header>
          <div className="app-content">
            <Login onLoginSuccess={() => {}} />
          </div>
        </div>
      </div>
    );
  }

  // ---------- main app ----------
  return (
    <div
      className="app-container"
      style={{
        backgroundImage:
          "url('https://images.unsplash.com/photo-1574868808703-a3b3f75b8394?q=80&w=2574&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D')",
      }}
    >
      <button
        onClick={() => setIsDonationModalOpen(true)}
        className="fixed top-4 right-4 z-40 bg-green-400 hover:bg-green-500 text-black font-bold h-12 w-12 rounded-full border-2 border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex items-center justify-center"
        title="Support the Developer"
      >
        <span className="text-2xl">$</span>
      </button>

      <DonationModal isOpen={isDonationModalOpen} onClose={() => setIsDonationModalOpen(false)} />

      <div className="card-wrapper">
        <header className="app-header">
          <h1>Cyber Closet</h1>

          <div className="header-right">
            {user.photoURL && <img src={user.photoURL} alt="Profile" className="profile-pic" />}

            {view !== "menu" && (
              <button onClick={handleBackToMenu} className="btn-back">
                &larr; Menu
              </button>
            )}

            <button onClick={handleSignOut} className="btn-back btn-signout">
              Sign Out
            </button>
          </div>
        </header>

        <div className="app-content">{renderView()}</div>
      </div>
    </div>
  );
}
