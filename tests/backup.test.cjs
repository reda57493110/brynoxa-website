// Nightly database backup (GitHub Actions, free): the copy is encrypted before it is stored (the
// repository is public), the database address and the password are never printed, the plain copy
// is deleted, a tiny file fails the run, backups are kept 30 days and never committed.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./_helpers.cjs');

const wf = fs.readFileSync(path.join(ROOT, '.github/workflows/backup.yml'), 'utf8');

test('runs every night at 03:00 Morocco time, and by hand', () => {
  assert.match(wf, /cron: '0 2 \* \* \*'/);
  assert.match(wf, /workflow_dispatch:/);
  assert.match(wf, /permissions:\s*\n\s*contents: read/, 'read-only token');
});

test('encrypted before it is stored; the plain copy is deleted; secrets never printed', () => {
  const dump = wf.indexOf('mongodump --uri="$MONGODB_URI" --archive=db.archive.gz --gzip --quiet');
  const enc = wf.indexOf('openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt');
  const rm = wf.indexOf('rm -f db.archive.gz');
  const upload = wf.indexOf('uses: actions/upload-artifact@v7');
  assert.ok(dump > 0 && dump < enc && enc < rm && rm < upload, 'dump → encrypt → delete plain → upload');
  assert.match(wf, /-pass env:BACKUP_PASSPHRASE/, 'the password is read from the environment, not the command line');
  assert.match(wf, /path: \|\s*\n\s*brynoxa-db-\*\.archive\.gz\.enc\s*\n\s*brynoxa-db-\*-readable\.7z\s*\n\s*retention-days/, 'only the locked files are kept');
  assert.ok(!/echo[^\n]*\$(MONGODB_URI|BACKUP_PASSPHRASE)\b/.test(wf), 'never printed');
  assert.match(wf, /"\$\{#BACKUP_PASSPHRASE\}" -lt 20/, 'a real password is required');
  assert.match(wf, /if \[ "\$size" -lt 1024 \]/, 'an almost empty backup fails the run');
  assert.match(wf, /retention-days: 30/);
});

test('backups are never committed; the restore guide exists', () => {
  const ignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  for (const p of ['*.archive', '*.archive.gz', '*.archive.gz.enc']) assert.ok(ignore.split(/\r?\n/).includes(p), p);
  const guide = fs.readFileSync(path.join(ROOT, 'docs/BACKUPS.md'), 'utf8');
  assert.ok(guide.includes('openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000'), 'decrypt with the same settings');
  assert.ok(guide.includes("--nsFrom='brynoxa.*' --nsTo='brynoxa_restore.*'"), 'safe restore into a separate database first');
});

test('a readable 7-Zip copy, locked with the same password, plain copies deleted', () => {
  const dump = wf.indexOf('mongodump --uri="$MONGODB_URI" --out=plain --quiet');
  const zip = wf.indexOf('7z a -t7z -mhe=on -mx=9 -p"$BACKUP_PASSPHRASE"');
  const rm = wf.indexOf('rm -rf plain readable');
  const upload = wf.indexOf('uses: actions/upload-artifact@v7');
  assert.ok(dump > 0 && dump < zip && zip < rm && rm < upload, 'dump → lock → delete plain → upload');
  assert.match(wf, /brynoxa-db-\$stamp-readable\.7z" \.\/readable\/\*/, 'kept with the restore file');
  const guide = fs.readFileSync(path.join(ROOT, 'docs/BACKUPS.md'), 'utf8');
  assert.ok(guide.includes('## Looking at a backup on Windows') && guide.includes('7-zip.org'));
});
