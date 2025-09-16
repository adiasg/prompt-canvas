# @adiasg/dev-overlay

A developer overlay for building web apps visually. This repo provides a React component for easily annotating UI changes & sending them to coding agents.

## Install

```bash
npm i @adiasg/dev-overlay
```

## Usage (NextJS App Router)

Mount the client component in `app/layout.tsx` only when in development mode:

```tsx
import { DevOverlay } from '@adiasg/dev-overlay';
// ...
// Place this anywhere in your body
{process.env.NODE_ENV === 'development' && <DevOverlay />}
// ...
```

## Features
- Drawable canvas with annotation tools.
- Tool shortcuts: P (Pen), T (Text), E (Eraser), C (Copy screenshot), ⌘Z / ⌘⇧Z (Undo/Redo).
