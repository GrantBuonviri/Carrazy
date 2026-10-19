import { describe, expect, it } from "vitest";
import { hasValidMove, largestFreeRect, Tile } from "../src/engine";

function boardFrom(rows: string[]): { board: Uint8Array; size: number } {
  const size = rows.length;
  const board = new Uint8Array(size * size);
  rows.forEach((row, y) => [...row].forEach((c, x) => (board[y * size + x] = c === "#" ? Tile.Blocker : Tile.Empty)));
  return { board, size };
}

function bruteForce(board: Uint8Array, size: number): number {
  let best = 0;
  for (let y0 = 0; y0 < size; y0++)
    for (let x0 = 0; x0 < size; x0++)
      for (let y1 = y0; y1 < size; y1++)
        for (let x1 = x0; x1 < size; x1++) {
          let clear = true;
          for (let y = y0; y <= y1 && clear; y++)
            for (let x = x0; x <= x1 && clear; x++) if (board[y * size + x] === Tile.Blocker) clear = false;
          if (clear) best = Math.max(best, (x1 - x0 + 1) * (y1 - y0 + 1));
        }
  return best;
}

describe("largestFreeRect", () => {
  it("covers the whole empty board", () => {
    const { board, size } = boardFrom(["....", "....", "....", "...."]);
    expect(largestFreeRect(board, size)).toEqual({ area: 16, rect: { x0: 0, y0: 0, x1: 3, y1: 3 } });
  });

  it("returns zero for a full board", () => {
    const { board, size } = boardFrom(["##", "##"]);
    expect(largestFreeRect(board, size).area).toBe(0);
    expect(hasValidMove(board, size, 1)).toBe(false);
  });

  it("detects game over on a checkerboard", () => {
    const rows = Array.from({ length: 8 }, (_, y) =>
      Array.from({ length: 8 }, (_, x) => ((x + y) % 2 ? "#" : ".")).join(""),
    );
    const { board, size } = boardFrom(rows);
    expect(largestFreeRect(board, size).area).toBe(1);
    expect(hasValidMove(board, size, 8)).toBe(false);
  });

  it("finds a 1×8 strip", () => {
    const { board, size } = boardFrom([
      "########",
      "########",
      "........",
      "########",
      "########",
      "########",
      "########",
      "########",
    ]);
    const res = largestFreeRect(board, size);
    expect(res.area).toBe(8);
    expect(res.rect).toEqual({ x0: 0, y0: 2, x1: 7, y1: 2 });
    expect(hasValidMove(board, size, 8)).toBe(true);
  });

  it("matches brute force on random boards", () => {
    let s = 12345;
    const rand = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    for (let trial = 0; trial < 200; trial++) {
      const size = 3 + Math.floor(rand() * 8);
      const density = rand() * 0.5;
      const board = new Uint8Array(size * size).map(() => (rand() < density ? Tile.Blocker : Tile.Empty));
      const res = largestFreeRect(board, size);
      expect(res.area).toBe(bruteForce(board, size));
      if (res.rect) {
        const { x0, y0, x1, y1 } = res.rect;
        expect((x1 - x0 + 1) * (y1 - y0 + 1)).toBe(res.area);
        for (let y = y0; y <= y1; y++)
          for (let x = x0; x <= x1; x++) expect(board[y * size + x]).not.toBe(Tile.Blocker);
      }
    }
  });
});
