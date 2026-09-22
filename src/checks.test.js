// Runs the portable checks under Vitest, reading the game files from disk.
// The same checks run in the browser at /tests/ (see src/checks/page.js).
import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import { join } from 'path';
import files from 'virtual:content-manifest';

import checks from './checks';
import { loadContent } from './checks/content';
import { collect, run } from './checks/runner';

const content = await loadContent(files, (file) => readFile(join(__dirname, '..', 'public', file), 'utf8'));

checks.forEach(({ name, register }) => {
  describe(name, () => register({ describe, it, expect }, content));
});

// The browser has no Vitest: it uses the small runner in checks/runner.js.
// Run everything through that runner too, so a pass here means a pass there.
describe('in-browser runner', () => {
  it('passes every check that Vitest passes', async () => {
    const results = [];
    for (const { name, register } of checks) {
      results.push(...await run(collect(register, content)).then((rs) => rs.map((r) => ({ ...r, name }))));
    }
    const failures = results.filter((r) => !r.ok).map((r) => `${r.name} › ${r.path.join(' › ')}: ${r.error.message}`);
    expect(failures).toEqual([]);
    expect(results.length).toBeGreaterThan(100);
  });
});
