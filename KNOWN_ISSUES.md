# Known Issues

Tracked items from the pre-onboarding audit. Severity:
- **P0**: Blocks onboarding — fix before inviting users.
- **P1**: Should be fixed before scaling beyond the first customer.
- **P2**: Quality-of-life improvements. Safe to ship without.

---

## P1 — Main bundle size (~1.4 MB gzipped)

**Description.** The main app chunk is ~5 MB unminified / ~1.4 MB gzipped. `bwip-js` is already split off. `recharts`, `cmdk`, and `@dnd-kit/*` are imported across many files and stay in the main bundle.

**Impact.** First paint on slow connections. Not a blocker on LAN/fiber (typical Washington producer).

**Suggested fix.** Convert heavy detail pages to `React.lazy()` + `<Suspense>`:

```tsx
const ReportRunnerPage = lazy(() => import("@/pages/reports/ReportRunnerPage"));
const BatchDetailPage = lazy(() => import("@/pages/inventory/BatchDetailPage"));
// ...
```

Expected result: main chunk drops to ~800 KB gzipped; each detail page loads on demand.

---

## P1 — CCRS SAW direct upload

**Description.** `supabase/functions/upload-to-ccrs/index.ts` stubs the direct-upload path. Real SAW OAuth/SAML integration pending LCB integrator approval.

**Impact.** Operators download CSV + upload manually at cannabisreporting.lcb.wa.gov. Functional but adds friction.

**Suggested fix.** Once LCB approves Cody Grow as an integrator, swap the placeholder branch in `upload-to-ccrs/index.ts` for actual SAW authentication + HTTPS POST to the upload endpoint. Store credentials encrypted via `pgcrypto` (`ccrs_saw_password_encrypted` column already on `grow_org_settings`).

---

## P2 — Scheduled report cron trigger

**Description.** `send-scheduled-report` Edge Function fires on-demand via "Run Now" button, but there's no scheduled trigger wired.

**Impact.** Scheduled reports don't auto-send until a cron fires the function.

**Suggested fix.** Use `pg_cron` extension in Supabase, or an external scheduler (GitHub Actions, Vercel Cron, or the VPS cron):

```sql
-- In Supabase SQL editor, with pg_cron enabled:
SELECT cron.schedule(
  'send-scheduled-reports',
  '*/15 * * * *',
  $$ SELECT net.http_post(
    url := 'https://<project>.supabase.co/functions/v1/send-scheduled-report',
    headers := jsonb_build_object('Authorization', 'Bearer <anon-key>')
  ); $$
);
```

---

## P2 — React.memo not used on large lists

**Description.** Grow Board cards, Plants list rows, Batches list rows re-render on parent state changes even when their props haven't changed.

**Impact.** Noticeable jank on grows with 1000+ plants. Fine for typical MVP-era customer.

**Suggested fix.** Wrap the row/card components in `React.memo` with shallow comparison on the data prop. Add to PlantsPage DataTable cell renderers, GrowBoardPage card components.

---

## P2 — Kiosk weigh → QA sample flow incomplete

**Description.** Kiosk Weigh screen writes to `grow_scale_readings` and wires to wet/dry harvest weights. QA Sample context records a scale reading but doesn't auto-pull a sample.

**Impact.** Operators who weigh a QA sample via kiosk still need to create the sample on the desktop.

**Suggested fix.** Add QA lot picker to the kiosk weigh screen when context = "qa_sample", call `useCreateQASample` with the weight.

---

## P2 — Route optimization uses ZIP proximity only

**Description.** `src/lib/routeOptimizer.ts` sorts stops by ZIP code nearest-neighbor. Real drive time depends on road geometry, not ZIP number.

**Impact.** Sequence is directionally correct but not optimal for long routes across a metro.

**Suggested fix.** Integrate Google Maps Directions API (`waypoints` parameter with `optimize_waypoints=true`). Requires a Google Maps API key.

---

## P2 — Commission attribution heuristic

**Description.** `useCommissionReport` attributes orders to the account's `assigned_rep_id` (falls back to the user who created the order). Doesn't support split commissions or override per-order.

**Impact.** Adequate for simple orgs, limiting for orgs with multi-rep deals.

**Suggested fix.** Add a `grow_order_attributions` table with (order_id, rep_id, split_percentage) for explicit override. Default to account's rep when no override.

---

## P2 — AI photo analysis requires ask-cody function deployed

**Description.** `PlantPhotoAnalysis` calls `supabase.functions.invoke("ask-cody", ...)`. If the function isn't deployed, the feature is inert.

**Impact.** Only if Ask Cody isn't already deployed — it is as of the latest push.

**Suggested fix.** N/A once ask-cody is live. The component has graceful fallback (shows error toast, doesn't crash).
