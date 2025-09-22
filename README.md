# prompt-canvas

![NPM Downloads](https://img.shields.io/npm/dw/prompt-canvas)
![GitHub Repo stars](https://img.shields.io/github/stars/adiasg/prompt-canvas)

Visual prompts for coding agents directly from your frontend. A React component for annotating changes & sending them to coding agents.

![Prompt Canvas Demo](assets/prompt-canvas-quick-demo.gif)

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

Then, run the dev server `npm run dev` and open the web app in the browser.  
**Supported browsers:** Chrome, Firefox. 

## Keyboard Shortcuts

| Shortcut         | Tool              |
|------------------|-------------------|
| P                | Pen               |
| B                | Box               |
| T                | Text              |
| E                | Eraser            |
| ⌘C               | Copy screenshot   |
| ⌘Z / ⌘⇧Z         | Undo / Redo       |
