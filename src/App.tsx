import React, {useCallback, useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { MainMenu } from './components/MainMenu';
import { Designer } from './components/Designer';
import { DonationModal } from './components/DonationModal';
import { ClosetManager, AIStudio } from './components/ClosetManager';
import { MyCreations } from './components/MyCreations';
import { ClosetGallery } from './components/ClosetGallery';
import { Login } from './components/Login';
import type { View, ViewMode } from './components/MainMenu';
import type { ClosetItem, ImageFile, Base64Image, FavoriteCreation } from './types';
import { fileToBase64Image } from './utils';
import './App.css';
import { collection, getDocs, orderBy, query } from "firebase/firestore";

import "./Clothing.css";


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
  console.log('[DEBUG: App] App component mounted.');

  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [view, setView] = useState<View>('menu');
  const [viewMode, setViewMode] = useState<ViewMode>('weekend');
  const [isDonationModalOpen, setIsDonationModalOpen] = useState(false);

  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [closet, setCloset] = useState<ClosetItem[]>([]);
  const [modelImage, setModelImage] = useState<ImageFile[]>([]);
  const [favoriteCreations, setFavoriteCreations] = useState<FavoriteCreation[]>(() => {
    try {
      const raw = localStorage.getItem('favoriteCreations');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("favoriteCreations", JSON.stringify(favoriteCreations));
    } catch (e) {
      console.warn("[DEBUG: App] localStorage quota exceeded. Trimming favorites...", e);

      // Keep only the most recent N items (tune this)
      const trimmed = favoriteCreations.slice(0, 10);

      try {
        localStorage.setItem("favoriteCreations", JSON.stringify(trimmed));
        setFavoriteCreations(trimmed);
      } catch (e2) {
        console.warn("[DEBUG: App] Still too large. Clearing local favorites.", e2);
        localStorage.removeItem("favoriteCreations");
        // optional: don't wipe UI state, just stop persisting
      }
    }
  }, [favoriteCreations]);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      console.log('[DEBUG: App] Auth state changed:', currentUser?.email);
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Load data when user is authenticated
  useEffect(() => {
    if (!user) return;

    const loadClosetData = async () => {
      try {
        const q = query(
          collection(db, 'users', user.uid, 'closet'),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        const closetItems = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as ClosetItem[];
        setCloset(closetItems);
        console.log('[DEBUG: App] Loaded closet from Firestore:', closetItems);
      } catch (error) {
        console.error('[DEBUG: App] Error loading closet:', error);
      }
    };

    loadClosetData();
    const loadData = async () => {
      try {
        const userRef = doc(db, 'users', user.uid);
        const snapshot = await getDoc(userRef);

        if (snapshot.exists()) {
          const data = snapshot.data();


          if (data.modelImage) {
            const imageFile = base64ToImageFile(data.modelImage as StorableImage);
            setModelImage([imageFile]);
            console.log('[DEBUG: App] Loaded model image from Firebase');
          }

          if (data.favoriteCreations) {
            setFavoriteCreations(data.favoriteCreations as FavoriteCreation[]);
            console.log('[DEBUG: App] Loaded favorite creations from Firebase');
          }
        } else {
          console.log('[DEBUG: App] No data found in Firebase.');
        }
      } catch (error) {
        console.error('[DEBUG: App] Error loading from Firebase:', error);
      }
    };
    loadData();
  }, [user]);


  // 4. Save model image (still base64 in Firestore – OK for a single image)
  useEffect(() => {
    if (!user) return;

    if (modelImage.length > 0 && modelImage[0].file) {
      const file = modelImage[0].file;
      fileToBase64Image(file).then(({ base64, mimeType }) => {
        const saveImage = async () => {
          try {
            const userRef = doc(db, 'users', user.uid);
            await setDoc(
              userRef,
              {
                modelImage: { base64, mimeType, name: file.name },
              },
              { merge: true }
            );
            console.log('[DEBUG: App] Saved model image to Firebase');
          } catch (error) {
            console.error('[DEBUG: App] Error saving model image:', error);
          }
        };
        saveImage();
      });
    } else if (modelImage.length === 0) {
      const deleteImage = async () => {
        try {
          const userRef = doc(db, 'users', user.uid);
          await setDoc(userRef, { modelImage: null }, { merge: true });
          console.log('[DEBUG: App] Deleted model image from Firebase');
        } catch (error) {
          console.error('[DEBUG: App] Error deleting model image:', error);
        }
      };
      deleteImage();
    }
  }, [modelImage, user]);

  useEffect(() => {
    if (!user) return;

    const saveFavorites = async () => {
      try {
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, { favoriteCreations }, { merge: true });
        console.log('[DEBUG: App] Saved favorite creations to Firebase');
      } catch (error) {
        console.error('[DEBUG: App] Error saving favorite creations:', error);
      }
    };

    saveFavorites();
  }, [favoriteCreations, user]);

  const handleToggleSelect = (itemId: string) => {
    setSelectedItemIds((prev) => {
      if (prev.includes(itemId)) {
        return prev.filter((id) => id !== itemId);
      }
      return [...prev, itemId];
    });
  };

  const handleNavigate = (targetView: View, mode?: ViewMode) => {
    console.log(`[DEBUG: App] Navigating to view: ${targetView}, mode: ${mode || 'N/A'}`);
    setView(targetView);
    if (mode) {
      setViewMode(mode);
    }
  };

  const handleBackToMenu = () => {
    console.log('[DEBUG: App] Navigating back to menu.');
    setView('menu');
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      // Reset all state
      setCloset([]);
      setModelImage([]);
      setFavoriteCreations([]);
      setSelectedItemIds([]);
      setView('menu');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };


  const saveCreation = useCallback((image: string, type: 'ai-studio' | 'designer') => {
    setFavoriteCreations((prev) => {
      // prevent duplicates (optional)
      if (prev.some((c) => c.image === image)) return prev;

      const newItem: FavoriteCreation = {
        id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
        image,
        createdAt: Date.now(),
        outfit: { type },
      };
      return [newItem, ...prev]; // newest first
    });
  }, []);
  const renderView = () => {
    switch (view) {
      case 'designer':
        return (
          <Designer
            mode={viewMode}
            closet={closet}
            onSaveCreation={(img) => saveCreation(img, 'designer')}
            setCloset={setCloset}
            modelImage={modelImage}
            setModelImage={setModelImage}
            onNavigate={handleNavigate}
            userId={user?.uid}  
            favoriteCreations={favoriteCreations}
            setFavoriteCreations={setFavoriteCreations}
          />
        );
      case 'closetManager':
        return (
          <ClosetManager
            closet={closet}
            setCloset={setCloset}
            userId={user?.uid || ''}
          />
        );
      case 'aiStudio':
        return (
          <AIStudio
            closet={closet}
              onSaveCreation={(img) => saveCreation(img, 'ai-studio')}
            setCloset={setCloset}
            modelImage={modelImage}
            setModelImage={setModelImage}
          />
        );
      case 'myCreations':
        return (
          <MyCreations
          favoriteCreations={favoriteCreations}
          setFavoriteCreations={setFavoriteCreations}
          />
        );
      case 'wardrobe':
  return (
    <div className="view-scroll w-full">
      <ClosetGallery
        onBack={handleBackToMenu}
        closet={closet}
        selectedItemIds={selectedItemIds}
        onToggleSelect={handleToggleSelect}
        onNavigate={handleNavigate}
        setCloset={setCloset}
      />
    </div>
  );

        return (
          <ClosetGallery
            onBack={handleBackToMenu}
            closet={closet}
            selectedItemIds={selectedItemIds}
            onToggleSelect={handleToggleSelect}
            onNavigate={handleNavigate}
            setCloset={setCloset} 
          />
        );
      case 'menu':
      default:
        return <MainMenu onNavigate={handleNavigate} modelImage={modelImage} />;
    }
  };

  // Show loading while checking auth
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

  // Show login if not authenticated
  if (!user) {
    return (
      <div
        className="app-container" >
        <button
          onClick={() => setIsDonationModalOpen(true)}
          className="fixed top-4 right-4 z-40 bg-green-400 hover:bg-green-500 text-black font-bold h-12 w-12 rounded-full border-2 border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex items-center justify-center"
          title="Support the Developer"
        >
          <span className="text-2xl">$</span>
        </button>

        <DonationModal
          isOpen={isDonationModalOpen}
          onClose={() => setIsDonationModalOpen(false)}
        />

      <div className={`card-wrapper ${view === 'designer' ? 'card-wrapper--tall' : ''}`}>

          <header className="app-header bg-gradient-to-r from-[#000080] via-[#1084d7] to-[#000080] px-4 py-3 border-b-4 border-b-gray-400 border-t-2 border-t-white" style={{
            boxShadow: 'inset 1px 1px 0 rgba(255,255,255,0.5), inset -1px -1px 0 rgba(0,0,0,0.5)',
          }}>
            <div className="flex items-center justify-between">
              {/* Left: Title */}
              <h1 className="font-sans text-white text-2xl font-bold tracking-wide drop-shadow-[2px_2px_4px_rgba(0,0,0,0.8)]">
                Cyber Closet
              </h1>

              {/* Right: Controls */}
              <div className="header-right">
              {user?.photoURL && (
                <img src={user.photoURL} alt="Profile" className="profile-pic" />
              )}

                {/* Donation Button - moved here from fixed position */}
                <button
                  onClick={() => setIsDonationModalOpen(true)}
                  className="bg-green-400 hover:bg-green-500 text-black font-bold h-10 w-10 rounded-full border-2 border-black text-lg flex items-center justify-center shadow-[2px_2px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                  title="Support the Developer"
                >
                  $
                </button>

                {view !== 'menu' && (
                  <button onClick={handleBackToMenu} className="btn-back">
                    &larr; Menu
                  </button>
                )}
                <button onClick={handleSignOut} className="btn-back btn-signout">
                  Sign Out
                </button>
              </div>
            </div>
          </header>
          <div className="app-content">
            <Login onLoginSuccess={() => {}} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="app-container">
      <button
        onClick={() => setIsDonationModalOpen(true)}
        className="fixed top-4 right-4 z-40 bg-green-400 hover:bg-green-500 text-black font-bold h-12 w-12 rounded-full border-2 border-black shadow-[3px_3px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex items-center justify-center"
        title="Support the Developer"
      >
        <span className="text-2xl">$</span>
      </button>

      <DonationModal
        isOpen={isDonationModalOpen}
        onClose={() => setIsDonationModalOpen(false)}
      />
      <div className={`card-wrapper ${view === 'designer' ? 'card-wrapper--tall' : ''}`}>
        
        <header className="app-header">
          <h1>Cyber Closet</h1>
          <div className="header-right">
            {user.photoURL && (
              <img src={user.photoURL} alt="Profile" className="profile-pic" />
            )}
            {view !== 'menu' && (
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
