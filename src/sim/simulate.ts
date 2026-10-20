/**
 * Headless balancing harness: plays many games with simple bots and reports
 * score distributions for different blocker ratios.
 *
 *   npm run sim -- [games=200] [size=20]
 */
import {
  applyTurn,
  DEFAULT_CONFIG,
  largestFreeRect,
  newGame,
  nextRandom,
  rectArea,
  rectProblem,
  score,
  Tile,
  type GameConfig,
  type GameState,
  type Rect,
} from "../engine";

type Bot = (s: GameState, rand: () => number) => Rect;

/** All maximal-ish candidate rectangles: for each cell, grow right then down. */
function candidates(s: GameState, rand: () => number, tries: number): Rect[] {
  const N = s.config.size;
  const out: Rect[] = [];
  for (let t = 0; t < tries; t++) {
    const x0 = Math.floor(rand() * N);
    const y0 = Math.floor(rand() * N);
    const w = 1 + Math.floor(rand() * Math.min(16, N - x0));
    const h = 1 + Math.floor(rand() * Math.min(16, N - y0));
    const r = { x0, y0, x1: x0 + w - 1, y1: y0 + h - 1 };
    if (!rectProblem(s, r)) out.push(r);
  }
  return out;
}

function lightCount(s: GameState, r: Rect): number {
  const N = s.config.size;
  let n = 0;
  for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) if (s.board[y * N + x] === Tile.Light) n++;
  return n;
}

const largest: Bot = (s) => largestFreeRect(s.board, s.config.size).rect!;

const random: Bot = (s, rand) => candidates(s, rand, 400)[0] ?? largest(s, rand);

/** Maximise expected net conquered tiles: lights converted minus expected dark lost. */
const greedy: Bot = (s, rand) => {
  let best: Rect | null = null;
  let bestVal = -Infinity;
  for (const r of candidates(s, rand, 400)) {
    const area = rectArea(r);
    const light = lightCount(s, r);
    const val = light * (1 - s.config.blockerRatio) - area * s.config.blockerRatio * 0.5 + area * 0.01;
    if (val > bestVal) {
      bestVal = val;
      best = r;
    }
  }
  return best ?? largest(s, rand);
};

function play(bot: Bot, seed: number, config: GameConfig): { score: number; turns: number } {
  const s = newGame(seed, config);
  let rs = seed ^ 0x5bd1e995;
  const rand = () => {
    const [v, n] = nextRandom(rs);
    rs = n;
    return v;
  };
  while (!s.over) applyTurn(s, bot(s, rand));
  return { score: score(s), turns: s.turn };
}

function stats(xs: number[]) {
  const sorted = [...xs].sort((a, b) => a - b);
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  return { mean, p10: q(0.1), p50: q(0.5), p90: q(0.9) };
}

const games = Number(process.argv[2] ?? 200);
const size = Number(process.argv[3] ?? DEFAULT_CONFIG.size);
const bots: Record<string, Bot> = { random, largest, greedy };
const ratios: [string, number][] = [
  ["1/5", 1 / 5],
  ["1/6", 1 / 6],
  ["1/7", 1 / 7],
  ["1/8", 1 / 8],
];

console.log(`${games} games per cell, ${size}×${size} board\n`);
console.log("ratio  bot       mean%   p10   p50   p90   turns");
for (const [label, ratio] of ratios) {
  const config = { ...DEFAULT_CONFIG, size, blockerRatio: ratio };
  for (const [name, bot] of Object.entries(bots)) {
    const res = Array.from({ length: games }, (_, i) => play(bot, i + 1, config));
    const sc = stats(res.map((r) => r.score));
    const tu = stats(res.map((r) => r.turns));
    const pct = (sc.mean / (size * size)) * 100;
    console.log(
      `${label.padEnd(6)} ${name.padEnd(8)} ${pct.toFixed(1).padStart(6)}  ${String(sc.p10).padStart(5)} ${String(sc.p50).padStart(5)} ${String(sc.p90).padStart(5)}  ${tu.mean.toFixed(0).padStart(5)}`,
    );
  }
}
