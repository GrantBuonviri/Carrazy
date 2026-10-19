# Carrazy

A browser puzzle game about conquering a 50 × 50 grid.

## How to play

- Drag a rectangle of **at least 8 tiles** that contains **no red tiles**.
- Every tile in the rectangle advances one step: empty → **light blue** → **dark blue** (conquered).
- Then 1/7 of the rectangle's tiles, chosen at random, become **red blockers**. Blockers are permanent walls and can land on conquered tiles.
- The game ends when no 8-tile rectangle fits anywhere. Your score is the number of dark-blue tiles.

Controls: drag with mouse, pen or touch; Esc cancels a drag; **Hint** outlines the largest open rectangle.
Each game has a seed (shown in the panel and in the URL as `?seed=…`), so a board's randomness can be replayed.

## Development

```sh
npm install
npm run dev        # local dev server
npm test           # engine unit tests
npm run build      # typecheck + production build into dist/
npm run sim -- 200 # balancing simulation: 200 bot games per blocker ratio
```

Code layout:

- `src/engine/` — pure, deterministic game rules (no DOM), fully unit-tested
- `src/ui/` — canvas renderer, drag input, HUD
- `src/sim/` — headless bots for balancing
- `tests/` — Vitest suites

Pushes to `main` are tested and deployed to GitHub Pages by `.github/workflows/ci.yml`
(enable Pages with source "GitHub Actions" in the repository settings).

See [GAME_PLAN.md](GAME_PLAN.md) for the design plan and open questions.
