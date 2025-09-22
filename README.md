# prompt-canvas

![NPM Downloads](https://img.shields.io/npm/dw/prompt-canvas)
![GitHub Repo stars](https://img.shields.io/github/stars/adiasg/prompt-canvas)

Visual prompts for coding agents directly from your frontend. A React component for annotating changes & sending them to coding agents.

![Prompt Canvas Demo](assets/prompt-canvas-box-demo.gif)

## Quickstart

[![Install prompt-canvas](https://cursor.com/deeplink/mcp-install-dark.svg)](cursor://anysphere.cursor-deeplink/prompt?text=Install%20prompt-canvas%2C%20a%20developer%20overlay%20for%20drawing%20on%20the%20frontend.%20Look%20up%20the%20latest%20package%20documentation%20for%20installation%20instructions.%20Here%20are%20basic%20details%3A%20First%2C%20install%20the%20component%20using%20%60npm%20install%20prompt-canvas%60.%20Then%2C%20place%20the%20React%20component%20PromptCanvas%20in%20the%20top-level%20layout%20of%20my%20NextJS%20application.%20Use%20this%20named%20import%3A%20%60import%20%7B%20PromptCanvas%20%7D%20from%20'prompt-canvas'%60.)

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
