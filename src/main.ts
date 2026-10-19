import {
  applyTurn,
  expectedBlockers,
  largestFreeRect,
  newGame,
  randomSeed,
  rectArea,
  rectHeight,
  rectProblem,
  rectWidth,
  score,
  type GameState,
  type RectProblem,
} from "./engine";
import { attachDragInput } from "./ui/input";
import { loadBest, saveBest, showGameOver, updateHud } from "./ui/hud";
import { Renderer } from "./ui/renderer";

const canvas = document.getElementById("board") as HTMLCanvasElement;
const label = document.getElementById("drag-label") as HTMLDivElement;
const dialog = document.getElementById("game-over") as HTMLDialogElement;

let state: GameState = newGame(seedFromUrl() ?? randomSeed());
let best = loadBest();
const renderer = new Renderer(canvas, state.config.size);

const PROBLEM_TEXT: Record<RectProblem, string> = {
  "too-small": "needs 8+ tiles",
  "has-blocker": "contains red",
  "out-of-bounds": "off the board",
  "game-over": "game over",
};

function seedFromUrl(): number | null {
  const raw = new URLSearchParams(location.search).get("seed");
  const n = raw === null ? NaN : Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function start(seed: number): void {
  state = newGame(seed);
  renderer.clearAnimations();
  renderer.hint = null;
  try {
    const url = new URL(location.href);
    url.searchParams.set("seed", String(seed));
    history.replaceState(null, "", url);
  } catch {
    // Some embedded/sandboxed frames refuse history changes; the seed is still shown in the panel.
  }
  if (dialog.open) dialog.close();
  updateHud(state, best);
  requestDraw();
}

function fit(): void {
  const narrow = window.innerWidth <= 760;
  const avail = narrow
    ? Math.min(window.innerWidth - 32, 640)
    : Math.min(window.innerWidth - 32 - 300 - 20, window.innerHeight - 32);
  renderer.resize(Math.max(300, avail));
  requestDraw();
}

let frame = 0;
function requestDraw(): void {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    renderer.draw(state);
    if (renderer.animating) requestDraw();
  });
}

attachDragInput(renderer, {
  onPreview(rect, clientX, clientY) {
    if (!rect) {
      renderer.preview = null;
      label.hidden = true;
      requestDraw();
      return;
    }
    const problem = rectProblem(state, rect);
    renderer.preview = { rect, valid: problem === null };
    const area = rectArea(rect);
    const box = canvas.parentElement!.getBoundingClientRect();
    label.hidden = false;
    label.classList.toggle("bad", problem !== null);
    label.textContent =
      `${rectWidth(rect)} × ${rectHeight(rect)} = ${area}` +
      (problem ? ` · ${PROBLEM_TEXT[problem]}` : ` · ~${expectedBlockers(area, state.config).toFixed(1)} blockers`);
    label.style.left = `${clientX - box.left}px`;
    label.style.top = `${clientY - box.top}px`;
    requestDraw();
  },
  onCommit(rect) {
    if (rectProblem(state, rect)) return;
    const before = state.board.slice();
    const record = applyTurn(state, rect);
    renderer.hint = null;
    renderer.animateTurn(rect, record.blockers, before);
    updateHud(state, best);
    requestDraw();
    if (state.over) finish();
  },
});

function finish(): void {
  const s = score(state);
  const isNewBest = best === null || s > best;
  if (isNewBest) {
    best = s;
    saveBest(s);
  }
  updateHud(state, best);
  // Let the last blockers land before covering the board.
  setTimeout(() => showGameOver(state, best, isNewBest), 900);
}

document.getElementById("btn-new")!.addEventListener("click", () => start(randomSeed()));
document.getElementById("btn-over-new")!.addEventListener("click", () => start(randomSeed()));
document.getElementById("btn-restart")!.addEventListener("click", () => start(state.seed));
document.getElementById("btn-over-close")!.addEventListener("click", () => dialog.close());
document.getElementById("btn-hint")!.addEventListener("click", () => {
  const { area, rect } = largestFreeRect(state.board, state.config.size);
  renderer.hint = area >= state.config.minArea ? rect : null;
  requestDraw();
});

window.addEventListener("resize", fit);
fit();
start(state.seed);

// Read-only handle for debugging and automated play-testing from the console.
Object.defineProperty(window, "carrazy", { value: { get state() { return state; } } });
