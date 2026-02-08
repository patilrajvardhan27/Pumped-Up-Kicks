# Pumped Up Kicks - Frontend

AI-powered lecture intelligence platform built with Next.js, TypeScript, and Tailwind CSS.

## 🎨 Central Color System

This project uses a **centralized color configuration** with funny, memorable names. **NEVER hardcode colors** in components!

### Color Configuration

All colors are defined in `src/config/colors.ts` with names like:
- `electricBlueberry` - Primary vibrant indigo
- `sunnyDelight` - Secondary amber
- `mintyFresh` - Success green
- `strawberryShock` - Error red
- `cloudNine` - Background off-white
- And many more!

### Usage Methods

#### 1. Tailwind Classes (Recommended)
```tsx
<div className="bg-electric-blueberry text-snowflake-surprise">
  Hello World
</div>
```

#### 2. Semantic Aliases
```tsx
<button className="bg-primary hover:bg-primary-light text-text-inverse">
  Click Me
</button>
```

#### 3. Direct Import (for inline styles)
```tsx
import { colors } from '@/config/colors';

<div style={{ backgroundColor: colors.electricBlueberry }}>
  Custom styled
</div>
```

### Available Color Categories

- **Primary**: electricBlueberry, softServe, deepPurplePanda
- **Secondary**: sunnyDelight, butterscotchDream, caramelCrush
- **Neutrals**: snowflakeSurprise, cloudNine, foggyMorning, silverLining, etc.
- **Success**: mintyFresh, limelight, forestFriend
- **Warning**: bananaBonanza, goldenGlow, honeyBuzz
- **Error**: strawberryShock, blushBerry, crimsonCrisis
- **Info**: skyDiver, oceanBreeze, deepDive
- **Accents**: lavenderLatte, rosyPosy, tealTango, grapeJuice

See the live color showcase at `/` when you run the app!

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm

### Installation

```bash
cd client
npm install
```

### Development

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

Build for production:

```bash
npm run build
```

### Production Server

```bash
npm start
```

## 📁 Project Structure

```
client/
├── src/
│   ├── app/              # Next.js App Router pages
│   │   ├── globals.css   # Global styles with Tailwind
│   │   ├── layout.tsx    # Root layout
│   │   └── page.tsx      # Home page
│   ├── components/       # React components
│   │   ├── Button.tsx    # Button component using color system
│   │   ├── Card.tsx      # Card component using color system
│   │   ├── Hero.tsx      # Hero section
│   │   ├── Features.tsx  # Features section
│   │   └── ColorShowcase.tsx  # Color palette showcase
│   └── config/
│       └── colors.ts     # 🎨 CENTRAL COLOR CONFIGURATION
├── public/               # Static assets
├── tailwind.config.ts    # Tailwind config with custom colors
├── tsconfig.json         # TypeScript configuration
└── next.config.ts        # Next.js configuration
```

## 🎯 Key Features

- **Next.js 15** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** with custom color system
- **Centralized color management** - no hardcoded colors!
- **Reusable components** (Button, Card, etc.)
- **Responsive design** out of the box

## 🎨 Adding New Colors

1. Add the color to `src/config/colors.ts`:
```typescript
export const colors = {
  // ... existing colors
  newAwesomeColor: '#ABCDEF',
} as const;
```

2. Add it to `tailwind.config.ts`:
```typescript
colors: {
  // ... existing colors
  'new-awesome-color': colors.newAwesomeColor,
}
```

3. Use it in components:
```tsx
<div className="bg-new-awesome-color">
  Using my new color!
</div>
```

## 🔧 Custom Tailwind Classes

Pre-built component classes in `globals.css`:
- `.btn-primary` - Primary button styles
- `.btn-secondary` - Secondary button styles
- `.card` - Card container styles
- `.input-field` - Input field styles

## 📝 Development Guidelines

1. **Never hardcode colors** - Always use the central color system
2. **Use semantic names** when applicable (bg-primary, text-error, etc.)
3. **Component-first** - Build reusable components
4. **TypeScript strict mode** - Keep types clean and accurate
5. **Responsive design** - Mobile-first approach

## 🔗 Backend Integration

The frontend is designed to work with the backend API at `http://localhost:8000`.
API integration can be added in `src/services/` directory.

## 📚 Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [TypeScript](https://www.typescriptlang.org/docs)

---

**Remember:** Keep it colorful with funny names, keep it centralized, and never hardcode! 🎨✨
