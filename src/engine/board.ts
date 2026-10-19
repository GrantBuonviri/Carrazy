import type { Rect } from "./types";
import { Tile } from "./types";

export function normalizeRect(ax: number, ay: number, bx: number, by: number): Rect {
  return {
    x0: Math.min(ax, bx),
    y0: Math.min(ay, by),
    x1: Math.max(ax, bx),
    y1: Math.max(ay, by),
  };
}

export function rectWidth(r: Rect): number {
  return r.x1 - r.x0 + 1;
}

export function rectHeight(r: Rect): number {
  return r.y1 - r.y0 + 1;
}

export function rectArea(r: Rect): number {
  return rectWidth(r) * rectHeight(r);
}

export function buildBlockerSums(board: Uint8Array, size: number): Int32Array {
  const w = size + 1;
  const sums = new Int32Array(w * w);
  for (let y = 0; y < size; y++) {
    let rowSum = 0;
    for (let x = 0; x < size; x++) {
      if (board[y * size + x] === Tile.Blocker) rowSum++;
      sums[(y + 1) * w + (x + 1)] = sums[y * w + (x + 1)] + rowSum;
    }
  }
  return sums;
}

export function blockersInRect(sums: Int32Array, size: number, r: Rect): number {
  const w = size + 1;
  return (
    sums[(r.y1 + 1) * w + (r.x1 + 1)] -
    sums[r.y0 * w + (r.x1 + 1)] -
    sums[(r.y1 + 1) * w + r.x0] +
    sums[r.y0 * w + r.x0]
  );
}
