// A tiny test runner with the same shape as Vitest's describe/it/expect, so
// the checks in this folder run unchanged under `yarn test` and in any
// browser at /tests/.  It implements only the matchers the checks use;
// runner.test.js holds each one to Vitest's verdicts.

const isObject = (v) => v !== null && typeof v === 'object';

// Deep equality as Vitest's toEqual sees it: undefined properties count as
// absent, and arrays must match element for element.
function equals(a, b) {
  if (Object.is(a, b)) return true;
  if (!isObject(a) || !isObject(b)) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    return a.length === b.length && a.every((v, i) => equals(v, b[i]));
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((k) => equals(a[k], b[k]));
}

// Vitest's toMatchObject: every property of `expected` matches, recursively;
// arrays must have the same length.
function matches(actual, expected) {
  if (!isObject(expected)) return Object.is(actual, expected) || equals(actual, expected);
  if (!isObject(actual)) return false;
  if (Array.isArray(expected)) {
    return Array.isArray(actual) && actual.length === expected.length
      && expected.every((v, i) => matches(actual[i], v));
  }
  return Object.keys(expected).every((k) => k in actual && matches(actual[k], expected[k]));
}

const show = (v) => {
  try {
    return JSON.stringify(v, (_, x) => x === undefined ? '__undefined__' : x)
      ?.replace(/"__undefined__"/g, 'undefined') ?? String(v);
  } catch {
    return String(v);
  }
};

export class AssertionError extends Error {}

export function expect(actual) {
  const assertion = (negate) => {
    const check = (pass, message) => {
      if (pass === negate) throw new AssertionError(negate ? `not: ${message}` : message);
    };
    return {
      toBe: (e) => check(Object.is(actual, e), `expected ${show(actual)} to be ${show(e)}`),
      toEqual: (e) => check(equals(actual, e), `expected ${show(actual)} to equal ${show(e)}`),
      toMatchObject: (e) => check(matches(actual, e), `expected ${show(actual)} to match ${show(e)}`),
      toHaveLength: (n) => check(actual?.length === n, `expected length ${actual?.length} to be ${n}`),
      toBeNull: () => check(actual === null, `expected ${show(actual)} to be null`),
      toBeUndefined: () => check(actual === undefined, `expected ${show(actual)} to be undefined`),
      toBeTruthy: () => check(Boolean(actual), `expected ${show(actual)} to be truthy`),
      toContain: (e) => check(actual?.includes?.(e), `expected ${show(actual)} to contain ${show(e)}`),
      toThrow: () => {
        let thrown = null;
        try { actual(); } catch (e) { thrown = e || new Error(String(e)); }
        if (negate && thrown) {
          throw new AssertionError(`expected no error, but got: ${thrown.message}`);
        }
        check(Boolean(thrown), 'expected the function to throw');
      },
    };
  };
  return Object.assign(assertion(false), { not: assertion(true) });
}

// Collect describe/it calls into a tree, then run it.
export function collect(register, content) {
  const root = { name: '', children: [] };
  let current = root;
  const api = {
    expect,
    describe(name, fn) {
      const group = { name, children: [] };
      current.children.push(group);
      const parent = current;
      current = group;
      try { fn(); } finally { current = parent; }
    },
    it(name, fn) {
      current.children.push({ name, fn });
    },
  };
  register(api, content);
  return root;
}

// Run every test; returns [{ path: [...names], ok, error?, ms }].
export async function run(tree, { onResult=() => {} }={}) {
  const results = [];
  const walk = async (node, path) => {
    for (const child of node.children) {
      const childPath = [...path, child.name];
      if (child.children) {
        await walk(child, childPath);
        continue;
      }
      const start = performance.now();
      let error = null;
      try {
        await child.fn();
      } catch (e) {
        error = e;
      }
      const result = { path: childPath, ok: !error, error, ms: performance.now() - start };
      results.push(result);
      onResult(result);
    }
  };
  await walk(tree, []);
  return results;
}
