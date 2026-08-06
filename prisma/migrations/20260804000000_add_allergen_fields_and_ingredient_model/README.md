# UNAPPLIED — do not assume this has run

Status as of 2026-08-04: this migration has **not** been applied to any
database (staging or production). Application was explicitly deferred pending
user approval.

To apply to staging once approved:

```bash
npx tsx /home/cedar/Projects/build-migrate.ts ingredientbot.com
```

(db-doctor is wired into build-migrate and will verify `.env` first. Note this
site is on the broken-migration-chain list — `migrate deploy` works against the
existing staging DB, but a *fresh* DB needs `--push`.)

Delete this README after the migration has been applied and verified.
