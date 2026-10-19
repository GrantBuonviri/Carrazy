import { normalizeRect, type Rect } from "../engine";
import type { Renderer } from "./renderer";

export interface DragHandlers {
  /** Called continuously while dragging (and with null when the drag ends or is cancelled). */
  onPreview(rect: Rect | null, clientX: number, clientY: number): void;
  /** Called when the pointer is released over a finished drag. */
  onCommit(rect: Rect): void;
}

/** Pointer-based drag selection (mouse, pen and touch). */
export function attachDragInput(renderer: Renderer, handlers: DragHandlers): void {
  const canvas = renderer.canvas;
  let anchor: { x: number; y: number } | null = null;
  let current: Rect | null = null;
  let pointerId: number | null = null;

  const update = (e: PointerEvent) => {
    if (!anchor) return;
    const c = renderer.cellAt(e.clientX, e.clientY);
    current = normalizeRect(anchor.x, anchor.y, c.x, c.y);
    handlers.onPreview(current, e.clientX, e.clientY);
  };

  const cancel = () => {
    if (pointerId !== null && canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
    anchor = null;
    current = null;
    pointerId = null;
    handlers.onPreview(null, 0, 0);
  };

  canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || anchor) return;
    e.preventDefault();
    pointerId = e.pointerId;
    canvas.setPointerCapture(e.pointerId);
    anchor = renderer.cellAt(e.clientX, e.clientY);
    update(e);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerId === pointerId) update(e);
  });
  canvas.addEventListener("pointerup", (e) => {
    if (e.pointerId !== pointerId) return;
    update(e);
    const rect = current;
    cancel();
    if (rect) handlers.onCommit(rect);
  });
  canvas.addEventListener("pointercancel", cancel);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && anchor) cancel();
  });
}
