# Carrazy — Development Plan

## 1. Game summary

- **Board:** a 50 × 50 grid of tiles.
- **Goal:** conquer as many tiles as possible.
- **Each turn:**
  1. The player drags out a rectangle of any shape that covers **at least 8 tiles** and contains **no red tiles (blockers)**.
  2. Every tile inside the rectangle moves up one step:
     - empty → **light blue** (selected once)
     - light blue → **dark blue** (conquered)
  3. **Blockers spawn:** 1/7 of the tiles in the rectangle, chosen at random, turn **red**.
- **Blockers** are permanent walls. No rectangle may contain one, and they never count as conquered.
- **Game over:** the game ends when no rectangle of 8 or more tiles fits anywhere without touching a blocker.
- **Score:** the number of dark-blue tiles, also shown as a percentage of the 2,500 tiles.

The core tension: a big rectangle advances more tiles, but it also drops more blockers into the area you'll need to cover a second time. Conquering takes two overlapping passes, while each pass breaks up the open space.

## 2. Rule decisions to confirm

These are gaps in the current description. Each has a proposed default, and each will be a single constant or flag in the code so it's easy to change.

| # | Question | Proposed default |
|---|----------|------------------|
| 1 | How is 1/7 rounded? (An 8-tile rectangle gives 8/7 ≈ 1.14.) | `floor(area / 7)`, plus one extra blocker with probability equal to the remainder (`area % 7 / 7`). On average this is exactly 1/7, with no rounding bias. |
| 2 | Can blockers land on **dark-blue** tiles? If so, the player loses those tiles. | **Yes (required).** Blockers can land on any tile in the rectangle. The alternative (sparing conquered tiles) was tried and dropped: a player could reselect an all-dark rectangle forever without spawning blockers, so the game would never end. |
| 3 | Can a rectangle include tiles that are already dark blue? | **Yes.** They stay dark blue. They still count toward the 8-tile minimum and still count when calculating blockers. |
| 4 | Does "at least 8 tiles" mean the rectangle's total area, or only tiles that aren't conquered? | **Total area** (width × height). |
| 5 | Is the blocker ratio applied to the full rectangle area? | **Yes**, the full area. |
| 6 | Is there a turn limit? | **No.** The game ends only when no valid rectangle is left. |

## 3. Tech stack

- **Language:** TypeScript
- **Build/dev server:** Vite
- **Rendering:** HTML `<canvas>`. 2,500 tiles is tiny, so redrawing the whole board every frame is fine.
- **Tests:** Vitest
- **Hosting:** GitHub Pages (static site)
- **Framework:** none. Plain DOM is enough for the side panel (score, turn count, buttons).

The game runs in any browser, desktop or mobile, and needs no backend.

## 4. Architecture

```
src/
  engine/            pure game logic, no DOM (fully unit-tested)
    types.ts         TileState enum, Rect, GameState
    rng.ts           seeded PRNG (mulberry32) for reproducible games
    board.ts         create board, get/set tile, rect helpers
    rules.ts         isValidRect, applyTurn, spawnBlockers, score
    endCheck.ts      largestFreeRectArea / hasValidMove
    config.ts        GRID_SIZE=50, MIN_AREA=8, BLOCKER_RATIO=1/7, rule flags
  ui/
    renderer.ts      draws board + drag preview on canvas
    input.ts         mouse/touch drag → grid-cell rectangle
    hud.ts           score, turn, % conquered, game-over modal
  sim/
    simulate.ts      headless bot runner for balancing (Node)
  main.ts            wires engine + UI together
tests/
  rules.test.ts, endCheck.test.ts, rng.test.ts
```

### Data model

- **Board:** a `Uint8Array(2500)`. Index = `y * 50 + x`. Each value is a tile state: `0 = Empty`, `1 = Light`, `2 = Dark`, `3 = Blocker`.
- **`GameState`:** `{ board, turn, seed, rngState, history: TurnRecord[], over: boolean }`
- **`TurnRecord`:** `{ rect, blockersPlaced: number[] }`. Used for replays and debugging.

### Key algorithms

- **Rectangle validation:**
  - Area must be ≥ `MIN_AREA`.
  - The rectangle must contain no blockers. This is checked in O(1) with a 2D prefix-sum table of blocker counts, which is rebuilt after each turn. That keeps the live drag preview instant.
- **Applying a turn:**
  1. Raise every tile in the rectangle by one level (Empty→Light, Light→Dark, Dark stays Dark).
  2. Pick `k` distinct random tiles in the rectangle using a partial Fisher–Yates shuffle, and set them to Blocker.
  3. Rebuild the prefix sums.
  4. Run the end check.
- **End check:** this is the "maximal rectangle in a binary matrix" problem.
  1. For each row, build a histogram of how many consecutive non-blocker tiles sit above each cell.
  2. Run the stack-based "largest rectangle in histogram" algorithm on each row.
  3. The game is over when the largest area is < 8.

  This is O(50 × 50) per turn, which is effectively free. The same pass can also return the location of a valid rectangle, which powers an optional "hint" feature.

