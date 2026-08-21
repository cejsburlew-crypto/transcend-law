#!/usr/bin/env node
// Frontend typecheck ratchet.
//
// The frontend typecheck was VACUOUS until now: tsconfig.json is a
// solution-style config with "files": [], so `tsc --noEmit -p` checked nothing,
// and tsconfig.app.json carried an invalid `ignoreDeprecations: "6.0"` that made
// tsc bail with a single config error. Both are fixed; the real error count was
// 122 and is being driven down.
//
// Until it reaches zero, this gate fails only if the count INCREASES. That
// blocks new type errors without a permanently-red required check - and unlike
// `|| true`, it cannot silently hide a regression.
//
// Lower BASELINE as errors are fixed. It must never be raised.

import { execFileSync } from 'node:child_process';

const BASELINE = 64;

let output = '';
try {
  execFileSync('npx', ['tsc', '-b', 'transcend-frontend', '--force'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch (err) {
  output = `${err.stdout || ''}${err.stderr || ''}`;
}

const errors = (output.match(/error TS\d+/g) || []).length;

console.log(`Frontend type errors: ${errors} (baseline ${BASELINE})`);

if (errors > BASELINE) {
  console.error(
    `\nType errors increased by ${errors - BASELINE}. Fix them, or you are adding to a backlog ` +
      `that already hid 122 errors behind a no-op config.`
  );
  console.error(output.split('\n').filter((l) => l.includes('error TS')).slice(0, 40).join('\n'));
  process.exit(1);
}

if (errors < BASELINE) {
  console.log(`\nProgress: ${BASELINE - errors} fewer than baseline. Lower BASELINE to ${errors} in scripts/typecheck-ratchet.mjs.`);
}

if (errors === 0) {
  console.log('\nFrontend is type-clean. Replace this ratchet with a plain blocking typecheck.');
}
