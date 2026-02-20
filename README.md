# TradeReplay

Options, Crypto & Futures Replay & Signal Intelligence Platform.

## Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **shadcn/ui** components (Button, Card, Badge, Accordion, Separator)
- **lucide-react** icons
- **framer-motion** for subtle scroll animations

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout with metadata
│   ├── page.tsx            # Landing page
│   ├── globals.css         # Global styles + Tailwind directives
│   ├── backtesting/        # Stub route
│   ├── scoreboard/         # Stub route
│   ├── pricing/            # Stub route
│   ├── faq/                # Stub route
│   └── signin/             # Stub route
├── components/
│   ├── landing/
│   │   ├── navbar.tsx
│   │   ├── hero.tsx
│   │   ├── why-section.tsx
│   │   ├── feature-section.tsx
│   │   ├── pricing-section.tsx
│   │   ├── faq-section.tsx
│   │   ├── footer.tsx
│   │   ├── section-wrapper.tsx
│   │   ├── stub-page.tsx
│   │   ├── mock-preview-card.tsx
│   │   ├── mock-chain-card.tsx
│   │   ├── mock-scoreboard.tsx
│   │   └── mock-report-card.tsx
│   └── ui/
│       ├── accordion.tsx
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       └── separator.tsx
└── lib/
    ├── design-tokens.ts    # Color, spacing, typography tokens
    └── utils.ts            # cn() helper
```

## Design Tokens

Colors, spacing, and typography values are defined in `src/lib/design-tokens.ts` and mirrored in `tailwind.config.ts` for use via utility classes.
