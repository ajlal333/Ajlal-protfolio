# LogicFolds Site Agent Guide

Working context for coding agents. This is the current source of truth for the project.

## 1. Project

- **What:** LogicFolds is a business-facing AI automation studio website. It is not a personal portfolio, and must not become a resume page unless the user asks.
- **Audience:** business owners and operators who want AI systems for real workflows.
- **Offer:** agentic workflow orchestration, grounded decision systems, AI platforms and integrations.
- **Primary CTA:** book a strategy/project call; the Opportunity Sprint (`/opportunity-sprint/`) is the main offer page.
- **Repo:** https://github.com/ajlal333/Ajlal-protfolio (production branch: `main`)
- **Live:** https://logicfolds.com (Netlify, site id `2e52c233-f33a-43da-8750-70aa1ac752fa`, free plan)
- **Owner email:** ajlalgoraya333@gmail.com
- **Branding:** always "LogicFolds". Never "Ajlal AI", "Ajlal AI Solutions", or "AH".
- **Truthfulness:** business-first, concise, production-minded. Never invent clients, deployments, benchmarks, testimonials, revenue, or results. Every public proof point must be real. Some healthcare items are reusable templates or designs, not live clinical deployments, and the UI visuals are anonymized representations.

## 2. Stack

Vite 8 (rolldown), vanilla JavaScript, Three.js 0.166, plain CSS, Netlify hosting and Functions, Supabase, Resend, PostHog. No React, no framework router. Do not introduce one.

Vite entries (`vite.config.js`): `index.html`, `opportunity-sprint/index.html`, `blog/post.html` (a build shell, not a page).

## 3. Commands

```bash
npm install
npm run dev            # Vite only; Netlify Functions do NOT run here
npm run validate:blog  # validates content/blog-posts.json
npm run build          # vite build + scripts/build-blog-shell.mjs
npm run preview
```

Run `npm run validate:blog` then `npm run build` before committing.

Local dev: `/api/book-call` and the `/blog/` routes need Netlify Functions, so under `npm run dev` they fail (the booking form falls back to a `mailto:`). Use `netlify dev` to exercise the real functions. Optional `.env.local` (gitignored) for analytics/Supabase in dev:

```
VITE_SUPABASE_URL=https://caefslijpwsnmnumvxie.supabase.co
VITE_SUPABASE_ANON_KEY=...       # publishable anon key
VITE_POSTHOG_PROJECT_TOKEN=...   # publishable phc_ token
```

Production needs none of this; all env vars are set in Netlify.

## 4. Architecture

| Area | Where |
|---|---|
| Home | `index.html`, `src/main.js`, `src/styles.css` |
| Tesseract background | `src/tesseract.js` (Three.js, named imports, loaded with a dynamic `import()` from `main.js` so it stays off the critical path) |
| Booking | `src/booking.js` -> `/api/book-call` -> `netlify/functions/book-call.js` (Resend via `fetch`). Sends the owner notification and a best-effort lead confirmation. Mailto fallback goes to `ajlal@logicfolds.com`. |
| Blog render | `lib/blog-render.mjs` (pure HTML, no fs/env/net) |
| Blog data | `lib/blog-source.mjs` (Supabase read, falls back to `content/blog-posts.json`) |
| Blog serving | `netlify/functions/blog-article.js`, `blog-index.js`, `blog-sitemap.js` |
| Blog build shell | `blog/post.html` + `scripts/build-blog-shell.mjs` -> generated `lib/blog-shell.generated.mjs` (gitignored); `src/article.js`, `src/blog.css` |
| Blog publish (keyed) | `scripts/publish-one.mjs` (needs `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`) |
| Blog publish (env-free) | `scripts/validate-draft.mjs` validates a draft, verifies sources, prints an INSERT. Used by the daily cloud routine. |
| Blog sync | `scripts/sync-posts.mjs` (`npm run posts:push` / `posts:pull`) |
| Opportunity Sprint | `opportunity-sprint/index.html`, `src/opportunity-sprint.{js,css}` |
| Analytics | `src/analytics.js` (env-gated PostHog, US host, CDN-loaded, off on localhost) |
| Shared nav | `src/nav.js` |
| Vercel booking handler | `api/book-call.js`: unused on Netlify, kept for a possible future Vercel move |
| Schema | `supabase/schema.sql`, `supabase/README.md` |
| Assets | `public/` (favicon, og-cover, workflow demo preview, `LogicFolds_Credentials.pdf`, self-hosted `fonts/`) |
| Archived resumes | `unpublished/`. Do not delete without the user's confirmation. |

### Blog mechanics

Posts live in a Supabase `posts` table and are server-rendered per request by Netlify Functions. Publishing is an `INSERT`: no git commit, no deploy. URLs are `/blog/` and `/blog/posts/<slug>/`.

