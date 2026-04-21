/**
 * Play-in David-vs-Goliath pairing (§8).
 *
 * Sort juniors asc by experience, seniors desc, then zip. Highest senior
 * faces lowest junior. If counts don't match, we pair as many as possible
 * and let the admin dashboard handle the remainder.
 */

export type PlayInEntry = {
  id: string;
  name: string;
  experienceScore: number;
};

export type PlayInMatchupPreview = {
  junior: PlayInEntry;
  senior: PlayInEntry;
};

export function generatePlayInPairings(
  juniors: PlayInEntry[],
  seniors: PlayInEntry[],
): PlayInMatchupPreview[] {
  const j = juniors.slice().sort((a, b) => a.experienceScore - b.experienceScore);
  const s = seniors.slice().sort((a, b) => b.experienceScore - a.experienceScore);
  const n = Math.min(j.length, s.length);
  const out: PlayInMatchupPreview[] = [];
  for (let i = 0; i < n; i += 1) {
    out.push({ junior: j[i], senior: s[i] });
  }
  return out;
}
