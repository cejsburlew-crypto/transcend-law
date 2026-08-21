/**
 * Four-language parity.
 *
 * Every UI string must exist in English, Colombian Spanish, Chinese and
 * Vietnamese. Without this test, keys added to en.ts alone silently render
 * English to Spanish, Chinese and Vietnamese users - which happened to 40
 * practice areas and 9 other keys before it was caught by hand.
 *
 * Add a key to en.ts and forget the others, and this fails.
 */

import en from '../translations/en';
import es from '../translations/es';
import zh from '../translations/zh';
import vi from '../translations/vi';

type Tree = Record<string, unknown>;

/** Flatten to dotted leaf paths, so nested namespaces are compared too. */
const leaves = (tree: Tree, prefix = ''): string[] =>
  Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === 'object' && !Array.isArray(value)
      ? leaves(value as Tree, path)
      : [path];
  });

const enKeys = leaves(en as Tree);
const locales: Array<[string, Tree]> = [
  ['es', es as Tree],
  ['zh', zh as Tree],
  ['vi', vi as Tree],
];

describe('translation parity', () => {
  it('English defines a non-trivial key set', () => {
    expect(enKeys.length).toBeGreaterThan(300);
  });

  it.each(locales)('%s defines every English key', (_name, tree) => {
    const missing = enKeys.filter((k) => !leaves(tree).includes(k));
    expect(missing).toEqual([]);
  });

  it.each(locales)('%s defines no keys English lacks', (_name, tree) => {
    const extra = leaves(tree).filter((k) => !enKeys.includes(k));
    expect(extra).toEqual([]);
  });

  it.each(locales)('%s has no empty strings', (_name, tree) => {
    const read = (path: string): unknown =>
      path.split('.').reduce<any>((acc, k) => (acc == null ? acc : acc[k]), tree);
    const blank = leaves(tree).filter((k) => {
      const v = read(k);
      return typeof v === 'string' && v.trim() === '';
    });
    expect(blank).toEqual([]);
  });

  it.each(locales)('%s is not just a copy of English', (name, tree) => {
    // A locale that duplicates English wholesale means it was never translated.
    const read = (t: Tree, path: string): unknown =>
      path.split('.').reduce<any>((acc, k) => (acc == null ? acc : acc[k]), t);
    const identical = enKeys.filter((k) => {
      const a = read(en as Tree, k);
      const b = read(tree, k);
      return typeof a === 'string' && a === b && a.length > 3;
    });
    // Brand names, locale-neutral labels and format examples legitimately match.
    expect(identical.length / enKeys.length).toBeLessThan(0.2);
  });
});
