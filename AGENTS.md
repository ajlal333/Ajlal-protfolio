# LogicFolds Site Agent Guide

This file gives future coding agents the working context for this project.

## Project Summary

LogicFolds is a business-facing AI solutions website. It presents the company as a practical AI automation studio for businesses, not as a job-seeking personal portfolio.

Core positioning:

- Company name: LogicFolds
- Audience: business owners, operators, and teams that want AI systems for real workflows
- Offer: workflow automation, data extraction systems, and AI-ready platforms
- Tone: business-first, practical, production-minded
- Primary call to action: book a strategy/project call

## Tech Stack

- Vite
- Vanilla JavaScript
- Three.js
- Plain CSS
- Netlify hosting
- Netlify Functions for the booking email endpoint
- Resend API for outbound email

There is no React, no framework router, and no backend server process in local Vite dev mode.

## Important Files

- `index.html`
  - Main page markup
  - Navigation, hero, services, work, process, FAQ, contact section, booking dialog
  - Favicon and metadata are declared in the head

- `src/main.js`
  - Three.js tesseract background
  - Interactive service/dashboard behavior
  - FAQ accordion behavior
  - Booking modal open/close behavior
  - Booking form submit logic
  - Posts booking requests to `/api/book-call`
  - Falls back to a prefilled `mailto:` link if the API endpoint is unavailable

- `src/styles.css`
  - Full site styling
  - Responsive layout
  - Booking modal and form styles
  - Favicon is not styled here; it lives in `public/favicon.svg`

- `netlify/functions/book-call.js`
  - Netlify Function used in production
  - Receives POST booking requests
  - Sends email through Resend using `fetch`
  - Does not require the `resend` npm package

- `netlify.toml`
  - Netlify build config
  - Build command: `npm run build`
  - Publish directory: `dist`
  - Functions directory: `netlify/functions`
  - Redirects `/api/book-call` to `/.netlify/functions/book-call`

- `api/book-call.js`
  - Vercel-compatible version of the booking function
  - Kept for possible future Vercel deployment
  - Not used by Netlify unless deployment target changes

- `public/favicon.svg`
  - LogicFolds browser tab icon

- `public/LogicFolds_Credentials.pdf`
  - Company-branded copy of the credentials/resume PDF linked from the site

- `public/Ajlal_Resume.pdf` and `public/Muhammad_Ajlal_Haider_Resume.pdf`
  - Older resume PDF assets
  - Do not remove unless the user confirms they are no longer needed

## Commands

Install dependencies:

```powershell
npm install
```

Run local dev server:

```powershell
npm run dev
```

Build production output:

```powershell
npm run build
```

Preview production build locally:

```powershell
npm run preview
```

## Local Development Notes

The Vite dev server does not run Netlify Functions. If the booking form is tested on `localhost` with `npm run dev`, `/api/book-call` will usually fail and the form will fall back to opening a prefilled email.

For local testing of the real Netlify Function, use the Netlify CLI:

```powershell
netlify dev
```

That command may require installing and logging into the Netlify CLI.

## Deployment

The live deployment target is Netlify.

Netlify should use:

- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`

The route `/api/book-call` is intentionally kept as the front-end endpoint. Netlify rewrites it to the function through `netlify.toml`.

## Required Environment Variables

Set these in Netlify site settings:

```env
RESEND_API_KEY=your_resend_api_key
BOOKING_TO_EMAIL=ajlalgoraya333@gmail.com
BOOKING_FROM_EMAIL=LogicFolds <onboarding@resend.dev>
```

Notes:

- `RESEND_API_KEY` is required for automatic email sending.
- `BOOKING_TO_EMAIL` defaults to `ajlalgoraya333@gmail.com` if omitted, but keep it explicit in Netlify.
- `BOOKING_FROM_EMAIL` can use `LogicFolds <onboarding@resend.dev>` while the domain is not verified in Resend.
- For a custom sender such as `LogicFolds <hello@logicfolds.com>`, verify the domain in Resend first.
- After changing environment variables, redeploy the Netlify site.

## Booking Form Behavior

Form submit flow:

1. User submits the booking form.
2. Front end posts JSON to `/api/book-call`.
3. Netlify redirects that path to `/.netlify/functions/book-call`.
4. The function validates required fields.
5. The function sends email through Resend.
6. If the function fails or is unavailable, the front end opens a prefilled `mailto:` link.

Required fields:

- name
- email
- company
- service
- callWindow
- message

There is also a hidden honeypot field named `companyFax`.

## Known Browser Console Noise

Errors mentioning `sw.js`, `mobx-state-tree`, `ContentService`, or `host-network-events.js` are likely from browser extensions or devtools instrumentation, not this site.

The important app-level error to watch for is:

```text
POST /api/book-call 404
```

On Netlify, that means `netlify.toml` or `netlify/functions/book-call.js` is missing from the deployed commit, or Netlify did not redeploy after the files were pushed.

## Branding Rules

Use `LogicFolds` for all public-facing site copy.

Avoid reintroducing:

- Ajlal AI
- Ajlal AI Solutions
- AH as the brand mark

The personal email `ajlalgoraya333@gmail.com` is still used as the default booking recipient.

## Visual Direction

The current design is inspired by widgetsflow.com:

- Cream background
- Dark pill navigation
- Blue primary accents
- Rounded but compact UI
- Business-focused sections
- Interactive Three.js tesseract background
- Card-based service and work sections

Do not turn the site into a personal resume page unless the user explicitly asks. Keep changes business-facing.

## Git Notes

There may be an unrelated untracked `.agents/` folder in the repo. Do not blindly stage it.

Prefer staging specific files, for example:

```powershell
git add index.html src/main.js src/styles.css netlify.toml netlify/functions/book-call.js public/favicon.svg AGENTS.md
```

Before committing, run:

```powershell
npm run build
```

