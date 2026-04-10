# Money Calendar Project Architecture

## Core Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS

## Folder Structure

```txt
ad-site/
├─ app/                      # App Router entry and route segments
│  ├─ globals.css            # Global style and design tokens
│  ├─ layout.tsx             # Root shared layout
│  └─ page.tsx               # Landing dashboard page
├─ docs/
│  └─ ARCHITECTURE.md        # Architecture and standards
├─ src/
│  ├─ components/
│  │  ├─ layout/             # App shell/header/shared structures
│  │  └─ ui/                 # Reusable display components
│  ├─ features/
│  │  └─ finance/            # Finance state logic and feature modules
│  ├─ lib/
│  │  ├─ export/             # xlsx export utilities
│  │  └─ format/             # number/currency formatting
│  ├─ services/              # APIs and external integrations
│  └─ types/                 # Domain and table typing
├─ next.config.ts
├─ tailwind.config.ts
└─ tsconfig.json
```

## Mandatory System Guidelines

1. Every data table must provide xlsx export.
2. All monetary changes are represented in 1 KRW units with signed visualization.
3. UI uses minimalist spacing and trustworthy visual tone.

## Data Modeling Standards

- Income model separates actual/scheduled/other/aspirational incomes with priority.
- Budget model supports living/activity/essential/custom categories.
- Expense model stores budget delta snapshot (`before`, `after`, `delta`) and daily comment.
- Base state management uses reducer + selectors for predictable updates.
