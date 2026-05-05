# RUNBOOK — ingredientbot.com

> Last updated: 2026-04-30

## Database Restore (Railway PostgreSQL)

1. Find backup in Railway dashboard: project → ingredientbot (production) → Database → Backups
2. Download the `.dump` file
3. Restore: `pg_restore --clean --if-exists -h <HOST> -U <USER> -d <DB> backup.dump`
4. Verify: connect with `psql` and check row counts on `User`, `Recipe` tables

## Vercel Rollback

```bash
vercel rollback
```
Or: Vercel Dashboard → Deployments → "Promote to Production"

## Incident Response Checklist

1. Check Sentry for error spikes
2. Check Vercel runtime logs: `vercel logs --expand`
3. Check Railway for DB CPU/memory spikes
4. If bad deploy: rollback via Vercel
5. If bad migration: restore from Railway backup

## Environment Variables

```bash
vercel env ls
railway variables
```

## Key Contacts

- Hosting: Vercel + Railway
- Error tracking: Sentry
- DNS: GoDaddy
