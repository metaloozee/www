# PROJECT KNOWLEDGE BASE

**Generated:** 2026-01-15  
**Stack:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS

## OVERVIEW

Personal portfolio website for "Ayan" - interactive chat-style UI with animated message bubbles. Single-page app with dynamic content sections (about, projects, contact).

## STRUCTURE

```
website-2024/
├── src/
│   ├── app/              # Next.js App Router (layout, page, globals.css)
│   ├── components/       # Feature components (message.tsx, markdown.tsx)
│   │   └── ui/           # shadcn/ui primitives (button, card, avatar, dropdown-menu)
│   └── lib/              # Utilities (cn() helper)
├── public/assets/        # Static images
└── [configs]             # tailwind, tsconfig, biome via ultracite
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Page content/copy | `src/app/page.tsx` | All text hardcoded in message arrays |
| Add new section | `src/app/page.tsx` | Follow `handleAboutMe` pattern |
| UI primitives | `src/components/ui/` | shadcn/ui - use CVA variants |
| Chat bubbles | `src/components/message.tsx` | MessageGroup + MessageCard |
| Theme colors | `src/app/globals.css` | CSS custom properties (--background, etc) |
| Tailwind config | `tailwind.config.ts` | Extended theme with HSL color system |

## CONVENTIONS

- **Imports**: Use `@/*` alias for `src/*` paths
- **Components**: Function components only, `forwardRef` for UI primitives
- **Styling**: Tailwind + `cn()` helper from `@/lib/utils`
- **Animations**: Framer Motion variants pattern (see `groupVariant`, `itemVariant`)
- **Dark mode**: Class-based via `next-themes`, default theme is dark

## ANTI-PATTERNS

- No `as any` or `@ts-ignore` - Ultracite enforces strict types
- No barrel exports - import directly from component files
- No `console.log` in production code
- Avoid `dangerouslySetInnerHTML` - use react-markdown instead

## UNIQUE STYLES

- **Lowercase text**: All displayed text runs through `.toLocaleLowerCase()`
- **Purple accent links**: `bg-purple-50/10 text-purple-300` for markdown links
- **Message pattern**: Content passed as `{key, content}[]` arrays to MessageGroup
- **Card backgrounds**: `bg-zinc-900/50` semi-transparent dark cards

## COMMANDS

```bash
bun dev          # Start dev server (localhost:3000)
bun build        # Production build
bun lint         # Next.js lint
bun x ultracite fix    # Format + lint fix (pre-commit hook runs this)
bun x ultracite check  # Check without fixing
```

## NOTES

- **No tests**: No testing infrastructure configured yet
- **React 19**: Use ref as prop (not forwardRef) for new components
- **Husky**: Pre-commit runs `ultracite fix` via lint-staged
- **Package manager**: pnpm (see packageManager field)
- **Geist font**: Applied via `GeistSans.className` on body
