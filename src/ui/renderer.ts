import type { GameState, Rect } from "../engine";
import { Tile } from "../engine";

export interface Palette {
  empty: string;
  light: string;
  dark: string;
  blocker: string;
  grid: string;
  valid: string;
  invalid: string;
  hint: string;
}

export function readPalette(): Palette {
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  const darkMode = matchMedia("(prefers-color-scheme: dark)").matches;
  return {
    empty: darkMode ? "#262c37" : "#e9ecf1",
    light: v("--light", "#9fd3ff"),
    dark: v("--dark", "#1f5fbf"),
    blocker: v("--block", "#d93636"),
    grid: darkMode ? "#1b2029" : "#ffffff",
    valid: "#1fa35c",
    invalid: "#d93636",
    hint: "#f2a900",
  };
}

const FLASH_MS = 260;
const DROP_MS = 220;
const DROP_STAGGER_MS = 35;

/** Per-tile animations: when it starts and what the tile looked like before. */
interface TileAnim {
  start: number;
  duration: number;
  from: Tile;
}

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private palette = readPalette();
  private anims = new Map<number, TileAnim>();
  cell = 12;

  preview: { rect: Rect; valid: boolean } | null = null;
  hint: Rect | null = null;

  constructor(canvas: HTMLCanvasElement, private size: number) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      this.palette = readPalette();
    });
  }

  resize(maxPx: number): void {
    this.cell = Math.max(6, Math.floor(maxPx / this.size));
    const px = this.cell * this.size;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.style.width = `${px}px`;
    this.canvas.style.height = `${px}px`;
    this.canvas.width = Math.round(px * dpr);
    this.canvas.height = Math.round(px * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** Queue the animations for a just-played turn. */
  animateTurn(rect: Rect, blockers: number[], before: Uint8Array): void {
    const now = performance.now();
    for (let y = rect.y0; y <= rect.y1; y++) {
      for (let x = rect.x0; x <= rect.x1; x++) {
        const i = y * this.size + x;
        this.anims.set(i, { start: now, duration: FLASH_MS, from: before[i] });
      }
    }
    blockers.forEach((i, k) => {
      this.anims.set(i, { start: now + FLASH_MS + k * DROP_STAGGER_MS, duration: DROP_MS, from: before[i] });
    });
  }

  clearAnimations(): void {
    this.anims.clear();
  }

  get animating(): boolean {
    return this.anims.size > 0;
  }

  private color(t: Tile): string {
    switch (t) {
      case Tile.Light:
        return this.palette.light;
      case Tile.Dark:
        return this.palette.dark;
      case Tile.Blocker:
        return this.palette.blocker;
      default:
        return this.palette.empty;
    }
  }

  draw(state: GameState): void {
    const { ctx, cell, size } = this;
    const now = performance.now();
    const px = cell * size;
    const gap = cell >= 10 ? 1 : 0;

    ctx.fillStyle = this.palette.grid;
    ctx.fillRect(0, 0, px, px);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        const tile = state.board[i] as Tile;
        const anim = this.anims.get(i);
        const cx = x * cell;
        const cy = y * cell;
        if (!anim) {
          ctx.fillStyle = this.color(tile);
          ctx.fillRect(cx, cy, cell - gap, cell - gap);
          continue;
        }
        const t = (now - anim.start) / anim.duration;
        if (t >= 1) {
          this.anims.delete(i);
          ctx.fillStyle = this.color(tile);
          ctx.fillRect(cx, cy, cell - gap, cell - gap);
        } else if (tile === Tile.Blocker) {
          // Blocker: show the raised tile underneath, then grow the red square in.
          const under = anim.from === Tile.Empty ? Tile.Light : anim.from === Tile.Light ? Tile.Dark : anim.from;
          ctx.fillStyle = this.color(under);
          ctx.fillRect(cx, cy, cell - gap, cell - gap);
          if (t > 0) {
            const s = (cell - gap) * easeOutBack(t);
            const o = (cell - gap - s) / 2;
            ctx.fillStyle = this.palette.blocker;
            ctx.fillRect(cx + o, cy + o, s, s);
          }
        } else {
          ctx.fillStyle = this.color(tile);
          ctx.fillRect(cx, cy, cell - gap, cell - gap);
          if (t >= 0) {
            ctx.fillStyle = `rgba(255,255,255,${0.7 * (1 - t)})`;
            ctx.fillRect(cx, cy, cell - gap, cell - gap);
          }
        }
      }
    }

    if (this.hint) this.strokeRect(this.hint, this.palette.hint, [6, 4]);
    if (this.preview) {
      const { rect, valid } = this.preview;
      const color = valid ? this.palette.valid : this.palette.invalid;
      ctx.fillStyle = valid ? "rgba(31,163,92,0.18)" : "rgba(217,54,54,0.18)";
      ctx.fillRect(rect.x0 * cell, rect.y0 * cell, (rect.x1 - rect.x0 + 1) * cell, (rect.y1 - rect.y0 + 1) * cell);
      this.strokeRect(rect, color, []);
    }
  }

  private strokeRect(r: Rect, color: string, dash: number[]): void {
    const { ctx, cell } = this;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.setLineDash(dash);
    ctx.strokeRect(
      r.x0 * cell + 1,
      r.y0 * cell + 1,
      (r.x1 - r.x0 + 1) * cell - 2,
      (r.y1 - r.y0 + 1) * cell - 2,
    );
    ctx.restore();
  }

  cellAt(clientX: number, clientY: number): { x: number; y: number } {
    const box = this.canvas.getBoundingClientRect();
    const clamp = (v: number) => Math.min(this.size - 1, Math.max(0, v));
    return {
      x: clamp(Math.floor((clientX - box.left) / this.cell)),
      y: clamp(Math.floor((clientY - box.top) / this.cell)),
    };
  }
}

function easeOutBack(t: number): number {
  const c = 1.7;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
}
