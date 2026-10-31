// Plan morning-digest § 1. The contract every part of § 2 builds against.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl, after parsing.
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job for the night.
export type DigestRow = {
  job: string;
  owner: string | null; // null renders as `—`
  runs: number; // lines for this job
  retries: number; // lines with status `retry`
  lastStatus: RunStatus;
  lastError: string | null; // error of the last line that had one; null renders as `—`
  firstAt: string; // as in the log, offset kept
  lastAt: string;
};

export type Night = {
  night: string; // YYYY-MM-DD
  rows: DigestRow[]; // sorted by job; page and JSON both use this order
  counts: Record<RunStatus, number>; // lines per status, for the board
  badLines: number; // lines that did not parse; counted, never thrown
};

// Reads runs/<night>.jsonl. Returns null when the night has no file (→ 404).
// An empty file gives a Night with no rows ("nothing ran").
export type ReadNight = (runsDir: string, night: string) => Night | null;
