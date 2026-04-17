# Cody Grow — Deployment Guide

## Stack

- **Frontend:** React 19 + Vite, deployed on Vercel
- **Backend:** Supabase (Postgres + Auth + Storage + Edge Functions)
- **AI:** Anthropic Claude (via `ask-cody` Edge Function)
- **Barcodes:** bwip-js (client-side SVG)
- **Email:** Resend (optional, for scheduled reports)

## Required environment variables

Set in Vercel dashboard → Settings → Environment Variables:

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-public-key>
```

That's it for the client. Everything else lives in Supabase.

## Supabase project setup

1. Create a new project at [supabase.com](https://supabase.com).
2. Link the repo:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   ```
3. Push migrations:
   ```bash
   npx supabase db push --linked
   ```
   This applies everything under `supabase/migrations/`, in timestamp order.
4. Set Edge Function secrets:
   ```bash
   npx supabase secrets set ANTHROPIC_API_KEY=<sk-ant-...>
   # Optional — for scheduled report email delivery:
   npx supabase secrets set RESEND_API_KEY=<re_...>
   npx supabase secrets set RESEND_FROM=reports@yourdomain.com
   ```
5. Deploy Edge Functions:
   ```bash
   npx supabase functions deploy ask-cody --no-verify-jwt
   npx supabase functions deploy send-scheduled-report --no-verify-jwt
   npx supabase functions deploy upload-to-ccrs --no-verify-jwt
   ```

## Edge Functions

| Function | Purpose | Triggered by |
|---|---|---|
| `ask-cody` | Claude proxy for chat + image analysis | Ask Cody widget, Plant Photo Analysis |
| `send-scheduled-report` | Runs scheduled reports, emails or stores results | Cron or manual "Run Now" |
| `upload-to-ccrs` | Stages CCRS submissions (manual branch until integrator approved) | CCRS Dashboard "Mark Uploaded" |

## Scheduled reports — cron wiring

The `send-scheduled-report` function expects an external ping every 15 minutes. Enable `pg_cron` in Supabase and add:

```sql
SELECT cron.schedule(
  'send-scheduled-reports',
  '*/15 * * * *',
  $$ SELECT net.http_post(
    url := 'https://<project>.supabase.co/functions/v1/send-scheduled-report',
    headers := jsonb_build_object('Authorization', 'Bearer ' || '<anon-key>')
  ); $$
);
```

Alternatively, Vercel Cron or GitHub Actions can hit the function URL on the same cadence.

## Local development

```bash
git clone <repo>
cd cody-grow
npm install
cp .env.example .env.local    # fill in VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm run dev
```

App runs at `http://localhost:5173`.

To run Edge Functions locally:

```bash
npx supabase start              # spins up a local Postgres + functions runtime
npx supabase functions serve    # hosts functions at http://localhost:54321
```

## Production deployment

Pushing to `master` triggers Vercel to build and deploy automatically.

```bash
git push
```

Vercel settings:
- Framework preset: **Vite**
- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`
- Node version: 20+

## Database migrations

Migrations live in `supabase/migrations/` with timestamp-prefixed filenames. To add one:

```bash
npx supabase migration new <short_name>
# edits the new file in supabase/migrations/
npx supabase db push --linked
```

## Storage buckets

The app uses these Supabase Storage buckets (create them in the Supabase dashboard or via SQL):

- `reports` — scheduled report CSV outputs (private, 7-day signed URLs)
- `avatars` — user avatars (public)
- `strain-photos` — strain imagery (public)
- `plant-photos` — plant observation photos (private, org-scoped)

## RLS

Every `grow_*` table has Row Level Security enabled. Policies scope reads + writes to the user's org via `organization_members.org_id`. Never use the service role key from the frontend — only the anon key + user JWT.

## CCRS integrator path

Cody Grow is not yet an approved WSLCB CCRS integrator. Current flow:
1. App generates CCRS CSVs
2. Operator downloads + uploads to cannabisreporting.lcb.wa.gov manually
3. Operator confirms upload success to mark submission as accepted

When integrator approval arrives, update `supabase/functions/upload-to-ccrs/index.ts` to swap the manual branch for direct SAW authentication + HTTPS POST to the CCRS upload endpoint.
