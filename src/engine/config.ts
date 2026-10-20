export interface GameConfig {
  /** Board is size × size tiles. */
  size: number;
  /** Minimum rectangle area (width × height) for a legal move. */
  minArea: number;
  /** Fraction of a selected rectangle's tiles that become blockers. */
  blockerRatio: number;
}

export const DEFAULT_CONFIG: GameConfig = {
  size: 20,
  minArea: 8,
  blockerRatio: 1 / 7,
};
