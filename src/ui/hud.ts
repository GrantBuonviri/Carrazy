import { tally, type GameState } from "../engine";

const BEST_KEY = "carrazy.best";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

export function loadBest(): number | null {
  try {
    const v = localStorage.getItem(BEST_KEY);
    return v === null ? null : Number(v);
  } catch {
    return null;
  }
}

export function saveBest(score: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(score));
  } catch {
    // Storage unavailable (private mode etc.) — best score just won't persist.
  }
}

export function updateHud(state: GameState, best: number | null): void {
  const t = tally(state);
  const total = state.config.size * state.config.size;
  $("stat-dark").textContent = t.dark.toLocaleString();
  $("stat-pct").textContent = `${((t.dark / total) * 100).toFixed(1)}%`;
  $("stat-turn").textContent = String(state.turn);
  $("stat-light").textContent = t.light.toLocaleString();
  $("stat-block").textContent = t.blocker.toLocaleString();
  $("stat-best").textContent = best === null ? "–" : best.toLocaleString();
  $("seed").textContent = String(state.seed);
}

export function showGameOver(state: GameState, best: number | null, isNewBest: boolean): void {
  const t = tally(state);
  const total = state.config.size * state.config.size;
  $("final-score").textContent = t.dark.toLocaleString();
  $("final-detail").textContent =
    `${((t.dark / total) * 100).toFixed(1)}% of the board in ${state.turn} turns.` +
    (isNewBest ? " New best!" : best !== null ? ` Best: ${best.toLocaleString()}.` : "");
  $<HTMLDialogElement>("game-over").showModal();
}
