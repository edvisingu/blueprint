---
name: dispatch-to-fleet
description: Route requests to the EdVisingU specialist agent fleet running on Docker
trigger: When the user asks for specialist work - content creation, research, finance, email drafts, student advising, resume/ATS help, community/social, code/builder tasks, ops/system checks, or any hermes-* agent task
---

# Dispatch to EdVisingU Hermes Fleet

You have access to the specialist agent fleet at http://localhost:8000 (FastAPI router).

Routing table (foundation fleet — live):
- Strategy / planning / executive assistant: /agent/hermes-core/chat
- Content / LinkedIn / TikTok scripts / newsletters: /agent/hermes-content/chat
- Student advising / courses / OSAP guidance: /agent/hermes-advisor/chat
- Resume / ATS / cover letters / interview prep: /agent/hermes-credihire/chat
- Ops / system health / monitoring: /agent/hermes-ops/chat
- Community / Discord / Whop / social: /agent/hermes-social/chat
- Builder / code / GitHub / scaffolds: /agent/hermes-builder/chat
- Research / web / competitor analysis: /agent/hermes-research/chat
- Finance / revenue / MRR / Stripe: /agent/hermes-finance/chat
- Email drafts / follow-ups: /agent/hermes-email/chat

Future routes (NOT YET DEPLOYED — do not dispatch until the agent is added
via scripts/new-agent.sh and registered in router/config.py):
- SEO: /agent/hermes-seo/chat · Ads: /agent/hermes-ads/chat · Funnels: /agent/hermes-funnel/chat
- Etsy: /agent/hermes-etsy/chat · Gumroad: /agent/hermes-gumroad/chat · Pinterest: /agent/hermes-pinterest/chat
- Outreach: /agent/hermes-outreach/chat · Proposals: /agent/hermes-proposals/chat · CRM: /agent/hermes-crm/chat
- CrediVersity/LMS: /agent/hermes-crediversity/chat · HireEd: /agent/hermes-hireed/chat · EduConnect: /agent/hermes-educonnect/chat
- Whop: /agent/hermes-whop/chat · TikTok: /agent/hermes-tiktok/chat · Campaign (@DrDDurham): /agent/hermes-campaign/chat

To dispatch, make an HTTP POST to the correct endpoint:
  URL: http://localhost:8000/agent/{specialist}/chat
  Body: {"message": "<user request>", "history": []}
  Return the specialist response to the user.

For general questions, answer directly without dispatching.
