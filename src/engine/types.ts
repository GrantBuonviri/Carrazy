import type { GameConfig } from "./config";

export enum Tile {
  Empty = 0,
  Light = 1,
  Dark = 2,
  Blocker = 3,
}

/** Inclusive tile coordinates; x0 <= x1 and y0 <= y1. */
export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface TurnRecord {
  rect: Rect;
  blockers: number[];
}

export interface GameState {
  config: GameConfig;
  seed: number;
  rngState: number;
  board: Uint8Array;
  /** (size+1)² prefix sums of blocker counts, for O(1) rectangle checks. */
  blockerSums: Int32Array;
  turn: number;
  history: TurnRecord[];
  over: boolean;
}
