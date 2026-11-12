import { ALL_BOOKS_LIST, BookEntry } from '../data/bookData';

export const LANES = 6;
export const LEVELS = 9;
export const SVG_W = 600;
export const SVG_H = 260;

export const getX = (lane: number) => 50 + lane * 100;
export const getY = (level: number) => ((level + 1) * SVG_H) / (LEVELS + 1);

export interface CandidateBook {
  book: BookEntry;
  emotion: string;
  matched: string[];
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickCandidates(emotions: string[]): CandidateBook[] {
  const weight = [3, 2, 1];
  const scored = ALL_BOOKS_LIST.map((entry) => {
    const matched = emotions.filter((e) => entry.tags.includes(e));
    const score =
      matched.reduce((s, e) => s + (weight[emotions.indexOf(e)] ?? 1), 0) +
      (matched.length - 1) * 10;
    return {
      book: entry,
      matched,
      score: score + Math.random() * 2,
    };
  }).filter((x) => x.matched.length > 0);

  scored.sort((a, b) => b.score - a.score);

  return shuffle(
    scored.slice(0, LANES).map((x) => ({
      book: x.book,
      emotion: x.matched[0] || emotions[0] || '위로',
      matched: x.matched,
    }))
  );
}

export function makeRungs(): boolean[][] {
  const rungs: boolean[][] = [];
  for (let lv = 0; lv < LEVELS; lv++) {
    const row = new Array(LANES - 1).fill(false);
    for (let i = 0; i < LANES - 1; i++) {
      if (i > 0 && row[i - 1]) continue;
      row[i] = Math.random() < 0.45;
    }
    rungs.push(row);
  }

  // Ensure each column has at least one rung so lanes cross nicely
  for (let pass = 0; pass < 10; pass++) {
    let changed = false;
    for (let i = 0; i < LANES - 1; i++) {
      if (rungs.some((r) => r[i])) continue;
      const candidates = shuffle([...Array(LEVELS).keys()]);
      let lv = candidates.find((l) => !rungs[l][i - 1] && !rungs[l][i + 1]);
      if (lv === undefined) {
        lv = Math.floor(Math.random() * LEVELS);
        if (i > 0) rungs[lv][i - 1] = false;
        if (i < LANES - 2) rungs[lv][i + 1] = false;
      }
      rungs[lv][i] = true;
      changed = true;
    }
    if (!changed) break;
  }

  return rungs;
}

export function tracePath(startLane: number, rungs: boolean[][]) {
  let lane = startLane;
  const pts: [number, number][] = [[getX(lane), getY(-1)]];

  for (let lv = 0; lv < LEVELS; lv++) {
    pts.push([getX(lane), getY(lv)]);
    if (rungs[lv][lane]) {
      lane++;
    } else if (lane > 0 && rungs[lv][lane - 1]) {
      lane--;
    }
    pts.push([getX(lane), getY(lv)]);
  }

  pts.push([getX(lane), getY(LEVELS)]);
  return { pts, end: lane };
}
