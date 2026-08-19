// Backfill: encrypt existing plaintext message bodies.
//
// The application reads legacy plaintext rows transparently, so this can run at
// any time after deploying field encryption - it is not a blocking migration.
// Until it completes, older messages remain plaintext at rest and are NOT
// covered by the breach-notification encryption safe harbours.
//
//   npx tsx src/scripts/backfillMessageEncryption.ts          # dry run
//   npx tsx src/scripts/backfillMessageEncryption.ts --apply  # write
//
// Safe to re-run: already-encrypted rows are skipped.

import { query } from '../database/connection';
import { encryptField, isEncrypted, isEncryptionConfigured } from '../services/fieldEncryption';

const BATCH_SIZE = 500;

const run = async () => {
  const apply = process.argv.includes('--apply');

  if (!isEncryptionConfigured()) {
    console.error('FIELD_ENCRYPTION_KEY is not set. Generate one: openssl rand -hex 32');
    process.exit(1);
  }

  console.log(apply ? 'Encrypting plaintext message bodies...' : 'DRY RUN - pass --apply to write.');

  let scanned = 0;
  let encrypted = 0;
  let lastId: string | null = null;

  for (;;) {
    const result: any = await query(
      `SELECT id, content
         FROM p2p_messages
        WHERE ($1::uuid IS NULL OR id > $1::uuid)
        ORDER BY id
        LIMIT ${BATCH_SIZE}`,
      [lastId]
    );

    if (result.rows.length === 0) break;

    for (const row of result.rows) {
      scanned++;
      lastId = row.id;

      if (isEncrypted(row.content)) continue;

      if (apply) {
        await query('UPDATE p2p_messages SET content = $1 WHERE id = $2', [
          encryptField(row.content),
          row.id,
        ]);
      }
      encrypted++;
    }

    console.log(`  scanned ${scanned}, ${apply ? 'encrypted' : 'would encrypt'} ${encrypted}`);
  }

  console.log(
    `\nDone. Scanned ${scanned} messages; ${apply ? 'encrypted' : 'would encrypt'} ${encrypted}.`
  );
  process.exit(0);
};

run().catch(error => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
