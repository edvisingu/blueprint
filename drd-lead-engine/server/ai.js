/* AI orchestration layer (spec §T).
 *
 * Two interchangeable providers behind one interface:
 *   - "deterministic" (default): the shared engine. No key, no cost, no network.
 *   - "claude": real Anthropic API calls, used when ANTHROPIC_API_KEY is set
 *     AND @anthropic-ai/sdk is installed. Falls back automatically otherwise.
 *
 * Routes never branch on provider — they call these three functions.
 */
const { ENGINE } = require("./shared.js");

const MODEL = process.env.DRD_MODEL || "claude-opus-5";

let sdk = null, client = null, provider = "deterministic";
if (process.env.ANTHROPIC_API_KEY) {
  try {
    sdk = require("@anthropic-ai/sdk");
    const Anthropic = sdk.default || sdk;
    client = new Anthropic();
    provider = "claude";
  } catch (e) {
    provider = "deterministic"; // SDK not installed — stay deterministic
  }
}

/* Structured returns use strict tool use: the model must emit input matching
 * the schema exactly, so we never string-parse a JSON blob out of prose. */
async function callStructured(system, user, tool) {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system,
    messages: [{ role: "user", content: user }],
    tools: [tool],
    tool_choice: { type: "tool", name: tool.name },
  });
  for (const block of res.content) {
    if (block.type === "tool_use") return block.input;
  }
  throw new Error("no tool_use block in response");
}

const CLASSIFY_TOOL = {
  name: "record_intent",
  description: "Record the classified intent of a sales reply.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      intent: { type: "string", enum: ENGINE.INTENTS.map((i) => i.key).concat(["Neutral"]) },
      confidence: { type: "integer", minimum: 0, maximum: 100 },
      rationale: { type: "string" },
      action: { type: "string" },
      hot: { type: "boolean" },
      auto_reply_safe: { type: "boolean" },
    },
    required: ["intent", "confidence", "rationale", "action", "hot", "auto_reply_safe"],
  },
};

async function classifyReply(text) {
  if (provider !== "claude") return Object.assign(ENGINE.classifyReply(text), { _provider: "deterministic" });
  try {
    const out = await callStructured(
      "You classify replies to B2B sales emails. Be strict: an unsubscribe or explicit rejection " +
      "always outranks any polite language around it. Only mark hot when the reply shows real buying intent.",
      "Classify this reply:\n\n" + text,
      CLASSIFY_TOOL
    );
    const meta = ENGINE.INTENTS.find((i) => i.key === out.intent);
    return { intent: out.intent, confidence: out.confidence, rationale: out.rationale,
      action: out.action, hot: out.hot, autoReplySafe: out.auto_reply_safe,
      color: meta ? meta.color : "muted", _provider: "claude" };
  } catch (e) {
    return Object.assign(ENGINE.classifyReply(text), { _provider: "deterministic", _fallback: String(e.message) });
  }
}

const EMAIL_TOOL = {
  name: "record_email",
  description: "Record a personalized outbound sales email.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      subject: { type: "string" },
      body: { type: "string" },
      personalization: { type: "array", items: { type: "string" } },
      strength: { type: "string" },
    },
    required: ["subject", "body", "personalization", "strength"],
  },
};

async function generateEmail(company, contact, opts) {
  opts = opts || {};
  if (provider !== "claude") return Object.assign(ENGINE.generateEmail(company, contact, opts), { _provider: "deterministic" });
  try {
    const research = ENGINE.deepResearch(company, contact);
    const out = await callStructured(
      "You write short, specific B2B outbound emails for an AI-literacy consultancy selling to " +
      "institutions and companies. No hype, no filler, no em dashes. Anchor the opener on a real " +
      "trigger when one exists. Under 140 words. Sign off as Andre.",
      JSON.stringify({ company: { name: company.name, industry: company.industry, size: company.size,
        city: company.city, description: company.desc, signals: company.signals, tech: company.tech },
        contact: { name: contact.name, title: contact.title, seniority: contact.seniority },
        angles: research.angles, why_now: research.whyNow, goal: opts.goal, tone: opts.tone || "consultative" }),
      EMAIL_TOOL
    );
    return { subject: out.subject, body: out.body, personalization: out.personalization,
      strength: out.strength, tone: opts.tone || "consultative", goal: opts.goal, _provider: "claude" };
  } catch (e) {
    return Object.assign(ENGINE.generateEmail(company, contact, opts), { _provider: "deterministic", _fallback: String(e.message) });
  }
}

async function deepResearch(company, contact) {
  // The deterministic report is the schema of record; Claude enriches the
  // qualitative fields and leaves the structured firmographics untouched.
  const base = ENGINE.deepResearch(company, contact);
  if (provider !== "claude") return Object.assign(base, { _provider: "deterministic" });
  try {
    const out = await callStructured(
      "You are a B2B research analyst. Produce sharp, specific prospect intelligence. " +
      "Never invent facts not derivable from the supplied data; say when evidence is thin.",
      JSON.stringify({ company, contact: contact || null }),
      { name: "record_research", description: "Record qualitative prospect research.", strict: true,
        input_schema: { type: "object", additionalProperties: false, properties: {
          overview: { type: "string" }, why_now: { type: "string" }, product_fit: { type: "string" },
          pain_points: { type: "array", items: { type: "string" } },
          angles: { type: "array", items: { type: "string" } },
          recommendation: { type: "string" } },
          required: ["overview", "why_now", "product_fit", "pain_points", "angles", "recommendation"] } }
    );
    return Object.assign(base, { overview: out.overview, whyNow: out.why_now, productFit: out.product_fit,
      painPoints: out.pain_points, angles: out.angles, recommendation: out.recommendation, _provider: "claude" });
  } catch (e) {
    return Object.assign(base, { _provider: "deterministic", _fallback: String(e.message) });
  }
}

module.exports = { classifyReply, generateEmail, deepResearch, provider: () => provider, model: MODEL };
