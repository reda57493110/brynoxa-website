# Database backups

Every night at 03:00 (Morocco time) GitHub makes a full copy of the Brynoxa database — products,
orders, customers, settings, stock, everything — encrypts it with your backup password, and keeps
it for **30 days**. It is free (no paid MongoDB plan): `.github/workflows/backup.yml`.

The repository is public, so the copy is **always encrypted** before it is stored. Without the
backup password nobody can read it — not GitHub, not a visitor, not you. Keep the password in a
password manager.

## Setting it up (once)

1. GitHub → your repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:
   - `MONGODB_URI` — the same value as `MONGODB_URI` in Vercel (Vercel → Settings → Environment Variables).
   - `BACKUP_PASSPHRASE` — a new long password (20+ characters). Save it in your password manager first.
2. MongoDB Atlas → **Network Access**: the database must accept connections from anywhere
   (`0.0.0.0/0`) — usually already the case, because Vercel also connects from changing addresses.
3. GitHub → **Actions** → **Database backup** → **Run workflow**. After a minute or two the run turns
   green ✅ and shows a file under **Artifacts** (`brynoxa-db-…`).

From then on it runs by itself every night. A red ❌ run means that night's copy failed: open it to
see why (a wrong secret, Atlas refusing the connection…).

Note: GitHub pauses scheduled runs on a repository with no activity (no commit) for 60 days. If
that happens, Actions shows a banner — click **Enable workflow**.

## Downloading a backup

GitHub → **Actions** → **Database backup** → pick the night you want → **Artifacts** →
`brynoxa-db-…`. It is a zip with two files:

| File | What it is for |
|---|---|
| `brynoxa-db-<date>-readable.7z` | **To look at the data on your computer.** One file per collection (`products.json`, `orders.json`, `users.json`…). |
| `brynoxa-db-<date>.archive.gz.enc` | **To restore the shop** (steps below). Windows cannot open it by double-click — that is normal. |

## Looking at a backup on Windows

1. Install **7-Zip** (free): https://www.7-zip.org
2. Right-click the downloaded zip → **Extract All**.
3. Right-click `brynoxa-db-<date>-readable.7z` → **7-Zip** → **Extract here** → type the backup password.
4. Open any `.json` file with Notepad (or VS Code).

These files are for reading. To put data back into the shop, use the `.enc` file and the restore steps below.



## Opening the restore file (decrypt)

Needs OpenSSL (built into macOS / Linux; on Windows use Git Bash, which comes with Git):

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in brynoxa-db-<date>.archive.gz.enc -out brynoxa-db.archive.gz
```

It asks for the backup password. A wrong password gives "bad decrypt".

## Restoring

Needs the MongoDB Database Tools (`mongorestore`): https://www.mongodb.com/try/download/database-tools

**Safest first: restore into a separate database to look at it** (the live shop is not touched):

```bash
mongorestore --uri="<your MONGODB_URI>" --archive=brynoxa-db.archive.gz --gzip --nsFrom='brynoxa.*' --nsTo='brynoxa_restore.*'
```

(Replace `brynoxa` with your database name if it is different — it is the name after the last `/` in
`MONGODB_URI`.)

**Putting the shop back to that night** (replaces the current data — only when something was lost):

```bash
mongorestore --uri="<your MONGODB_URI>" --archive=brynoxa-db.archive.gz --gzip --drop
```

`--drop` empties each collection before restoring it, so the database ends up exactly as it was
at that backup. Orders placed after the backup are lost — check the shop and Admin afterwards.

## Good habits

- Once a month, download one backup and check it opens (decrypt step above).
- Before a big change (deleting the test products, importing a catalogue), run a backup by hand:
  **Actions → Database backup → Run workflow**.
- Never paste the backup password or `MONGODB_URI` in a chat, an email or the code.