- Articles ship full HTML with OG tags and BlogPosting JSON-LD. Never move rendering into the browser; that breaks crawlers and link previews.
- RLS: the `anon` key reads only `status='published' AND published<=today`. Writes need `service_role`, server-side only.
- If Supabase is unconfigured, paused or down, the functions serve `content/blog-posts.json` and drop the CDN TTL to 60s. Preserve this fallback.
- The homepage blog strip renders the bundled snapshot first, then refreshes from Supabase with the anon key.
- The article CTA links to `/opportunity-sprint/`.

### Booking flow

1. The form posts JSON to `/api/book-call`; `netlify.toml` rewrites it to `/.netlify/functions/book-call`.
2. The function validates `name`, `email`, `message` (company is optional; service context is a hidden field; `companyFax` is a honeypot).
3. It emails the owner through Resend, then sends the lead a best-effort confirmation.
4. If the function fails, the front end opens a prefilled `mailto:`.

`POST /api/book-call 404` in production means `netlify.toml` or the function is missing from the deployed commit, or Netlify did not redeploy.

## 5. Already set up (do NOT redo)

- **Supabase** project `caefslijpwsnmnumvxie`: `posts` table, RLS verified. Netlify env: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. `.mcp.json` is committed; authenticate the supabase connector per device.
- **Daily blog routine:** Claude cloud routine "LogicFolds daily blog publisher" (`trig_015cxgmbTSdMzwMeNaWi6Xrw`), 04:00 UTC (09:00 Asia/Karachi). It drafts one post and inserts it through the Supabase MCP connector plus `scripts/validate-draft.mjs`. It is account-level and already running. **Do not create a second scheduler (double-publish).** It is intermittent (connector auth expiry, cloud egress blocks). When it misses a day, publish manually: write a draft, run `node scripts/validate-draft.mjs draft.json`, and execute the printed SQL through the Supabase MCP. The old Codex automation `publish-logicfolds-blog-posts` and the git-based blog flow are obsolete.
- **Booking email:** Resend, domain `logicfolds.com` verified. Netlify env: `RESEND_API_KEY`, `BOOKING_TO_EMAIL=ajlalgoraya333@gmail.com`, `BOOKING_FROM_EMAIL=LogicFolds <ajlal@logicfolds.com>`.
- **Domain email:** free Zoho mailbox `ajlal@logicfolds.com`; DNS on Netlify/NS1 with SPF, DKIM (`zmail._domainkey`) and DMARC (`_dmarc`).
- **PostHog:** `VITE_POSTHOG_PROJECT_TOKEN` set in Netlify (US cloud). Analytics and session replay are live in production and off on localhost by design.
- **Google Search Console:** verified by the `google-site-verification` meta tag in `index.html`; `sitemap.xml` submitted.

## 6. Constraints and rules

- **Netlify free plan: 300 credits/month, 15 per production deploy (about 20 deploys).** Deploys are scarce. Never reintroduce a deploy-per-post blog workflow. Batch site changes into single deploys. Pushing to `main` is the deploy.
- **Bundle size:** Three.js is the dominant cost. Keep it as named imports in `src/tesseract.js`, lazily loaded, and do not add large dependencies.
- **Blog editorial:** write for business owners and operators evaluating practical AI (orchestration, decision controls, integrations, evaluation, operations, measurable lessons). Verify every source URL resolves before citing. Keep claims factual and traceable, and preserve client confidentiality. `scripts/validate-blog.mjs` and the DB constraints enforce: required fields, unique kebab-case slugs, YYYY-MM-DD dates, newest first, no future dates, at least 2 takeaways, at least 3 sections, at least 1 absolute-URL source, at most 2 posts per date, title at most 70 characters, excerpt at most 165.
- **Git:** stage explicit paths, never `git add -A`. `.agents/`, `_to_delete/` and `.investigation/` are scratch; never stage them. Do not force-push.
- **Project library:** the work explorer prioritizes business systems and workflow designs (healthcare denial appeals, role-based networking intelligence, Gemini opportunity research, benefits verification, prior authorization, critical lab alerts, protocol deviation review, finance ERP). The compact archive keeps GitHub links for AuraAI, Audioscript, the RunPod video editor and Azmuth. The work tabs and panels use paired ARIA attributes; keep them paired.
- **Visual direction:** cream background, dark pill navigation, blue primary accents, compact rounded UI, interactive Three.js tesseract background, screenshot-style operational surfaces.
- **Console noise:** errors mentioning `sw.js`, `mobx-state-tree`, `ContentService` or `host-network-events.js` come from browser extensions, not this site.

## 7. Open items

1. Tighten DMARC from `p=none` to `p=quarantine`, then `reject`, after reviewing reports.
2. Rotate `RESEND_API_KEY` and mark it secret in Netlify. It was exposed in a chat transcript.
3. Outreach/campaign system (scrape, campaign, auto-reply) is a separate project. Run cold outreach from a separate lookalike domain, never `logicfolds.com`.

## 8. Working style

Act as a senior engineer and design partner. Read code before large changes, follow existing patterns, make focused edits. For frontend changes, QA at desktop, tablet and mobile (including 320px) and keep the console clean. Keep the project deployable throughout.
