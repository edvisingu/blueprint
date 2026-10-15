# Explee (clone)

A self-contained clone of [explee.com](https://explee.com) — the AI B2B prospecting tool
that turns a plain-English description of your ideal customer into a verified lead list.

Open `explee/index.html` in any browser (or serve the folder). No build step, no dependencies.

## Features (matching explee.com)

| Explee feature | In this clone |
| --- | --- |
| Natural-language ICP search ("Fintech startups in the UK under 30 employees") | ✅ NL query parser extracts industry, location, company size, keywords |
| Semantic search over a company/profile database | ✅ Relevance scoring over the built-in prospect DB, with match % |
| Company + decision-maker discovery | ✅ Company profiles with contacts (name, title, seniority, email, LinkedIn) |
| Verified emails / deliverability | ✅ Verified/unverified badges per contact |
| Filters (industry, size, location, verified-only) + sorting | ✅ Live sidebar filters |
| Lookalike analysis | ✅ "Find lookalikes" ranks similar companies by industry + tags + size |
| Lead-list building | ✅ Save companies to a list (persisted in `localStorage`) |
| CSV export | ✅ Export search results or the full lead list (with contacts) |
| Personalized outreach / video messaging | ✅ AI-style personalized email draft generated from company + contact context |

## Architecture

- `index.html` — app shell (search view, lists view, company modal)
- `styles.css` — dark SaaS UI
- `app.js` — NL parsing, scoring/search, filters, lists, CSV export, message drafting
- `data.js` — built-in prospect database (stands in for Explee's private 75M-company index)

## Swapping in a real backend

`data.js` is the only data source. Replace `runSearch()` in `app.js` with a `fetch()` to a
real prospecting/enrichment API that returns the same company shape, and the entire UI —
filters, modal, lists, export — works unchanged.

> Note: the 75M-company / 536M-profile figures and email-validation vendors are Explee's real
> infrastructure and cannot be reproduced offline; this build ships a realistic sample dataset
> and a working search engine over it to demonstrate identical functionality end to end.
