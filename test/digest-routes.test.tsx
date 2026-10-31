import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

const dir = mkdtempSync(join(tmpdir(), 'rig-routes-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const line = (job: string, status: string, at: string, owner: string | null = 'rook') =>
  JSON.stringify({ at, job, status, owner });

writeFileSync(
  join(dir, '2026-01-01.jsonl'),
  [
    line('zeta/job', 'ok', '2026-01-01T01:00:00+01:00'),
    line('alpha/job', 'ok', '2026-01-01T02:00:00+01:00'),
    line('mid/job', 'ok', '2026-01-01T03:00:00+01:00'),
  ].join('\n') + '\n',
);
writeFileSync(join(dir, '2026-01-02.jsonl'), '');
writeFileSync(
  join(dir, '2026-01-03.jsonl'),
  [
    line('good/one', 'ok', '2026-01-03T01:00:00+01:00'),
    '{"at": "trunc',
    line('good/two', 'ok', '2026-01-03T02:00:00+01:00'),
  ].join('\n') + '\n',
);

const app = createApp({
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir: dir,
});

const getJson = async (night: string) => {
  const res = await app.request(`/api/digest/${night}`);
  return { res, body: (await res.json()) as Night };
};

describe('digest routes', () => {
  it('200 for a night with lines; page and JSON list the same jobs in order', async () => {
    const page = await app.request('/digest/2026-01-01');
    const html = await page.text();
    const { res, body } = await getJson('2026-01-01');
    expect(page.status).toBe(200);
    expect(res.status).toBe(200);
    const jobs = body.rows.map((r) => r.job);
    expect(jobs).toEqual(['alpha/job', 'mid/job', 'zeta/job']);
    for (const j of jobs) expect(html).toContain(j);
    const positions = jobs.map((j) => html.indexOf(j));
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('404 for a night with no file', async () => {
    expect((await app.request('/digest/2026-02-02')).status).toBe(404);
    expect((await app.request('/api/digest/2026-02-02')).status).toBe(404);
  });

  it('empty night: page says nothing ran, JSON has no rows', async () => {
    const page = await app.request('/digest/2026-01-02');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');
    const { res, body } = await getJson('2026-01-02');
    expect(res.status).toBe(200);
    expect(body.rows).toEqual([]);
    expect(body.badLines).toBe(0);
  });

  it('a bad line still gives 200, is counted, and good rows remain', async () => {
    const page = await app.request('/digest/2026-01-03');
    const html = await page.text();
    expect(page.status).toBe(200);
    expect(html).toContain('could not be read');
    expect(html).toContain('good/one');
    expect(html).toContain('good/two');
    const { res, body } = await getJson('2026-01-03');
    expect(res.status).toBe(200);
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['good/one', 'good/two']);
  });
});
