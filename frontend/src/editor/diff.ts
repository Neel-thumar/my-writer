/**
 * Word-level diff producing replace "hunks" in character offsets of the
 * original text — the units shown as inline changes.
 */

export interface DiffHunk {
  /** Start/end offsets in the original string */
  start: number;
  end: number;
  /** Text that replaces original[start:end] */
  insert: string;
}

/** Words, whitespace runs and punctuation are separate tokens. */
function tokenize(text: string): string[] {
  return text.split(/(\s+|[.,!?;:"'“”‘’()[\]{}—–-])/).filter((t) => t !== "");
}

// Beyond this the LCS table gets slow; fall back to one big hunk
const MAX_CELLS = 4_000_000;

export function diffHunks(original: string, updated: string): DiffHunk[] {
  if (original === updated) return [];
  const a = tokenize(original);
  const b = tokenize(updated);
  if (a.length * b.length > MAX_CELLS) {
    return [{ start: 0, end: original.length, insert: updated }];
  }

  // LCS lengths: dp[i][j] = LCS of a[i:], b[j:]
  const m = a.length;
  const n = b.length;
  const dp: Uint32Array[] = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const hunks: DiffHunk[] = [];
  let pos = 0; // offset in original
  let i = 0;
  let j = 0;
  let open: DiffHunk | null = null;
  const close = () => {
    if (open) hunks.push(open);
    open = null;
  };

  while (i < m || j < n) {
    if (i < m && j < n && a[i] === b[j]) {
      close();
      pos += a[i].length;
      i++;
      j++;
    } else if (j < n && (i === m || dp[i][j + 1] >= dp[i + 1][j])) {
      open ??= { start: pos, end: pos, insert: "" };
      open.insert += b[j];
      j++;
    } else {
      open ??= { start: pos, end: pos, insert: "" };
      pos += a[i].length;
      open.end = pos;
      i++;
    }
  }
  close();

  // Merge hunks separated only by a single space, so "teh dog" → "the cat"
  // reads as one change instead of two
  const merged: DiffHunk[] = [];
  for (const h of hunks) {
    const prev = merged[merged.length - 1];
    const gap = prev ? original.slice(prev.end, h.start) : null;
    if (prev && gap !== null && /^ $/.test(gap)) {
      prev.insert += gap + h.insert;
      prev.end = h.end;
    } else {
      merged.push({ ...h });
    }
  }
  return merged;
}
