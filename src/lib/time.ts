/**
 * Canonical round durations per spec §2. Betting closes at start + duration/2.
 */

export type RoundKey = 1 | 2 | 3 | 4 | 5 | 6;

export const ROUND_DEFS: Record<
  RoundKey,
  {
    label: string;
    teamSize: number;
    durationMinutes: number;
    isPod: boolean;
  }
> = {
  1: { label: "Round 1 — Solo", teamSize: 1, durationMinutes: 235, isPod: true }, // ~4h
  2: { label: "Round 2 — Teams of 2", teamSize: 2, durationMinutes: 150, isPod: true },
  3: { label: "Round 3 — Teams of 4", teamSize: 4, durationMinutes: 90, isPod: true },
  4: { label: "Quarterfinal", teamSize: 8, durationMinutes: 90, isPod: false },
  5: { label: "Semifinal", teamSize: 16, durationMinutes: 90, isPod: false },
  6: { label: "Final", teamSize: 32, durationMinutes: 90, isPod: false },
};

export const PLAY_IN_DURATION_MINUTES = 90;

export function bettingClosesAt(
  actualStart: Date,
  durationMinutes: number,
): Date {
  return new Date(actualStart.getTime() + (durationMinutes / 2) * 60 * 1000);
}

export function battleEndsAt(
  actualStart: Date,
  durationMinutes: number,
): Date {
  return new Date(actualStart.getTime() + durationMinutes * 60 * 1000);
}

export function roundKeyOrNull(r: number): RoundKey | null {
  return r >= 1 && r <= 6 ? (r as RoundKey) : null;
}
