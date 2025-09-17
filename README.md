# prompt-canvas


Visual prompts for coding agents directly from your frontend. This repo provides a React component for easily annotating changes & sending them to coding agents.

## Install

```bash
npm install prompt-canvas
```

## Usage (NextJS App Router)

Mount the client component in `app/layout.tsx` only when in development mode:

```tsx
import { PromptCanvas } from 'prompt-canvas';
// ...
// Place this in your body
{process.env.NODE_ENV === 'development' && <PromptCanvas />}
// ...
```

## Features
- Drawable canvas with annotation tools.
- Tool shortcuts: P (Pen), T (Text), E (Eraser), C (Copy screenshot), ⌘Z / ⌘⇧Z (Undo/Redo).
