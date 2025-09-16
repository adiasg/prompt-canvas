'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toPng } from 'html-to-image';
import { Camera, Copy, Eraser, Eye, EyeOff, Pen, Redo2, Type, Undo2, X } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';

type Tool = 'none' | 'pen' | 'text' | 'erase';

type StrokePoint = { x: number; y: number };
type StrokeAction = {
  type: 'stroke';
  tool: 'pen' | 'erase';
  color: string;
  width: number;
  points: StrokePoint[];
};
type TextAddAction = {
  type: 'text';
  id: number;
  value: string;
  x: number;
  y: number;
  size: number;
  color: string;
  w: number;
  h: number;
};
type MoveTextAction = {
  type: 'moveText';
  id: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
};
type Action = StrokeAction | TextAddAction | MoveTextAction;

export type DevOverlayProps = {
  strokeColor?: string;
  strokeWidth?: number;
  textSize?: number;
  defaultOpen?: boolean;
  onScreenshot?: (dataUrl: string) => void;
  onNotify?: (title: string, opts?: { description?: string; variant?: 'info' | 'success' | 'error' }) => void;
};

const OVERLAY_STORAGE_KEY = 'dev-overlay:visible';

export function DevOverlay(props: DevOverlayProps) {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  const [isVisible, setIsVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = window.localStorage.getItem(OVERLAY_STORAGE_KEY);
    if (saved == null) return true;
    return saved === 'true';
  });
  const [activeTool, setActiveTool] = useState<Tool>('none');
  const [strokeColor] = useState<string>(props.strokeColor ?? '#ff2d55');
  const [strokeWidth] = useState<number>(props.strokeWidth ?? 3);
  const [textSize] = useState<number>(props.textSize ?? 16);
  const [isDockOpen, setIsDockOpen] = useState<boolean>(props.defaultOpen ?? false);
  const [isTextBoxVisible, setIsTextBoxVisible] = useState<boolean>(false);
  const [textBoxValue, setTextBoxValue] = useState<string>('');
  const [textBoxPos, setTextBoxPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const [isHoveringText, setIsHoveringText] = useState<boolean>(false);
  const [isDraggingText, setIsDraggingText] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const dockRef = useRef<HTMLDivElement | null>(null);
  const isDrawingRef = useRef<boolean>(false);
  const currentStrokeRef = useRef<StrokeAction | null>(null);
  const historyRef = useRef<Action[]>([]);
  const redoRef = useRef<Action[]>([]);
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);
  const nextTextIdRef = useRef<number>(1);

  const draggingTextRef = useRef<
    | {
        id: number;
        offsetX: number;
        offsetY: number;
        startX: number;
        startY: number;
        currentX: number;
        currentY: number;
      }
    | null
  >(null);
  const didDragRef = useRef<boolean>(false);

  // notifier
  type ToastVariant = 'info' | 'success' | 'error';
  type ToastItem = { id: number; title: string; description?: string; variant: ToastVariant; durationMs: number };
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastIdRef = useRef<number>(0);
  const [toastBottomOffset, setToastBottomOffset] = useState<number>(16);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateOffset = () => {
      const el = dockRef.current;
      if (!el) {
        setToastBottomOffset(24);
        return;
      }
      const rect = el.getBoundingClientRect();
      setToastBottomOffset(Math.max(24, Math.ceil(rect.height) + 28));
    };
    updateOffset();
    window.addEventListener('resize', updateOffset);
    const id = window.setInterval(updateOffset, 300);
    return () => {
      window.removeEventListener('resize', updateOffset);
      window.clearInterval(id);
    };
  }, [isDockOpen]);

  const notify = (title: string, opts?: { description?: string; variant?: ToastVariant; durationMs?: number }) => {
    if (props.onNotify) props.onNotify(title, { description: opts?.description, variant: opts?.variant });
    const item: ToastItem = {
      id: ++toastIdRef.current,
      title,
      description: opts?.description,
      variant: opts?.variant ?? 'info',
      durationMs: opts?.durationMs ?? 2200,
    };
    setToasts((prev) => [item, ...prev].slice(0, 3));
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== item.id)), item.durationMs);
  };

  // Inject minimal CSS to emulate shadcn-like buttons without requiring Tailwind
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const STYLE_ID = 'do-injected-styles';
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .do-btn{display:inline-flex;align-items:center;justify-content:center;border-radius:8px;border:none;background:transparent;color:inherit;cursor:pointer;transition:background-color .15s ease,border-color .15s ease,box-shadow .15s ease,transform .05s ease}
      .do-btn:disabled{opacity:.45;cursor:not-allowed}
      .do-btn:focus-visible{outline:none;box-shadow:0 0 0 2px #fff,0 0 0 4px rgba(0,0,0,.75)}
      .do-variant-ghost{background:transparent}
      .do-variant-ghost:hover{background:rgba(0,0,0,.05)}
      .do-variant-outline{background:#fff;border:1px solid rgba(0,0,0,.12)}
      .do-variant-outline:hover{background:#fff;border-color:rgba(0,0,0,.18)}
      .do-variant-default{background:#111827;color:#fff;border-color:transparent}
      .do-variant-default:hover{background:#0b1220}
      .do-active{background:#111827;color:#fff}
      .do-active:hover{background:#111827}
      .do-size-icon{height:36px;width:36px}
      .do-size-icon-lg{height:40px;width:40px}
      .do-size-fab{height:48px;width:48px}
      .do-size-36{height:36px}
      .do-rounded-full{border-radius:999px}
      .do-shadow{box-shadow:0 6px 20px rgba(0,0,0,.15)}
    `;
    document.head.appendChild(style);
    return () => {
      // keep it around; no removal to avoid flicker if multiple instances mount
    };
  }, []);

  // preserve local visibility
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(OVERLAY_STORAGE_KEY, String(isVisible));
  }, [isVisible]);

  // canvas resize with dpr
  const resizeCanvas = useMemo(() => {
    return () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const { innerWidth, innerHeight } = window;
      canvas.width = Math.floor(innerWidth * dpr);
      canvas.height = Math.floor(innerHeight * dpr);
      canvas.style.width = `${innerWidth}px`;
      canvas.style.height = `${innerHeight}px`;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (typeof ctx.setTransform === 'function') ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
      }
    };
  }, []);

  useEffect(() => {
    resizeCanvas();
    const onResize = () => {
      resizeCanvas();
      renderScene();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [resizeCanvas]);

  // lock scroll when dock open and visible
  const prevScrollStylesRef = useRef<
    | {
        htmlOverflow: string;
        bodyOverflow: string;
        htmlOverscrollBehavior: string;
        bodyOverscrollBehavior: string;
        htmlTouchAction: string;
        bodyTouchAction: string;
      }
    | null
  >(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const html = document.documentElement as HTMLElement;
    const body = document.body as HTMLElement;
    const lockScroll = () => {
      if (!prevScrollStylesRef.current) {
        prevScrollStylesRef.current = {
          htmlOverflow: html.style.overflow,
          bodyOverflow: body.style.overflow,
          htmlOverscrollBehavior: (html.style as any).overscrollBehavior || '',
          bodyOverscrollBehavior: (body.style as any).overscrollBehavior || '',
          htmlTouchAction: (html.style as any).touchAction || '',
          bodyTouchAction: (body.style as any).touchAction || '',
        };
      }
      html.style.overflow = 'hidden';
      body.style.overflow = 'hidden';
      (html.style as any).overscrollBehavior = 'none';
      (body.style as any).overscrollBehavior = 'none';
      (html.style as any).touchAction = 'none';
      (body.style as any).touchAction = 'none';
    };
    const unlockScroll = () => {
      const prev = prevScrollStylesRef.current;
      if (!prev) return;
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      (html.style as any).overscrollBehavior = prev.htmlOverscrollBehavior;
      (body.style as any).overscrollBehavior = prev.bodyOverscrollBehavior;
      (html.style as any).touchAction = prev.htmlTouchAction;
      (body.style as any).touchAction = prev.bodyTouchAction;
      prevScrollStylesRef.current = null;
    };
    if (isDockOpen && isVisible) lockScroll();
    else unlockScroll();
    return () => unlockScroll();
  }, [isDockOpen, isVisible]);

  // ensure sizing after first paint
  useEffect(() => {
    if (!isMounted) return;
    const id = window.requestAnimationFrame(() => resizeCanvas());
    return () => window.cancelAnimationFrame(id);
  }, [isMounted, resizeCanvas]);

  const getCtx = () => canvasRef.current?.getContext('2d') ?? null;

  const isTransientUiElement = (node: Node | null): boolean => {
    if (!(node instanceof HTMLElement)) return false;
    // Exclude Radix tooltip content
    if (
      node.getAttribute('role') === 'tooltip' ||
      node.closest('[role="tooltip"]') ||
      node.hasAttribute('data-radix-popper-content-wrapper') ||
      node.closest('[data-radix-popper-content-wrapper]')
    )
      return true;
    if (node.hasAttribute('data-dev-overlay-notifier') || node.closest('[data-dev-overlay-notifier]')) return true;
    return false;
  };

  const measureTextBlock = (value: string, size: number) => {
    const c = document.createElement('canvas');
    const ctx = c.getContext('2d');
    if (!ctx) return { width: 0, height: Math.round(size * 1.3) };
    ctx.font = `${size}px ui-sans-serif, system-ui, -apple-system`;
    const lines = value.split(/\n/);
    let maxWidth = 0;
    for (const line of lines) {
      const w = ctx.measureText(line).width;
      if (w > maxWidth) maxWidth = w;
    }
    const lineHeight = Math.round(size * 1.3);
    const height = Math.max(lineHeight, lineHeight * lines.length);
    return { width: maxWidth, height };
  };

  const updateUndoRedoState = () => {
    setCanUndo(historyRef.current.length > 0);
    setCanRedo(redoRef.current.length > 0);
  };

  const computeFinalTextMap = () => {
    const map = new Map<number, TextAddAction>();
    for (const action of historyRef.current) {
      if (action.type === 'text') map.set(action.id, { ...action });
      else if (action.type === 'moveText') {
        const existing = map.get(action.id);
        if (existing) {
          existing.x = action.to.x;
          existing.y = action.to.y;
          map.set(action.id, existing);
        }
      }
    }
    if (draggingTextRef.current) {
      const d = draggingTextRef.current;
      const ex = map.get(d.id);
      if (ex) {
        ex.x = d.currentX;
        ex.y = d.currentY;
        map.set(d.id, ex);
      }
    }
    return map;
  };

  const renderScene = () => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!(ctx && canvas)) return;
    ctx.save();
    if (typeof ctx.setTransform === 'function') ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    const finalTextMap = computeFinalTextMap();

    for (const action of historyRef.current) {
      if (action.type === 'stroke') {
        if (action.points.length < 1) continue;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = action.color;
        ctx.lineWidth = action.tool === 'erase' ? action.width * 3 : action.width;
        ctx.globalCompositeOperation = action.tool === 'erase' ? 'destination-out' : 'source-over';
        ctx.beginPath();
        const [first, ...rest] = action.points;
        ctx.moveTo(first.x, first.y);
        for (const p of rest) ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.restore();
      } else if (action.type === 'text') {
        const t = finalTextMap.get(action.id);
        if (!t) continue;
        ctx.save();
        ctx.font = `${t.size}px ui-sans-serif, system-ui, -apple-system`;
        ctx.fillStyle = t.color;
        ctx.textBaseline = 'top';
        const lines = t.value.split(/\n/);
        const lineHeight = Math.round(t.size * 1.3);
        for (let i = 0; i < lines.length; i++) ctx.fillText(lines[i] ?? '', t.x, t.y + i * lineHeight);
        ctx.restore();
      }
    }

    if (currentStrokeRef.current && currentStrokeRef.current.points.length > 0) {
      const s = currentStrokeRef.current;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.tool === 'erase' ? s.width * 3 : s.width;
      ctx.globalCompositeOperation = s.tool === 'erase' ? 'destination-out' : 'source-over';
      ctx.beginPath();
      const [first, ...rest] = s.points;
      ctx.moveTo(first.x, first.y);
      for (const p of rest) ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.restore();
    }
  };

  const getPointerPos = (evt: MouseEvent | TouchEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    if ('touches' in (evt as any) || 'changedTouches' in (evt as any)) {
      const touchEvt = evt as unknown as TouchEvent;
      const t = touchEvt.touches?.[0] ?? touchEvt.changedTouches?.[0];
      return { x: (t?.clientX ?? 0) - rect.left, y: (t?.clientY ?? 0) - rect.top };
    }
    const me = evt as MouseEvent;
    return { x: me.clientX - rect.left, y: me.clientY - rect.top };
  };

  const isPointInText = (x: number, y: number, t: { x: number; y: number; w: number; h: number }) =>
    x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h;

  const handlePointerDown = (evt: MouseEvent | TouchEvent) => {
    if (!isVisible) return;
    if (!isDockOpen || activeTool === 'none') return;
    const { x, y } = getPointerPos(evt);
    if ('touches' in (evt as any) || 'changedTouches' in (evt as any)) (evt as any).preventDefault?.();

    // drag text if clicking on it
    {
      const texts = Array.from(computeFinalTextMap().values());
      for (let i = texts.length - 1; i >= 0; i--) {
        const t = texts[i]!;
        if (isPointInText(x, y, t)) {
          draggingTextRef.current = {
            id: t.id,
            offsetX: x - t.x,
            offsetY: y - t.y,
            startX: t.x,
            startY: t.y,
            currentX: t.x,
            currentY: t.y,
          };
          didDragRef.current = false;
          setIsDraggingText(true);
          setIsHoveringText(true);
          return;
        }
      }
    }

    if (activeTool === 'text') {
      setIsHoveringText(false);
      return;
    }

    isDrawingRef.current = true;
    setIsHoveringText(false);
    currentStrokeRef.current = {
      type: 'stroke',
      tool: activeTool === 'erase' ? 'erase' : 'pen',
      color: strokeColor,
      width: strokeWidth,
      points: [{ x, y }],
    };
    renderScene();
  };

  const handlePointerMove = (evt: MouseEvent | TouchEvent) => {
    if (!isVisible) return;
    if (!isDockOpen || activeTool === 'none') return;
    if ('touches' in (evt as any) || 'changedTouches' in (evt as any)) (evt as any).preventDefault?.();
    const { x, y } = getPointerPos(evt);

    if (draggingTextRef.current) {
      draggingTextRef.current.currentX = x - draggingTextRef.current.offsetX;
      draggingTextRef.current.currentY = y - draggingTextRef.current.offsetY;
      didDragRef.current = true;
      renderScene();
      return;
    }

    // hover detection
    const texts = Array.from(computeFinalTextMap().values());
    let over = false;
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i]!;
      if (isPointInText(x, y, t)) {
        over = true;
        break;
      }
    }
    setIsHoveringText(over);

    if (isDrawingRef.current && currentStrokeRef.current) {
      currentStrokeRef.current.points.push({ x, y });
      renderScene();
    }
  };

  const handlePointerUp = () => {
    if (draggingTextRef.current) {
      const d = draggingTextRef.current;
      const moved = d.startX !== d.currentX || d.startY !== d.currentY;
      if (moved) {
        historyRef.current.push({ type: 'moveText', id: d.id, from: { x: d.startX, y: d.startY }, to: { x: d.currentX, y: d.currentY } });
        redoRef.current = [];
        updateUndoRedoState();
      }
      draggingTextRef.current = null;
      setIsDraggingText(false);
      renderScene();
      return;
    }
    if (isDrawingRef.current && currentStrokeRef.current) {
      if (currentStrokeRef.current.points.length > 1) {
        historyRef.current.push(currentStrokeRef.current);
        redoRef.current = [];
        updateUndoRedoState();
      }
      isDrawingRef.current = false;
      currentStrokeRef.current = null;
      renderScene();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onMouseDown = (e: MouseEvent) => handlePointerDown(e);
    const onMouseMove = (e: MouseEvent) => handlePointerMove(e);
    const onMouseUp = () => handlePointerUp();
    const onMouseLeave = () => {
      if (!draggingTextRef.current) setIsHoveringText(false);
    };
    const onTouchStart = (e: TouchEvent) => handlePointerDown(e);
    const onTouchMove = (e: TouchEvent) => handlePointerMove(e);
    const onTouchEnd = () => handlePointerUp();

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [activeTool, strokeColor, strokeWidth, isVisible, isDockOpen]);

  // place text when clicking with text tool
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onClick = (e: MouseEvent) => {
      if (!(isVisible && isDockOpen) || activeTool !== 'text') return;
      if (didDragRef.current) {
        didDragRef.current = false;
        return;
      }
      const { x, y } = getPointerPos(e);
      setTextBoxPos({ x, y });
      setTextBoxValue('');
      setIsTextBoxVisible(true);
    };
    canvas.addEventListener('click', onClick);
    return () => canvas.removeEventListener('click', onClick);
  }, [activeTool, isVisible, strokeColor, textSize, isDockOpen]);

  useEffect(() => {
    if (isTextBoxVisible) {
      const id = window.requestAnimationFrame(() => textAreaRef.current?.focus());
      return () => window.cancelAnimationFrame(id);
    }
  }, [isTextBoxVisible]);

  const commitTextToCanvas = (value: string, position: { x: number; y: number }) => {
    if (!value.trim()) return;
    const measured = measureTextBlock(value, textSize);
    const action: TextAddAction = {
      type: 'text',
      id: nextTextIdRef.current++,
      value,
      x: position.x,
      y: position.y,
      size: textSize,
      color: strokeColor,
      w: measured.width,
      h: measured.height,
    };
    historyRef.current.push(action);
    redoRef.current = [];
    updateUndoRedoState();
    renderScene();
  };

  const closeTextBox = () => {
    setIsTextBoxVisible(false);
    setTextBoxValue('');
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!(canvas && ctx)) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    historyRef.current = [];
    redoRef.current = [];
    updateUndoRedoState();
  };

  const downloadDataUrl = (filename: string, dataUrl: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const captureComposite = async (): Promise<string | null> => {
    try {
      const overlay = canvasRef.current;
      if (!overlay) return null;
      const dpr = window.devicePixelRatio || 1;
      const filter = (node: HTMLElement) => {
        const wrapper = wrapperRef.current;
        if (isTransientUiElement(node)) return false;
        if (!wrapper) return true;
        return !wrapper.contains(node);
      };
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const scrollX = Math.max(0, Math.round(window.scrollX || window.pageXOffset || 0));
      const scrollY = Math.max(0, Math.round(window.scrollY || window.pageYOffset || 0));
      const docWidth = Math.max(
        document.documentElement.scrollWidth,
        document.body ? document.body.scrollWidth : 0,
        viewportWidth
      );
      const docHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body ? document.body.scrollHeight : 0,
        viewportHeight
      );
      const domUrl = await toPng(document.documentElement, {
        pixelRatio: dpr,
        cacheBust: true,
        filter,
        width: viewportWidth,
        height: viewportHeight,
        style: {
          width: `${docWidth}px`,
          height: `${docHeight}px`,
          transform: `translate(${-scrollX}px, ${-scrollY}px)`,
          transformOrigin: 'top left',
        },
      });
      const out = document.createElement('canvas');
      out.width = overlay.width;
      out.height = overlay.height;
      const ctx = out.getContext('2d');
      if (!ctx) return null;
      const bgImg = new Image();
      bgImg.src = domUrl;
      await bgImg.decode();
      ctx.drawImage(bgImg, 0, 0, out.width, out.height);
      ctx.drawImage(overlay, 0, 0);
      return out.toDataURL('image/png');
    } catch {
      try {
        const overlay = canvasRef.current;
        if (!overlay) return null;
        return overlay.toDataURL('image/png');
      } catch {
        return null;
      }
    }
  };

  const handleScreenshot = async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const dataUrl = await captureComposite();
    if (!dataUrl) return;
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const name = `screenshot-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(
      now.getHours()
    )}${pad(now.getMinutes())}${pad(now.getSeconds())}.png`;
    downloadDataUrl(name, dataUrl);
    if (props.onScreenshot) props.onScreenshot(dataUrl);
    notify('Screenshot saved!', { variant: 'success' });
  };

  const handleCopyToClipboard = async () => {
    try {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const dataUrl = await captureComposite();
      if (!dataUrl) return;
      const supportsClipboardWrite =
        typeof navigator !== 'undefined' && !!navigator.clipboard && typeof (globalThis as any).ClipboardItem !== 'undefined';
      if (supportsClipboardWrite) {
        const blob = await (await fetch(dataUrl)).blob();
        const item = new (globalThis as any).ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([item]);
        notify('Screenshot copied.', { variant: 'success' });
        return;
      }
    } catch {
      // ignore
    }
    notify('Copy failed. Please allow clipboard permissions.', { variant: 'error' });
  };

  const undo = () => {
    if (historyRef.current.length === 0) return;
    const action = historyRef.current.pop()!;
    redoRef.current.push(action);
    updateUndoRedoState();
    renderScene();
  };

  const redo = () => {
    if (redoRef.current.length === 0) return;
    const action = redoRef.current.pop()!;
    historyRef.current.push(action);
    updateUndoRedoState();
    renderScene();
  };

  // keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(isDockOpen && isVisible)) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || (target as any).isContentEditable;
        if (isEditable) return;
      }
      const key = e.key.toLowerCase();
      // Tool shortcuts without modifiers
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        if (key === 'p') {
          e.preventDefault();
          setActiveTool('pen');
          return;
        }
        if (key === 't') {
          e.preventDefault();
          setActiveTool('text');
          return;
        }
        if (key === 'e') {
          e.preventDefault();
          setActiveTool('erase');
          return;
        }
        if (key === 'c') {
          e.preventDefault();
          // Copy screenshot
          void handleCopyToClipboard();
          return;
        }
      }
      // Undo/redo with Meta/Ctrl
      const isMeta = e.metaKey || e.ctrlKey;
      if (!isMeta) return;
      if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDockOpen, isVisible]);

  useEffect(() => {
    if (!isDockOpen || !isVisible) {
      setIsHoveringText(false);
      setIsDraggingText(false);
    }
  }, [isDockOpen, isVisible]);

  if (!isMounted) return null;

  const canvasCursor = isDraggingText
    ? 'grabbing'
    : isHoveringText
    ? 'grab'
    : activeTool === 'text'
    ? 'text'
    : activeTool === 'pen' || activeTool === 'erase'
    ? 'crosshair'
    : 'default';
  const canvasPointerEvents = isDockOpen && activeTool !== 'none' ? 'auto' : 'none';

  const toolbarButtonStyle: React.CSSProperties = {};
  const toolbarButtonActiveStyle: React.CSSProperties = { background: '#111827', color: '#fff' };

  return (
    <>
      <div
        aria-hidden={false}
        ref={wrapperRef}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 2147483644,
          pointerEvents: 'none',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            touchAction: 'none',
            userSelect: 'none',
            backgroundColor: 'transparent',
            cursor: canvasCursor as any,
            pointerEvents: !isVisible ? 'none' : (canvasPointerEvents as any),
          }}
        />

        {/* floating text box */}
        {isDockOpen && activeTool === 'text' && isTextBoxVisible && (
          <textarea
            ref={textAreaRef}
            placeholder="⌘+Enter to finish"
            value={textBoxValue}
            onChange={(e) => setTextBoxValue(e.target.value)}
            onBlur={() => {
              commitTextToCanvas(textBoxValue, textBoxPos);
              closeTextBox();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                commitTextToCanvas(textBoxValue, textBoxPos);
                closeTextBox();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                closeTextBox();
                setIsHoveringText(false);
              }
            }}
            style={{
              position: 'fixed',
              left: textBoxPos.x,
              top: textBoxPos.y,
              zIndex: 2147483646,
              minHeight: 32,
              minWidth: 96,
              resize: 'none',
              borderRadius: 8,
              background: 'rgba(255,255,255,0.9)',
              color: '#000',
              padding: 6,
              fontSize: 14,
              boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
              outline: 'none',
              border: '1px solid rgba(0,0,0,0.12)',
            }}
          />
        )}

        {/* Toolbar */}
        {!isDockOpen && (
          <div ref={dockRef} style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 2147483645, pointerEvents: 'auto' }}>
            <button
              aria-label="Open overlay toolbar"
              onClick={() => {
                setIsVisible(true);
                setIsDockOpen(true);
              }}
              style={{
                color: '#000',
              }}
              className="do-btn do-variant-outline do-size-fab do-rounded-full do-shadow"
              title="Open overlay"
            >
              <Pen size={20} strokeWidth={2.25} />
            </button>
          </div>
        )}

        {isDockOpen && (
          <div ref={dockRef} style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 2147483645, pointerEvents: 'auto' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: 6,
                borderRadius: 999,
                background: 'rgba(255,255,255,0.9)',
                boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
                border: '1px solid rgba(0,0,0,0.1)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <div style={{ width: 4 }} aria-hidden />

              <Tooltip.Provider delayDuration={200} skipDelayDuration={300} disableHoverableContent={false}>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <button
                      onClick={() => setActiveTool((t) => (t === 'pen' ? 'none' : 'pen'))}
                      style={{ ...toolbarButtonStyle, ...(activeTool === 'pen' ? toolbarButtonActiveStyle : null) }}
                      aria-label="Pen"
                      className={`do-btn do-variant-ghost do-size-icon ${activeTool === 'pen' ? 'do-active' : ''}`}
                    >
                      <Pen size={16} />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content sideOffset={8} style={{ background: '#111827', color: 'white', padding: '6px 8px', borderRadius: 6, fontSize: 12, boxShadow: '0 6px 20px rgba(0,0,0,0.2)' }}>
                      Pen (P)
                      <Tooltip.Arrow width={10} height={5} style={{ fill: '#111827' }} />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>

                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <button
                      onClick={() => setActiveTool((t) => (t === 'text' ? 'none' : 'text'))}
                      style={{ ...toolbarButtonStyle, ...(activeTool === 'text' ? toolbarButtonActiveStyle : null) }}
                      aria-label="Text"
                      className={`do-btn do-variant-ghost do-size-icon ${activeTool === 'text' ? 'do-active' : ''}`}
                    >
                      <Type size={16} />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content sideOffset={8} style={{ background: '#111827', color: 'white', padding: '6px 8px', borderRadius: 6, fontSize: 12, boxShadow: '0 6px 20px rgba(0,0,0,0.2)' }}>
                      Text (T)
                      <Tooltip.Arrow width={10} height={5} style={{ fill: '#111827' }} />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>

                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <button
                      onClick={() => setActiveTool((t) => (t === 'erase' ? 'none' : 'erase'))}
                      style={{ ...toolbarButtonStyle, ...(activeTool === 'erase' ? toolbarButtonActiveStyle : null) }}
                      aria-label="Eraser"
                      className={`do-btn do-variant-ghost do-size-icon ${activeTool === 'erase' ? 'do-active' : ''}`}
                    >
                      <Eraser size={16} />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content sideOffset={8} style={{ background: '#111827', color: 'white', padding: '6px 8px', borderRadius: 6, fontSize: 12, boxShadow: '0 6px 20px rgba(0,0,0,0.2)' }}>
                      Eraser (E)
                      <Tooltip.Arrow width={10} height={5} style={{ fill: '#111827' }} />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </Tooltip.Provider>

              <div style={{ height: 24, width: 1, background: 'rgba(0,0,0,0.1)', margin: '0 6px' }} />

              <Tooltip.Provider delayDuration={200}>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <button onClick={undo} disabled={!canUndo} style={{ ...toolbarButtonStyle, opacity: canUndo ? 1 : 0.4 }} aria-label="Undo" className={`do-btn do-variant-ghost do-size-icon ${canUndo ? '' : ''}`}>
                      <Undo2 size={16} />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content sideOffset={8} style={{ background: '#111827', color: 'white', padding: '6px 8px', borderRadius: 6, fontSize: 12, boxShadow: '0 6px 20px rgba(0,0,0,0.2)' }}>Undo (⌘Z)<Tooltip.Arrow width={10} height={5} style={{ fill: '#111827' }} /></Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <button onClick={redo} disabled={!canRedo} style={{ ...toolbarButtonStyle, opacity: canRedo ? 1 : 0.4 }} aria-label="Redo" className={`do-btn do-variant-ghost do-size-icon ${canRedo ? '' : ''}`}>
                      <Redo2 size={16} />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content sideOffset={8} style={{ background: '#111827', color: 'white', padding: '6px 8px', borderRadius: 6, fontSize: 12, boxShadow: '0 6px 20px rgba(0,0,0,0.2)' }}>Redo (⌘⇧Z)<Tooltip.Arrow width={10} height={5} style={{ fill: '#111827' }} /></Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </Tooltip.Provider>

              <div style={{ height: 24, width: 1, background: 'rgba(0,0,0,0.1)', margin: '0 6px' }} />

              <Tooltip.Provider delayDuration={200}>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <button onClick={handleCopyToClipboard} style={toolbarButtonStyle} aria-label="Copy screenshot" className="do-btn do-variant-ghost do-size-icon">
                      <Copy size={16} />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content sideOffset={8} style={{ background: '#111827', color: 'white', padding: '6px 8px', borderRadius: 6, fontSize: 12, boxShadow: '0 6px 20px rgba(0,0,0,0.2)' }}>Copy screenshot (C)<Tooltip.Arrow width={10} height={5} style={{ fill: '#111827' }} /></Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <button onClick={handleScreenshot} style={toolbarButtonStyle} aria-label="Save screenshot" className="do-btn do-variant-ghost do-size-icon">
                      <Camera size={16} />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content sideOffset={8} style={{ background: '#111827', color: 'white', padding: '6px 8px', borderRadius: 6, fontSize: 12, boxShadow: '0 6px 20px rgba(0,0,0,0.2)' }}>Save screenshot<Tooltip.Arrow width={10} height={5} style={{ fill: '#111827' }} /></Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </Tooltip.Provider>
              <button onClick={clearCanvas} title="Clear" style={{ ...toolbarButtonStyle, paddingInline: 8, width: 'auto' }} className="do-btn do-variant-ghost do-size-36">
                Clear
              </button>
              <button
                aria-label="Close overlay toolbar"
                onClick={() => setIsDockOpen(false)}
                title="Close"
                className="do-btn do-variant-outline do-size-icon-lg do-rounded-full"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {isMounted &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            data-dev-overlay-notifier
            role="status"
            aria-live="polite"
            style={{
              position: 'fixed',
              right: 16,
              bottom: toastBottomOffset,
              zIndex: 2147483646,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {toasts.map((t) => (
              <div
                key={t.id}
                style={{
                  minWidth: 240,
                  maxWidth: 360,
                  padding: '10px 12px',
                  borderRadius: 10,
                  color: 'white',
                  background: t.variant === 'success' ? '#16a34a' : t.variant === 'error' ? '#ef4444' : '#334155',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 14 }}>{t.title}</div>
                {t.description && (
                  <div style={{ opacity: 0.9, marginTop: 4, fontSize: 13 }}>{t.description}</div>
                )}
              </div>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}


