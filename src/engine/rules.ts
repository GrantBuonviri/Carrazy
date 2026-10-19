import { DEFAULT_CONFIG, type GameConfig } from "./config";
import { blockersInRect, buildBlockerSums, rectArea } from "./board";
import { hasValidMove } from "./endCheck";
import { nextRandom, randomSeed } from "./rng";
import type { GameState, Rect, TurnRecord } from "./types";
import { Tile } from "./types";

export function newGame(seed: number = randomSeed(), config: GameConfig = DEFAULT_CONFIG): GameState {
  const board = new Uint8Array(config.size * config.size);
  return {
    config,
    seed,
    rngState: seed,
    board,
    blockerSums: buildBlockerSums(board, config.size),
    turn: 0,
    history: [],
    over: !hasValidMove(board, config.size, config.minArea),
  };
}

export type RectProblem = "out-of-bounds" | "too-small" | "has-blocker" | "game-over";

export function rectProblem(state: GameState, r: Rect): RectProblem | null {
  const { size, minArea } = state.config;
  if (state.over) return "game-over";
  if (r.x0 < 0 || r.y0 < 0 || r.x1 >= size || r.y1 >= size || r.x0 > r.x1 || r.y0 > r.y1) {
    return "out-of-bounds";
  }
  if (blockersInRect(state.blockerSums, size, r) > 0) return "has-blocker";
  if (rectArea(r) < minArea) return "too-small";
  return null;
}

export function isValidRect(state: GameState, r: Rect): boolean {
  return rectProblem(state, r) === null;
}

/** Expected number of blockers a rectangle of this area will spawn. */
export function expectedBlockers(area: number, config: GameConfig): number {
  return area * config.blockerRatio;
}

/**
 * floor(area × ratio) blockers, plus one more with probability equal to the
 * fractional remainder, so the average is exactly area × ratio.
 */
function blockerCount(area: number, ratio: number, rngState: number): [number, number] {
  const exact = area * ratio;
  let count = Math.floor(exact + 1e-9);
  const frac = exact - count;
  const [roll, next] = nextRandom(rngState);
  if (roll < frac) count++;
  return [count, next];
}

/** Apply a turn in place. Returns the turn record, or throws if the rect is invalid. */
export function applyTurn(state: GameState, r: Rect): TurnRecord {
  const problem = rectProblem(state, r);
  if (problem) throw new Error(`Invalid rectangle: ${problem}`);
  const { size, blockerRatio } = state.config;
  const { board } = state;

  const cells: number[] = [];
  for (let y = r.y0; y <= r.y1; y++) {
    for (let x = r.x0; x <= r.x1; x++) {
      const i = y * size + x;
      if (board[i] === Tile.Empty) board[i] = Tile.Light;
      else if (board[i] === Tile.Light) board[i] = Tile.Dark;
      cells.push(i);
    }
  }

  let rng = state.rngState;
  let count: number;
  [count, rng] = blockerCount(cells.length, blockerRatio, rng);

  // Blockers may land on any tile in the rectangle, conquered ones included.
  // (Sparing conquered tiles would let a player re-select an all-dark
  // rectangle forever without spawning blockers, so the game would never end.)
  const candidates = cells;

  // Partial Fisher–Yates: the first `count` entries become a uniform random sample.
  const blockers: number[] = [];
  for (let k = 0; k < count; k++) {
    let roll: number;
    [roll, rng] = nextRandom(rng);
    const j = k + Math.floor(roll * (candidates.length - k));
    [candidates[k], candidates[j]] = [candidates[j], candidates[k]];
    board[candidates[k]] = Tile.Blocker;
    blockers.push(candidates[k]);
  }

  state.rngState = rng;
  state.blockerSums = buildBlockerSums(board, size);
  state.turn++;
  const record: TurnRecord = { rect: { ...r }, blockers };
  state.history.push(record);
  state.over = !hasValidMove(board, size, state.config.minArea);
  return record;
}

export interface Tally {
  empty: number;
  light: number;
  dark: number;
  blocker: number;
}

export function tally(state: GameState): Tally {
  const t: Tally = { empty: 0, light: 0, dark: 0, blocker: 0 };
  for (const v of state.board) {
    if (v === Tile.Empty) t.empty++;
    else if (v === Tile.Light) t.light++;
    else if (v === Tile.Dark) t.dark++;
    else t.blocker++;
  }
  return t;
}

export function score(state: GameState): number {
  return tally(state).dark;
}
