# Color System Guide 🎨

## Philosophy

This project uses a **centralized color system** with memorable, funny names to make development more enjoyable and maintainable.

## Rules

1. **NEVER hardcode hex values** in components
2. **ALWAYS** use colors from `colors.ts`
3. Choose between funny names (`electric-blueberry`) or semantic names (`primary`)
4. Update `tailwind.config.ts` when adding new colors

## Color Families

### Primary Colors (The Main Squeeze)
- **electricBlueberry** `#4F46E5` - Main brand color, primary CTA buttons
- **softServe** `#818CF8` - Hover states, lighter accents
- **deepPurplePanda** `#3730A3` - Active states, darker accents

**Use for:** Primary buttons, links, main navigation, brand elements

### Secondary Colors (The Backup Dancers)
- **sunnyDelight** `#F59E0B` - Secondary actions
- **butterscotchDream** `#FCD34D` - Highlights, subtle accents
- **caramelCrush** `#D97706` - Emphasis, darker secondary

**Use for:** Secondary buttons, badges, accent highlights

### Neutral Colors (The Chill Squad)
- **snowflakeSurprise** `#FFFFFF` - Pure white
- **cloudNine** `#F9FAFB` - Page backgrounds
- **foggyMorning** `#F3F4F6` - Card backgrounds, subtle backgrounds
- **silverLining** `#E5E7EB` - Borders, dividers
- **slateSkate** `#9CA3AF` - Disabled text, placeholders
- **stormCloud** `#6B7280` - Secondary text
- **midnightMystery** `#374151` - Primary text
- **charcoalChampion** `#1F2937` - Headings, emphasis
- **voidVibes** `#111827` - Maximum contrast text

**Use for:** Text, backgrounds, borders, shadows

### Status Colors

#### Success (The Winners) 🏆
- **mintyFresh** `#10B981` - Success messages, completed states
- **limelight** `#34D399` - Light success backgrounds
- **forestFriend** `#059669` - Dark success text

#### Warning (The Heads-Up Crew) ⚠️
- **bananaBonanza** `#FBBF24` - Warning messages
- **goldenGlow** `#FDE68A` - Light warning backgrounds
- **honeyBuzz** `#F59E0B` - Dark warning text

#### Error (The Oops Squad) ❌
- **strawberryShock** `#EF4444` - Error messages, validation
- **blushBerry** `#FCA5A5` - Light error backgrounds
- **crimsonCrisis** `#DC2626` - Dark error text

#### Info (The Knowledge Nuggets) ℹ️
- **skyDiver** `#3B82F6` - Info messages
- **oceanBreeze** `#93C5FD` - Light info backgrounds
- **deepDive** `#2563EB` - Dark info text

### Special Colors (The Party Mix) 🎉
- **lavenderLatte** `#A78BFA` - Purple accents, creative elements
- **rosyPosy** `#F472B6` - Pink accents, fun highlights
- **tealTango** `#14B8A6` - Teal accents, fresh elements
- **grapeJuice** `#8B5CF6` - Vibrant purple, standout elements

**Use for:** Special features, accent elements, creative sections

## Usage Examples

### Method 1: Tailwind Classes (Recommended)

```tsx
// Using funny names directly
<button className="bg-electric-blueberry text-snowflake-surprise hover:bg-soft-serve">
  Click Me
</button>

// Status colors
<div className="bg-minty-fresh text-snowflake-surprise">
  Success!
</div>

// Text colors
<p className="text-midnight-mystery">
  Primary text
</p>
```

### Method 2: Semantic Aliases

```tsx
// Generic, reusable
<button className="bg-primary hover:bg-primary-light text-text-inverse">
  Primary Action
</button>

<div className="bg-background text-text-primary">
  Content
</div>

<span className="text-text-secondary">
  Secondary text
</span>
```

### Method 3: Direct Import (for dynamic/inline styles)

```tsx
import { colors } from '@/config/colors';

<div style={{
  backgroundColor: colors.electricBlueberry,
  color: colors.snowflakeSurprise
}}>
  Inline styled
</div>

// Dynamic selection
const statusColor = isSuccess
  ? colors.mintyFresh
  : colors.strawberryShock;
```

## Common Patterns

### Buttons
```tsx
// Primary
<button className="bg-electric-blueberry hover:bg-soft-serve text-snowflake-surprise">

// Secondary
<button className="bg-sunny-delight hover:bg-butterscotch-dream text-void-vibes">

// Success
<button className="bg-minty-fresh hover:bg-limelight text-snowflake-surprise">
```

### Cards
```tsx
<div className="bg-snowflake-surprise border border-silver-lining rounded-lg">
  <h3 className="text-charcoal-champion">Title</h3>
  <p className="text-storm-cloud">Description</p>
</div>
```

### Forms
```tsx
<input
  className="border-silver-lining focus:border-electric-blueberry
             text-midnight-mystery placeholder:text-slate-skate
             bg-snowflake-surprise"
/>
```

### Alerts
```tsx
// Success
<div className="bg-limelight border-l-4 border-minty-fresh text-forest-friend">

// Error
<div className="bg-blush-berry border-l-4 border-strawberry-shock text-crimson-crisis">

// Warning
<div className="bg-golden-glow border-l-4 border-banana-bonanza text-honey-buzz">
```

## Adding New Colors

1. **Add to `colors.ts`:**
```typescript
export const colors = {
  // ... existing colors
  bubblegumBlast: '#FF69B4',
} as const;
```

2. **Add to `tailwind.config.ts`:**
```typescript
colors: {
  // ... existing colors
  'bubblegum-blast': colors.bubblegumBlast,
}
```

3. **Use it:**
```tsx
<div className="bg-bubblegum-blast">
  Party time!
</div>
```

## Best Practices

✅ **DO:**
- Use semantic names for reusable components
- Use funny names for specific, branded elements
- Keep color usage consistent across similar components
- Document color usage in component files

❌ **DON'T:**
- Hardcode hex values (`#4F46E5`)
- Use generic color names (`blue`, `red`)
- Create one-off colors for single uses
- Skip updating Tailwind config when adding colors

## Quick Reference

| Use Case | Recommended Colors |
|----------|-------------------|
| Primary CTA | `electric-blueberry` |
| Secondary CTA | `sunny-delight` |
| Body text | `midnight-mystery` |
| Secondary text | `storm-cloud` |
| Disabled text | `slate-skate` |
| Background | `cloud-nine` |
| Card background | `snowflake-surprise` |
| Borders | `silver-lining` |
| Success | `minty-fresh` |
| Warning | `banana-bonanza` |
| Error | `strawberry-shock` |
| Info | `sky-diver` |

---

Remember: **Keep it colorful, keep it central, keep it fun!** 🎨✨
