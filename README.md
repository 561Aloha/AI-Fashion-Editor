# 👗 AI Fashion Editor

**An AI-powered virtual styling app — upload looks, mix and match pieces, and get intelligent outfit suggestions in an interactive interface.**

🔗 **Live Demo:** [Coming Soon]

---

## Overview

AI Fashion Editor is a product-driven web application that combines front-end engineering, UX design, and AI integration into a single styling experience. Users can upload or preview fashion items, experiment with combinations, and receive AI-assisted outfit suggestions — all within a clean, responsive interface.

---

## Features

- **AI-Assisted Styling** — Intelligent outfit suggestions powered by Gemini / HuggingFace integrations
- **Clothing Carousel** — Dynamic item selection with smooth, interactive browsing
- **Styling Preview** — Real-time outfit visualization as you mix and match pieces
- **Authentication** — Secure user sessions via Firebase Auth
- **Cloud Persistence** — Outfit data stored and retrieved from Firestore
- **Responsive Design** — Fully optimized for mobile and desktop with Tailwind CSS

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | TypeScript, React, Vite |
| Styling | Tailwind CSS |
| Auth & Database | Firebase (Auth + Firestore) |
| AI | Gemini API / HuggingFace |
| Deployment | Vercel / Netlify |

---

## Architecture

```
User Input → React State Management → AI Processing → Styled Output → Firebase Storage
```

The application is built on a component-driven architecture with reusable UI modules, controlled state flows, asynchronous API handling, and cloud-based persistence.

---

## Project Structure

```
src/
├── components/
│   ├── CarouselSelector.tsx    # Clothing item browser
│   ├── OutfitPreview.tsx       # Live styling canvas
│   ├── SuggestionPanel.tsx     # AI outfit recommendations
│   └── AuthGuard.tsx           # Session & auth wrapper
├── hooks/
│   └── useOutfitState.ts       # Centralized outfit state logic
├── services/
│   ├── aiService.ts            # Gemini / HuggingFace API calls
│   └── firebaseService.ts      # Firestore read/write helpers
├── App.tsx
└── main.tsx
```

---

## Getting Started

```bash
# Clone the repo
git clone https://github.com/561Aloha/ai-fashion-editor.git
cd ai-fashion-editor

# Install dependencies
npm install

# Add your environment variables
cp .env.example .env
# Fill in the values below

# Start the dev server
npm run dev
```

### Environment Variables

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_AI_API_KEY=
```

---

## Roadmap

- [ ] Pose-aware clothing overlays
- [ ] AI-generated style descriptions
- [ ] Save & share outfit boards
- [ ] Personalized recommendation engine
- [ ] Outfit history tracking

---

## Author

Built by [@MadeByDianna](https://madebydianna.com) · [GitHub](https://github.com/561Aloha)