## 5. Milestones

### M0 — Project setup (½ day)
- Set up Vite + TypeScript + Vitest, ESLint/Prettier, and a GitHub Actions workflow that runs tests and deploys to Pages.

### M1 — Rules engine (1–2 days)
- Write `types`, `config`, `rng`, `board`, and `rules`.
- Unit tests covering:
  - Too-small rectangles are rejected.
  - Rectangles containing a blocker are rejected.
  - Tile states advance correctly.
  - Blocker counts are right, and blockers stay inside the rectangle.
  - The same seed always produces the same game.
- Implement `endCheck` and test it on hand-made boards: an empty board, a board split into strips 7 tiles wide, a checkerboard, and so on.
- **Done when:** a full game can be played through the engine API in a test.

### M2 — Playable prototype (1–2 days)
- Canvas renderer:
  - Fixed colors: white/grey for empty, light blue, dark blue, red.
  - Grid lines.
  - Scales to fit the window.
- Drag input:
  - Mouse-down on a cell, drag, mouse-up.
  - Snaps to cells and works in any drag direction.
  - Touch events for mobile.
- Live preview while dragging:
  - The outline turns **green** when the rectangle is valid and **red** when it's invalid.
  - A tooltip shows `W × H = area` and the expected number of blockers.
- HUD: turn number, tiles conquered, % conquered, and a "New game" button.
- Game-over modal showing the final score.
- **Done when:** a full game can be played in the browser.

### M3 — Feel & clarity (1–2 days)
- Animations:
  - Tiles flash as they change state.
  - Blockers "drop in" one by one after each turn.
- Escape cancels a drag. Optionally require a confirm click before a turn is committed, to avoid accidental turns.
- Show the seed, and let the player replay a seed (`?seed=1234` in the URL).
- Optional hint button that highlights the largest open rectangle.
- Sound effects with a mute toggle.
- Accessibility:
  - Colorblind-safe palette option, with patterns or icons on top of the colors.
  - Keyboard control for drawing rectangles.

### M4 — Balancing via simulation (1 day)
- A headless Node script runs thousands of games, each with a simple bot:
  - **Random:** a random valid rectangle each turn.
  - **Greedy:** the rectangle that converts the most light-blue tiles to dark blue, minus the expected losses to blockers.
  - **Double-tap:** pick a rectangle, then select it again on the very next turn if it's still clear.
- Report the score distribution and game length for each blocker ratio (1/5, 1/6, 1/7, 1/8) and for each rule option from section 2.
- Use the results to confirm that 1/7 gives a satisfying challenge and that skill beats random play.

### M5 — Replayability (optional, 1–3 days)
- **Daily challenge:** the seed comes from the date, so every player gets the same board randomness.
- Best scores saved locally in `localStorage`.
- Settings: grid size (20/35/50), blocker ratio, and minimum rectangle area.
- Share a result as text, e.g. "Carrazy #123 — 1,412 tiles (56%)".
- Optional starting layouts with some blockers already placed.

## 6. Testing strategy

- **Engine:** 100% unit-tested, because it is pure and deterministic given a seed.
- **Invariant/property tests** over random games:
  - Blockers never decrease.
  - Every turn's rectangle was valid when it was played.
  - The game is over exactly when `largestFreeRectArea < 8`.
- **UI:** manual playtesting, plus a Playwright smoke test that draws one rectangle and checks that the HUD updates.

## 7. Open design ideas (for later)

- Bonus points for conquering a complete row, column or enclosed region.
- An "eraser" power-up earned every N turns that removes one blocker.
- Two-player mode where each player has their own color and can't select tiles the other has conquered.
- An undo button. This doesn't break the randomness, because blockers are seeded; the game could limit it to one undo per game.

## 8. Status

- **Done:** M0 (scaffold, CI), M1 (rules engine, 17 tests), M2 (playable game), and parts of M3 (animations, seeds in the URL, hint, Esc to cancel, dark mode) and M4 (simulator).
- **Not yet:** confirm-before-commit, sound, colorblind palette, keyboard drawing, Playwright smoke test in CI, and all of M5.

### First balancing results (`npm run sim -- 40`)

| Ratio | Random bot | Largest-rect bot | Greedy bot |
|-------|-----------:|-----------------:|-----------:|
| 1/5 | 37.7% | 38.8% | 38.6% |
| 1/6 | 44.4% | 45.6% | 45.2% |
| 1/7 | 49.5% | 50.6% | 50.3% |
| 1/8 | 53.6% | 54.4% | 54.4% |

**Design concern:** a bot picking random valid rectangles scores within about 1 point of the smarter bots. Scores land near 50% at 1/7 whatever the strategy, so as the rules stand, skill barely matters. Section 7 ideas worth testing in the simulator to give choices more weight:
- Make blockers spawn only on tiles that were **light** before the turn, so stacking a second pass is rewarded and blind first passes are punished.
- Score by turn efficiency or add a turn limit.
- Scale the blocker ratio with rectangle size (e.g. small rectangles are cheaper).
