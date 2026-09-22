// The in-browser runner must judge exactly like Vitest, or a check could pass
// in one place and fail in the other.  Run each matcher through both on cases
// that should pass and cases that should fail, and compare verdicts.
import { describe, it, expect as vitestExpect } from 'vitest';

import { expect as runnerExpect, collect, run } from './runner';

const verdict = (expect, assertion) => {
  try {
    assertion(expect);
    return 'pass';
  } catch {
    return 'fail';
  }
};

const CASES = {
  toBe: [
    [1, 1], ['a', 'a'], [NaN, NaN], [0, -0], [{}, {}], [null, undefined],
  ],
  toEqual: [
    [[1, [2, 3]], [1, [2, 3]]],
    [{ a: 1, b: undefined }, { a: 1 }],
    [{ a: 1 }, { a: 1, b: 2 }],
    [[1, 2], [1, 2, 3]],
    [[1], { 0: 1 }],
    [{ a: [{ b: 'x' }] }, { a: [{ b: 'x' }] }],
    [{ a: [{ b: 'x' }] }, { a: [{ b: 'y' }] }],
    [null, null], [null, {}], ['1', 1],
  ],
  toMatchObject: [
    [{ a: 1, b: 2 }, { a: 1 }],
    [{ a: 1 }, { a: 1, b: 2 }],
    [{ a: { b: 1, c: 2 } }, { a: { b: 1 } }],
    [{ a: [1, 2] }, { a: [1] }],
    [{ a: [{ x: 1, y: 2 }] }, { a: [{ x: 1 }] }],
    [{ a: 'x' }, { a: 'y' }],
  ],
  toHaveLength: [
    [[1, 2], 2], ['abc', 3], [[1], 2],
  ],
};

describe('runner matchers agree with Vitest', () => {
  Object.entries(CASES).forEach(([matcher, cases]) => {
    cases.forEach(([actual, expected], i) => {
      it(`${matcher} #${i + 1}`, () => {
        const assertion = (expect) => expect(actual)[matcher](expected);
        const negated = (expect) => expect(actual).not[matcher](expected);
        vitestExpect(verdict(runnerExpect, assertion)).toBe(verdict(vitestExpect, assertion));
        vitestExpect(verdict(runnerExpect, negated)).toBe(verdict(vitestExpect, negated));
      });
    });
  });

  it.each([
    ['toBeNull', null], ['toBeNull', undefined],
    ['toBeUndefined', undefined], ['toBeUndefined', 0],
    ['toBeTruthy', 1], ['toBeTruthy', ''],
  ])('%s(%s)', (matcher, actual) => {
    const assertion = (expect) => expect(actual)[matcher]();
    vitestExpect(verdict(runnerExpect, assertion)).toBe(verdict(vitestExpect, assertion));
  });

  it('toThrow and not.toThrow', () => {
    const throws = () => { throw new Error('boom'); };
    const quiet = () => {};
    for (const fn of [throws, quiet]) {
      for (const assertion of [(e) => e(fn).toThrow(), (e) => e(fn).not.toThrow()]) {
        vitestExpect(verdict(runnerExpect, assertion)).toBe(verdict(vitestExpect, assertion));
      }
    }
  });

  it('toContain', () => {
    for (const [actual, item] of [[[1, 2], 2], [[1, 2], 3], ['abc', 'b']]) {
      const assertion = (expect) => expect(actual).toContain(item);
      vitestExpect(verdict(runnerExpect, assertion)).toBe(verdict(vitestExpect, assertion));
    }
  });
});

describe('runner', () => {
  it('reports passes, failures and thrown errors with their path', async () => {
    const tree = collect(({ describe, it, expect }) => {
      describe('group', () => {
        it('passes', () => expect(1).toBe(1));
        it('fails', () => expect(1).toBe(2));
        it('awaits', async () => { await Promise.resolve(); expect(true).toBe(true); });
        it('throws', () => { throw new Error('boom'); });
      });
    });
    const results = await run(tree);
    vitestExpect(results.map((r) => [r.path.join(' › '), r.ok])).toEqual([
      ['group › passes', true],
      ['group › fails', false],
      ['group › awaits', true],
      ['group › throws', false],
    ]);
    vitestExpect(results[3].error.message).toBe('boom');
  });
});
