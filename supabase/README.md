# Blog storage setup

Posts live in Supabase and are rendered per request by Netlify Functions. Publishing
a post is a database insert — no commit, no deploy.

## Why it works this way

Netlify's free plan is 300 credits a month and **a production deploy costs 15 of
them**. Two posts a day meant roughly 60 deploys, 900 credits, and the site being
paused with a "Site not available" page around day 10 of every month. Serving posts
from a database removes deploys from the publishing path entirely.

The articles are still server-rendered, not fetched in the browser, so Google,
LinkedIn, Slack and X get complete HTML with Open Graph tags and JSON-LD exactly as
they did when pages were prerendered at build time.

## One-time setup

**1. Create the project.** [supabase.com](https://supabase.com) → New project. The free
tier gives 500 MB of database and 5 GB of egress, which is far more than a text blog
will ever use.

**2. Create the table.** Dashboard → SQL Editor → New query. Paste `schema.sql` and run
it. It is idempotent, so re-running is safe.

**3. Collect the keys.** Project Settings → API:

| Value | Where it goes | Notes |
|---|---|---|
| Project URL | `SUPABASE_URL`, `VITE_SUPABASE_URL` | |
| `anon` public key | `SUPABASE_ANON_KEY`, `VITE_SUPABASE_ANON_KEY` | Safe in the browser — row level security limits it to published posts |
| `service_role` key | `SUPABASE_SERVICE_ROLE_KEY` | **Bypasses row level security. Never commit it, never ship it to the browser.** Publishing only. |

**4. Set them in Netlify.** Site configuration → Environment variables. Add all five.
The `VITE_`-prefixed pair is baked into the browser bundle at build time, so changing
them needs a rebuild; the unprefixed pair is read by the functions at request time.

**5. Seed the table** from the posts already in the repo:

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run posts:push
```

Add `--dry-run` first if you want to see what it would write. It upserts on `slug`, so
running it twice changes nothing.

**6. Deploy once** so the functions and their generated shell ship.

## Writing posts

Use the Supabase table editor (Dashboard → Table Editor → `posts`). Rows start as
`status = 'draft'` and stay invisible; flip to `published` when ready. A row dated in
the future also stays hidden until that date, so you can queue posts ahead.

`takeaways`, `sections` and `sources` are JSON columns. `sections` looks like:

```json
[
  {
    "heading": "Section heading",
    "paragraphs": ["First paragraph.", "Second paragraph."],
    "bullets": ["Optional bullet"]
  }
]
```

The table enforces the same rules as `npm run validate:blog` — title ≤ 70 characters,
excerpt ≤ 165, at least two takeaways, three sections and one source, and alt text
whenever an image is set. A malformed row is rejected by Postgres rather than reaching
the site.

## How freshness works

There is no purge step. Cache lifetimes are tuned so it isn't needed:

| Path | CDN cache | Effect |
|---|---|---|
| `/blog/posts/<slug>/` | 1 hour, 1 week stale-while-revalidate | A new article has no cache entry, so it is live the moment it is published |
| `/blog/` | 5 minutes, 1 day stale-while-revalidate | A new post joins the listing within five minutes |
| `/sitemap.xml` | 1 hour | |

Readers are always served from the CDN, so the functions themselves run rarely and
compute cost stays near zero.

## If Supabase is unavailable

Free Supabase projects **pause after a week with no activity**. Site traffic and the
publishing job both count as activity, so in practice it stays awake — but if it ever
does pause, or has an outage, the functions fall back to the snapshot of
`content/blog-posts.json` that was bundled at build time and drop their cache lifetime
to 60 seconds so stale content cannot get pinned. The blog serves slightly old posts
instead of failing.

Keep that snapshot from drifting too far:

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run posts:pull
npm run validate:blog
```

That rewrites `content/blog-posts.json` from the live table. Commit it occasionally —
it is the only time blog content touches git, and it is a deliberate snapshot rather
than a per-post commit.
