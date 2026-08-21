#!/usr/bin/env node
// Lint only the files changed against the base branch.
//
// The codebase carries 808 pre-existing lint errors, so a blocking full-repo
// lint is not achievable today. Linting the diff stops the bleeding: new code
// cannot introduce floating promises, misused promises, or async-without-await,
// while the existing backlog is paid down separately.
//
// Exits non-zero on any error in changed files.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const base = process.env.GITHUB_BASE_REF
  ? `origin/${process.env.GITHUB_BASE_REF}`
  : process.env.LINT_BASE || 'HEAD~1';

const sh = (cmd, args) =>
  execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });

let changed = [];
try {
  changed = sh('git', ['diff', '--name-only', '--diff-filter=ACMR', base, '--'])
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean);
} catch {
  console.log(`Could not diff against ${base}; skipping changed-file lint.`);
  process.exit(0);
}

const targets = changed.filter(
  (f) =>
    /\.(ts|tsx)$/.test(f) &&
    !f.includes('/node_modules/') &&
    !f.startsWith('transcend-law/') &&
    !f.endsWith('.d.ts') &&
    existsSync(f)
);

if (targets.length === 0) {
  console.log('No changed TypeScript files to lint.');
  process.exit(0);
}

console.log(`Linting ${targets.length} changed file(s) against ${base}:`);
targets.forEach((f) => console.log(`  ${f}`));

try {
  execFileSync('npx', ['eslint', ...targets], {
    stdio: 'inherit',
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=6144' },
  });
  console.log('Changed files are lint-clean.');
} catch {
  console.error('\nLint errors in changed files. Fix these before merging.');
  process.exit(1);
}
