# Pumped Up Kicks - Frontend

AI-powered lecture intelligence platform built with Next.js, TypeScript, and Tailwind CSS.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Features

- Next.js 15 with App Router
- TypeScript with full type safety
- Tailwind CSS with 31 centralized colors
- Chat interface with AI responses
- Video upload and management
- Real-time server status monitoring

## Color System

All colors are centralized in `src/config/colors.ts`:

```tsx
className="bg-electric-blueberry text-snowflake-surprise"
className="bg-minty-fresh text-forest-friend"
```

**31 colors with funny names:**
- electricBlueberry, softServe, deepPurplePanda
- sunnyDelight, butterscotchDream, caramelCrush
- mintyFresh, limelight, forestFriend
- strawberryShock, blushBerry, crimsonCrisis
- And more!

**Never hardcode colors!**

## Project Structure

```
src/
├── app/              # Pages
├── components/       # UI components
├── services/         # API integration
├── types/            # TypeScript types
└── config/           # Colors configuration
```

## API Integration

```typescript
import { chatService, videoService } from '@/services';

await chatService.query({ question: "What is AI?" });
await videoService.uploadVideo(file, "Title");
```

## Build

```bash
npm run build
npm start
```

## Backend

Requires backend server running on port 8000.
See `../server/README.md` for backend setup.
