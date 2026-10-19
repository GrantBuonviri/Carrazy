import type { Rect } from "./types";
import { Tile } from "./types";

/**
 * Largest rectangle containing no blockers (maximal-rectangle via
 * per-row histograms + monotonic stack). O(size²).
 */
export function largestFreeRect(board: Uint8Array, size: number): { area: number; rect: Rect | null } {
  const heights = new Int32Array(size);
  const stack = new Int32Array(size + 1);
  let best = 0;
  let bestRect: Rect | null = null;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      heights[x] = board[y * size + x] === Tile.Blocker ? 0 : heights[x] + 1;
    }
    let top = 0;
    for (let x = 0; x <= size; x++) {
      const h = x === size ? 0 : heights[x];
      while (top > 0 && heights[stack[top - 1]] >= h) {
        const height = heights[stack[--top]];
        const left = top > 0 ? stack[top - 1] + 1 : 0;
        const area = height * (x - left);
        if (area > best) {
          best = area;
          bestRect = { x0: left, y0: y - height + 1, x1: x - 1, y1: y };
        }
      }
      stack[top++] = x;
    }
  }
  return { area: best, rect: bestRect };
}

export function hasValidMove(board: Uint8Array, size: number, minArea: number): boolean {
  return largestFreeRect(board, size).area >= minArea;
}
