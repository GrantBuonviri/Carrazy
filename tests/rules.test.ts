import { describe, expect, it } from "vitest";
import {
  applyTurn,
  DEFAULT_CONFIG,
  isValidRect,
  newGame,
  normalizeRect,
  rectProblem,
  tally,
  Tile,
} from "../src/engine";

const rect = (x0: number, y0: number, x1: number, y1: number) => ({ x0, y0, x1, y1 });

describe("rectangle validation", () => {
  it("rejects rectangles under the minimum area", () => {
    const g = newGame(1);
    expect(rectProblem(g, rect(0, 0, 6, 0))).toBe("too-small"); // 7 tiles
    expect(isValidRect(g, rect(0, 0, 7, 0))).toBe(true); // 8 tiles
    expect(isValidRect(g, rect(0, 0, 1, 3))).toBe(true); // 2×4
  });

  it("rejects out-of-bounds rectangles", () => {
    const g = newGame(1);
    expect(rectProblem(g, rect(45, 0, 50, 3))).toBe("out-of-bounds");
    expect(rectProblem(g, rect(-1, 0, 8, 0))).toBe("out-of-bounds");
  });

  it("rejects rectangles that contain a blocker", () => {
    const g = newGame(1);
    const rec = applyTurn(g, rect(0, 0, 9, 9));
    const b = rec.blockers[0];
    const bx = b % 50;
    const by = Math.floor(b / 50);
    expect(rectProblem(g, rect(bx, by, bx, by))).toBe("has-blocker");
    expect(rectProblem(g, rect(0, 0, 49, 49))).toBe("has-blocker");
  });

  it("normalizes drag direction", () => {
    expect(normalizeRect(5, 9, 2, 1)).toEqual(rect(2, 1, 5, 9));
  });
});

describe("applying a turn", () => {
  it("turns empty tiles light, then light tiles dark", () => {
    const g = newGame(42);
    const r = rect(0, 0, 13, 0); // 14 tiles → exactly 2 blockers
    const first = applyTurn(g, r);
    expect(first.blockers).toHaveLength(2);
    expect(tally(g)).toMatchObject({ light: 12, blocker: 2 });
  });

  it("conquers tiles selected twice", () => {
    const g = newGame(3, { ...DEFAULT_CONFIG, blockerRatio: 0 });
    applyTurn(g, rect(0, 0, 7, 0));
    expect(tally(g)).toMatchObject({ light: 8, dark: 0 });
    applyTurn(g, rect(0, 0, 7, 1)); // overlaps row 0, adds row 1
    expect(tally(g)).toMatchObject({ light: 8, dark: 8 });
    applyTurn(g, rect(0, 0, 7, 1)); // dark stays dark
    expect(tally(g)).toMatchObject({ light: 0, dark: 16 });
  });

  it("places floor(area/7) blockers plus a probabilistic extra", () => {
    for (let seed = 0; seed < 200; seed++) {
      const g = newGame(seed);
      const { blockers } = applyTurn(g, rect(0, 0, 9, 9)); // 100 tiles → 14.28
      expect([14, 15]).toContain(blockers.length);
      expect(new Set(blockers).size).toBe(blockers.length);
      for (const i of blockers) {
        expect(i % 50).toBeLessThanOrEqual(9);
        expect(Math.floor(i / 50)).toBeLessThanOrEqual(9);
      }
    }
  });

  it("averages to 1/7 of the area", () => {
    let total = 0;
    const n = 2000;
    for (let seed = 0; seed < n; seed++) total += applyTurn(newGame(seed), rect(0, 0, 7, 0)).blockers.length;
    expect(total / n).toBeCloseTo(8 / 7, 1);
  });

  it("is deterministic for a given seed", () => {
    const a = newGame(99);
    const b = newGame(99);
    for (const r of [rect(0, 0, 9, 9), rect(20, 20, 30, 25), rect(40, 0, 49, 3)]) {
      expect(applyTurn(a, r)).toEqual(applyTurn(b, r));
    }
    expect(a.board).toEqual(b.board);
  });

  it("throws on an invalid rectangle and leaves the board untouched", () => {
    const g = newGame(1);
    expect(() => applyTurn(g, rect(0, 0, 1, 1))).toThrow(/too-small/);
    expect(g.turn).toBe(0);
    expect(tally(g).empty).toBe(2500);
  });

  it("lets blockers land on conquered tiles", () => {
    const g = newGame(5, { ...DEFAULT_CONFIG, blockerRatio: 1 });
    g.board.fill(Tile.Light, 0, 8);
    applyTurn(g, rect(0, 0, 7, 0));
    expect(tally(g)).toMatchObject({ dark: 0, blocker: 8 });
  });
});

describe("game over", () => {
  it("ends when no rectangle of minArea fits", () => {
    const g = newGame(7, { ...DEFAULT_CONFIG, size: 4 });
    expect(g.over).toBe(false);
    let guard = 0;
    while (!g.over && guard++ < 100) {
      // Play the first valid rectangle found by brute force.
      let played = false;
      for (let y0 = 0; y0 < 4 && !played; y0++)
        for (let x0 = 0; x0 < 4 && !played; x0++)
          for (let y1 = y0; y1 < 4 && !played; y1++)
            for (let x1 = x0; x1 < 4 && !played; x1++)
              if (isValidRect(g, rect(x0, y0, x1, y1))) {
                applyTurn(g, rect(x0, y0, x1, y1));
                played = true;
              }
      expect(played).toBe(true);
    }
    expect(g.over).toBe(true);
    expect(rectProblem(g, rect(0, 0, 3, 3))).toBe("game-over");
  });
});
