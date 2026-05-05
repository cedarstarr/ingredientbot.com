# IngredientBot

AI-powered recipe tool. Enter ingredients you have on hand and get recipe suggestions from Claude — with a split-panel kitchen interface for hands-free cooking.

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Database**: Railway PostgreSQL + Prisma ORM
- **Auth**: NextAuth.js v4 (credentials)
- **AI**: Claude (`claude-sonnet-4-6` via Anthropic SDK)
- **Hosting**: Vercel

## Features

- **Split-panel kitchen UI**: Recipe on the left, step-by-step guide on the right — optimized for cooking alongside your device
- **Ingredient-first search**: Input what you have, get recipes that use them
- **AI recipe generation**: Claude generates recipes tailored to your exact ingredient list
- **Recipe history**: Save and revisit past generations
- **Admin panel**: User management and platform monitoring

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3010](http://localhost:3010) in your browser.
