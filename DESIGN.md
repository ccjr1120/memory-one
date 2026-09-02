# Memory One Design System

This is the visual source of truth for the personal memory workbench. It adapts the product-oriented conventions from [scribe's DESIGN.md](https://github.com/oliver-kriska/scribe/blob/main/DESIGN.md), especially its "Lab Notebook" direction, and the information-dense tool-panel rules from [Yakit Browser Agent's DESIGN.md](https://github.com/yaklang/yaklang-chrome-extension/blob/main/DESIGN.md).

## Direction

Memory One is a quiet local instrument, not a marketing page. The interface should feel like a carefully kept lab notebook: evidence first, readable content, precise metadata, and only one saturated accent. The primary experience is a three-zone workbench: workspace navigation, searchable memory stream, and an optional detail inspector.

## Visual Rules

- Use a cool near-white canvas in light mode and a near-black blue-tinted canvas in dark mode.
- Use Prompt Blue (`oklch(55% 0.18 255)` light, `oklch(71% 0.16 255)` dark) as the only saturated interface accent.
- Keep surfaces flat with one-pixel borders at rest. Reserve shadow for hover, modal, and selected states.
- Use system sans for human-readable content and monospace for labels, dates, IDs, counts, and statuses.
- Use a restrained radius scale: 6px controls, 10px content cards, 14px modal surfaces, pill radius only for taxonomy badges.
- Use compact 8px-based spacing and a shallow type hierarchy. Large display type belongs only to the page title.
- Every interaction needs a visible focus ring, a clear hover state, and a reduced-motion fallback.

## Components

- **Workspace navigation:** persistent desktop rail; drawer below 760px. Navigation is quiet and functional, with counts aligned in monospace.
- **Memory card:** bordered, flat at rest; shows type, time, content, project/scope, and confidence. Hover/selection is the main elevation signal.
- **Inspector:** right-side detail panel on wide screens; metadata is grouped with hairline rules and signal bars.
- **Composer:** focused modal for one memory at a time; content is the dominant field and local persistence is explicit.
- **Search:** first-class toolbar control with `Cmd/Ctrl + K` focus shortcut and scope filters beside it.

## Non-goals

No gradients, glassmorphism, decorative blobs, stock imagery, oversized marketing hero, or arbitrary secondary accent colors. Visual interest should come from hierarchy, useful data, and careful interaction states.
