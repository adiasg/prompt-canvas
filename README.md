# prompt-canvas

![NPM Downloads](https://img.shields.io/npm/dw/prompt-canvas)
![GitHub Repo stars](https://img.shields.io/github/stars/adiasg/prompt-canvas)

Visual prompts for coding agents directly from your frontend. A React component for annotating changes & sending them to coding agents.

![Prompt Canvas Demo](assets/prompt-canvas-quick-demo.gif)

## Quickstart

Installation prompt:
```
Install prompt-canvas, a developer overlay for drawing on the frontend. Look up instructions in the repo README: https://github.com/adiasg/prompt-canvas.
```

### Install

```bash
npm install prompt-canvas
```

### Add to NextJS App Router 

Place the component in `app/layout.tsx` with:
```tsx
import { PromptCanvas } from 'prompt-canvas';
// ...
// Place this in your body
// Only mount in development mode
{process.env.NODE_ENV === 'development' && <PromptCanvas />}
// ...
```

### Usage

- Run the dev server (`npm run dev`) and open the web app in the browser. **Supported browsers:** Chrome, Firefox. 
- Draw changes, then copy screenshot (⌘C) to paste in your coding agent.

### Tips

- It helps to have design guidelines for the coding agent (`AGENTS.md`, `.cursor/rules`, etc.). Here's a great starter from [OpenAI's cookbook](https://cookbook.openai.com/examples/gpt-5/gpt-5_prompting_guide#matching-codebase-design-standards).

## Keyboard Shortcuts

| Shortcut         | Tool              |
|------------------|-------------------|
| P                | Pen               |
| B                | Box               |
| T                | Text              |
| E                | Eraser            |
| ⌘C               | Copy screenshot   |
| ⌘Z / ⌘⇧Z         | Undo / Redo       |
