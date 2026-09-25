# PromptGenius: Research & Build Plan

Status: Phase 0 and Phase 1 (M1–M7) built, running locally. Next step: Phase 2 (accounts). Research date: 2026-09-23.
Pricing and limits change often. Check every number in §1.2 against the vendor page before it goes into the app's config.

---

## Part 1: Research summary

### 1.1 How all three platforms measure usage

| Concept | Claude (Anthropic) | ChatGPT (OpenAI) | Gemini (Google) |
|---|---|---|---|
| Unit of billing | Tokens (input, output) | Tokens (input, output) | Tokens (input, output) |
| Rough size of a token | ~3.5 chars of English text. Newer tokenizer (Opus 4.7 and later) uses ~1.0–1.35× more tokens than older models on the same text | ~4 chars / ~4 bytes of English text (`o200k_base` tokenizer family) | ~4 chars; 100 tokens ≈ 60–80 English words |
| Exact counting | `POST /v1/messages/count_tokens` (free, needs an API key, model-specific) | Tokenizer runs locally (tiktoken; JS ports exist). The docs don't say which encoding GPT-6 uses, so check this | `countTokens` API (free, needs an API key) |
| Can counting run in the browser? | **No.** No public tokenizer for current models. `tiktoken` undercounts Claude by ~15–20%, more on code or non-English text | **Yes** (with the encoding caveat above) | Not reliably. Use the API |
| Reasoning/"thinking" tokens | Billed as **output**; controlled by `effort` (low→max) | Billed as **output** (`reasoning_tokens`); `reasoning.effort` none→max; OpenAI suggests reserving ≥25k tokens for reasoning plus output | Billed as **output** (`thought tokens`); `thinking_level` low/medium/high, dynamic by default |
| Images / media | Counted as tokens; up to 600 images or PDF pages per request | Counted as tokens | 258 tokens per image up to 384 px, otherwise 258 per 768×768 tile; video ~100 tok/s; audio 32 tok/s |

**What this means for the app:** output tokens cost 5–6× more than input tokens on every platform, and thinking tokens are billed as output. A short prompt that triggers a long answer or heavy reasoning can cost more than a long prompt with a tightly constrained answer.

### 1.2 Current pricing (USD per 1M tokens, standard API tier)

**Claude**

| Model | Input | Output | Context |
|---|---|---|---|
| Fable 5.1 (most capable) | $10.00 | $50.00 | 1M |
| Opus 5.5 | $4.00 | $20.00 | 1M |
| Opus 5 | $5.00 | $25.00 | 1M |
| Sonnet 5 | $2.00 | $10.00 | 1M |
| Haiku 4.5 | $1.00 | $5.00 | 200K |

Max output is 128K on the 1M-context models. Cache reads cost ~0.1× input; cache writes cost 1.25× (5-min TTL) or 2× (1-hour TTL). Batch API is −50%.

**OpenAI**

| Model | Input | Output | Long-context (in / out) | Context |
|---|---|---|---|---|
| gpt-6-astra | $10.00 | $50.00 | $20 / $75 | 1.05M |
| gpt-6-sol | $2.00 | $10.00 | $4 / $15 | 1.05M |
| gpt-6-luna | $0.10 | $0.50 | $0.20 / $0.75 | 1.05M |
| gpt-5.5 | $5.00 | $30.00 | $10 / $45 | n/a |
| gpt-5-mini | $0.25 | $2.00 | n/a | n/a |

Max output is 128K on GPT-6. Cached input costs 0.1× and cache writes 1.25× (GPT-5.6 and later). I haven't found the long-context threshold on the pricing page yet, so check it.

**Gemini**

| Model | Input | Output | Context |
|---|---|---|---|
| Gemini 3.8 Flash | $0.75 (rises to $1.50 on 2027-01-01) | $3.75 (rises to $7.50) | 1,048,576 in / 65,536 out |
| Gemini 3.5 Flash | $1.50 | $9.00 | n/a |
| Gemini 3.5 Flash-Lite | $0.30 | $2.50 | n/a |
| Gemini 3.1 Pro Preview | $2.00 (≤200K) / $4.00 (>200K) | $12.00 / $18.00 | n/a |

Context caching costs ~10% of the input rate plus $0.50–$1.00 per 1M tokens per hour of storage. Batch is −50%.

**Consumer chat apps** (claude.ai, ChatGPT, Gemini app) don't charge per token. They use opaque, compute-based limits:
- **Claude.ai:** usage goes up with message length, conversation length, model, effort level, and enabled tools. Anthropic suggests starting new chats for long conversations and turning off unused tools.
- **Gemini app:** limits refresh every 5 hours, with a weekly cap. Context window is 32K on no plan, 128K on AI Plus, and 1M on AI Pro and Ultra.
- **ChatGPT Plus:** third-party sources (not confirmed by OpenAI) report ~160 flagship messages per 3 hours, a 54K context window for instant models, and 256K for reasoning models.

→ In consumer mode the app should show **relative cost** ("this prompt uses about as much as N typical messages") rather than dollars.

### 1.2b Attached files: how images and PDFs become tokens (added 2026-09-24)

Files count as input tokens like text, and they're resent on every later turn. Each vendor converts them differently:

| | Claude | OpenAI | Gemini 3 |
|---|---|---|---|
| Images | ⌈w/28⌉ × ⌈h/28⌉ patches. Claude 4.7 and later: downscaled to fit 2576 px and 4,784 tokens. Older models: 1568 px and 1,568 tokens | ⌈w/32⌉ × ⌈h/32⌉ patches × 1.2 (GPT-5.2 and later, GPT-6), up to 2,500 patches at `high` detail; `original` detail can use more | Flat **1,120** tokens per image at the default media resolution (280 low, 560 medium, 2,240 ultra-high) |
| PDFs | Extracted text (typically 1,500–3,000 tokens per page) **plus** an image of each page | Extracted text **plus** an image of each page | Flat **560** tokens per page at the default resolution; native text isn't billed separately |
| Limits | 32 MB per request; 600 pages (100 under a 1M window); 20 images per claude.ai message; 8000 px max; over 20 images per request → 2000 px max per image | 512 MB per request, 1,500 images; 50 MB of files per request | 50 MB or 1,000 pages per PDF |

- Worked examples from Anthropic's docs, all reproduced by a unit test: 1000×1000 → 1,296 tokens, 1920×1080 → 2,691 (high-res) or 1,560 (standard), and 3840×2160 → 4,784 (high-res).
- **Not published:** the size Anthropic and OpenAI render PDF pages at. The app assumes a US Letter page at 96 DPI (816×1056). That comes to about 1,140 image tokens per page on Claude, and about 1,030 on OpenAI. As a sanity check, Anthropic's Bedrock notes put a 3-page PDF with visual understanding at ~7,000 tokens (~2,300 per page, text included).
- **Chat apps** may search large files (retrieval) instead of putting all of them in context, so Simple mode notes that actual usage can be lower for very large files.
- Word (.docx) files are converted to text, which is what the chat apps do too.
- Vendor guidance on files: put documents and images **before** the question, say what each file is (Anthropic: label them "Image 1:", "Image 2:"), and for long documents ask for relevant quotes first. The **Lost in the Middle** and **Context Rot** findings apply to attached files just as they do to pasted text.

### 1.3 How context adds up across a session

All three vendors work the same way: **every turn resends the entire history.**

- Turn *k* input = system prompt + tool definitions + all previous user and assistant messages + the new message.
- For a system prompt of size **S** and an average exchange of **u + a** tokens per turn, the total input tokens billed over **N** turns is:

  `Total_in ≈ N·S + (u+a)·N(N−1)/2 + N·u`

  That grows **quadratically**. A 30-turn chat costs much more than 30× a single message.
- **Thinking tokens:** newer Claude models (Opus 4.5 and later, Sonnet 4.6 and later) keep previous thinking blocks in context, so they are billed again as input on later turns. Older models and Haiku strip them. Reasoning tokens on OpenAI and Gemini also take up context space during generation.
- **Tool/function definitions and attachments** count as input on every turn.
- **Context rot:** accuracy and recall drop as context grows. The drop is non-uniform and worse when distractors are present (Chroma, 2025, 18 models tested). Models use information at the **start and end** of the context best and the middle worst ("Lost in the Middle", Liu et al., 2023).
- **Overflow:** Claude returns a 400 error if the input exceeds the window. Chat apps silently drop or summarize older turns.

### 1.4 Caching: the biggest cost lever

| | Claude | OpenAI | Gemini |
|---|---|---|---|
| How it works | Explicit `cache_control` breakpoints (up to 4) or auto mode; exact **prefix** match | Automatic plus explicit breakpoints; prefix match | Implicit by default (2.5 and later); explicit caches optional |
| Min. cacheable prefix | 512 (Opus 5 / Fable) · 1024 (Sonnet 5) · 4096 (Haiku 4.5) tokens | 1,024 tokens (GPT-5.6 and later) | 4,096 tokens (3.x models) |
| Read discount | ~90% off | ~90% off | ~90% off |
| TTL | 5 min (default) or 1 h | ≥30 min | configurable (explicit) |

**Rule shared by all three:** put stable content first (instructions, reference docs, examples) and variable content last (the user's question, timestamps, IDs). Any change early in the prompt invalidates the cache for everything after it.

### 1.5 Prompt-engineering best practices (vendor guidance)

**All three vendors agree on:**
1. **Be clear, specific and direct.** State the task, the audience and what counts as success. Anthropic's test: would a colleague with no context understand it?
2. **Give context and motivation.** Explaining *why* helps the model generalize ("this will be read aloud, so avoid ellipses").
3. **Specify the output:** format (JSON, table, bullets), length, and constraints.
4. **Use examples (few-shot).** Claude: 3–5 diverse examples in `<example>` tags. Gemini: "prompts without examples are likely to be less effective", 2–3 consistently formatted examples. OpenAI: diverse input/output pairs.
5. **Use delimiters and structure.** XML tags or Markdown sections to separate instructions, context, examples and input.
6. **In long prompts, put data first and the question last.** Anthropic reports up to 30% better quality on complex multi-document input. Gemini 3 says the same.
7. **Break complex tasks into steps or chained prompts.**

**Platform-specific:**
- **Claude:** XML tags work especially well. Say what *to do* rather than what not to do. **Avoid aggressive emphasis** ("CRITICAL: you MUST…"); recent models over-trigger on it. Match the style of the prompt to the style of output you want. Recent models are proactive, so drop the old "be thorough" padding. Opus 5 is verbose by default, so ask for concision explicitly.
- **OpenAI:** use the instruction hierarchy (developer message for rules, user message for inputs). The prompt layout is Identity → Instructions → Examples → Context. **Reasoning models:** give high-level goals ("senior co-worker"). **Non-reasoning GPT models:** give explicit, precise steps ("junior co-worker"). Put reusable content first for caching.
- **Gemini 3:** be precise and direct and avoid persuasive filler. Use consistent delimiters. **Leave temperature at the default.** Supply all context first and the question at the very end. Ask explicitly for detail if you want it (Gemini is terse by default).

### 1.5b Beyond the three vendors: Microsoft, Google Vertex AI, DAIR.AI and research (added 2026-09-24)

The first pass leaned on vendor docs, and the scoring rules ended up citing mostly Anthropic. This pass adds independent guidance and peer-reviewed research. The rules now cite 2–4 sources each (see §2.5).

**Specificity and context: every source agrees**
- **OpenAI**, *Best practices for prompt engineering with the OpenAI API*: "Be specific, descriptive and as detailed as possible about the desired context, outcome, length, format, style."
- **Google Vertex AI**, *Introduction to prompting*: names the components of a prompt as **objective, instructions, system instructions, persona, context, constraints, tone, format, examples**. This is the checklist the context rules now use.
- **Microsoft**, *Prompt engineering techniques (Azure OpenAI)*: "Be specific. Leave as little to interpretation as possible. Restrict the operational space." It also recommends supplying **grounding content** (primary and supporting content).
- **DAIR.AI**, *Prompt Engineering Guide*: "The more descriptive and detailed the prompt is, the better the results"; avoid impreciseness ("Use 2–3 sentences to explain… to a high school student" beats "keep it short").
- **Google whitepaper** (Boonstra, 2024): contextual and role prompting, specifying output formats, and code prompts that name language and constraints.

**New, non-Anthropic findings that became rules**
| Finding | Source | Rule |
|---|---|---|
| Contradictory or vague instructions are "particularly damaging" for GPT-5-class models; the model burns reasoning tokens reconciling them | OpenAI GPT-5 prompting guide | `clarity.contradiction` |
| Give the model an "out" ("respond 'not found' if the answer isn't present") to reduce fabricated answers | Microsoft | `output.no-fallback` |
| Consecutive whitespace is tokenized separately and wastes space | Microsoft | `economy.whitespace` |
| Chain-of-thought / step-by-step prompting is for **non-reasoning** models only | Microsoft; OpenAI reasoning guide | `openai.reasoning-micromanaged` |
| Name the audience in the prompt | Bsharat et al. 2023 (principle 2); Google Vertex (tone) | `context.no-audience` |
| Few-shot examples substantially improve task performance | Brown et al. 2020 (GPT-3); Google; Microsoft | `examples.missing` |
| Formatting choices alone can swing accuracy by up to 76 points | Sclar et al. 2024 | `structure.no-delimiters` |

**Research consulted**
- Brown et al. 2020, *Language Models are Few-Shot Learners*: few-shot in-context learning.
- Wei et al. 2022, *Chain-of-Thought Prompting*: intermediate reasoning steps improve complex reasoning (on non-reasoning models).
- Liu et al. 2023, *Lost in the Middle*; Chroma 2025, *Context Rot*: long-context degradation.
- Jiang et al. 2023, *LLMLingua*: up to 20× compression with little loss, showing typical prompts are redundant.
- Bsharat et al. 2023, *Principled Instructions Are All You Need*: 26 principles, tested on LLaMA-1/2 and GPT-3.5/4.
- Yin et al. 2024, *Should We Respect LLMs?*: impolite prompts hurt; overly polite ones don't help.
- Sclar et al. 2024: sensitivity to formatting.
- Schulhoff et al. 2024, *The Prompt Report*: a 58-technique taxonomy, used as a vocabulary check.

### 1.5c Where sources disagree, and which way the app goes

| Topic | Disagreement | App's position |
|---|---|---|
| **"You MUST", ALL CAPS, tipping, "you will be penalized"** | Bsharat et al. 2023 (tested on GPT-3.5/4 and LLaMA) recommends them. Anthropic says current Claude models over-trigger on aggressive language. Google says to drop persuasive language for Gemini 3. | Follow the current vendor docs: flag emphasis (mildly in general, strongly on Claude). The paper predates today's models. |
| **Politeness** | Bsharat: "no need to be polite". Yin et al. 2024: rudeness hurts, over-politeness doesn't help. | Filler is a small **token-economy** cost. The suggestion says to be neutral, never curt. |
| **Where to put the instruction** | Microsoft and DAIR.AI: instructions first. Anthropic and Google (long context): question last. Microsoft also notes recency bias and suggests repeating the instruction at the end. | Short prompts: no rule. Long prompts (500+ tokens): question at the end. Repeating one key instruction isn't penalized as duplication. |
| **Chain of thought** | Classic research (Wei 2022) says it helps. Microsoft and OpenAI say not to use it on reasoning models. | Flag "think step by step" only when a reasoning model or effort is selected. |
| **Temperature** | Microsoft: lower for factual tasks, higher for creative ones. Google (Gemini 3): keep the default. | Only the Gemini rule mentions it. |

### 1.6 What makes a prompt costly or inefficient

| Driver | Why it costs | Fix |
|---|---|---|
| Unbounded output ("explain everything about…") | Output costs 5–6× input | State length/format limits |
| Triggering heavy reasoning on simple tasks | Thinking billed as output | Lower effort; simpler model |
| Filler/politeness/redundancy | Wasted input tokens every turn (quadratic in chat) | Remove; say it once |
| Repeating context each turn instead of caching | Re-billed at full price | Stable prefix + caching |
| Long, unrelated context | Cost **and** lower accuracy (context rot) | Include only high-signal tokens |
| Vague task → retries | Each retry costs the full prompt again | Clear task + format up front |
| Very long chats | Quadratic growth | Start a fresh chat with a summary |

Anthropic's principle for this: "the smallest possible set of high-signal tokens that maximize the likelihood of the desired outcome."

**Efficiency ≠ shortness.** Vendor guidance says adding context, examples and format specs *improves* results. The score has to reward **signal density** and penalize waste. It should never reward brevity for its own sake. Research compressors like LLMLingua (Jiang et al., 2023) reach up to 20× compression with little quality loss, which shows how much redundancy typical prompts carry.

---

## Part 2: The evaluation algorithm

### 2.1 Inputs
- `platform`: Claude | ChatGPT | Gemini
- `model`: e.g. Sonnet 5, gpt-6-sol, Gemini 3.8 Flash (defaults to each platform's mid-tier model)
- `useCase`: Coding · Writing · Analysis/Research · Data extraction · Brainstorming · Q&A/Chat · Summarization
- `historyTokens` (both modes): how much of the conversation is already used. Presets run from *New chat* to *Very long chat (~150 exchanges)* at ~700 tokens per exchange, or a custom amount.
- `mode`: **Simple** (chat-app users: relative usage, top suggestions) | **Advanced** (API users: dollars, full breakdown, session modeling). See §3.2.
- `promptText` (optional: system prompt, other resent content in tokens, expected number of turns)
- `attachments` (both modes): files the user attaches. They're read **in the browser**, never uploaded, and summarized once: text-token estimate, pages, image size, and word stems used for relevance checks.

### 2.2 Token estimation (two tiers)
1. **Instant (every keystroke, debounced about 150 ms):** a local estimate.
   - OpenAI: exact local tokenizer (JS tiktoken port).
   - Claude: `ceil(chars / 3.5) × modelMultiplier` (1.0 for older models, about 1.2 for Opus 4.7 and later).
   - Gemini: `ceil(chars / 4)`.
   - Adjust for code and non-English text (dense symbols and CJK text raise tokens per character). Label the number "≈".
2. **Exact (after about 800 ms idle):** a backend call to Claude `count_tokens` or Gemini `countTokens` using server-side keys, cached by hash of the text. The label changes to "exact".

### 2.3 Output and thinking estimate
- **Explicit limits in the prompt override everything.** "in 3 bullets", "under 200 words" → words × 1.33, "one sentence", "JSON with fields…".
- **Otherwise use a base value per use case** (a table, tuned later), e.g. Q&A ≈ 300, Writing ≈ 800, Coding ≈ 1,200, Analysis ≈ 1,500 tokens, with a low–high range.
- **Thinking multiplier** by effort level and use case, e.g. low 0.3×, medium 1×, high 2.5× of visible output. Show it as a range, never a single number.

### 2.4 Cost, context, and session projection

**Conversation so far:** input for this message = system + attachments + **history** + prompt. History counts toward cost, usage limits (Simple mode's "typical messages"), and the context window. When it is at least the model's cache minimum, a second price shows the history read from the prompt cache. The session chart starts from the existing history. Warnings: *context rot* above ~32k resent tokens; *near full* / *overflow* against the window.

```
cost_per_call = in_uncached·P_in + in_cached·P_cache_read + in_cache_write·P_cache_write
              + (out_visible + out_thinking)·P_out
context_used% = (system + history + prompt + expected_output) / model_context_window
session(N)    = Σ_{k=1..N} cost_per_call(input = S + prompt + (k−1)·(u+a))
turns_until_full = (window − S − prompt) / (u + a)
```
- Show a small chart of cumulative cost and context over 1 to N turns, with and without caching. Caching only applies once the prefix is at least the model's minimum cacheable length.
- In **chat-app mode**, express the numbers relative to a "typical message" (about 500 in / 700 out) and against the plan's context window from §1.2.

### 2.5 The Prompt Score (0–100)

The score is a deterministic, explainable, rule-based engine. **Every point lost maps to a specific suggestion.**

| # | Dimension | Pts | What it checks (examples of signals) |
|---|---|---|---|
| 1 | **Task clarity** | 20 | An explicit task or imperative verb is present · a clear deliverable · few vague words ("something", "stuff", "good", "etc.") · no unresolved pronouns · one primary ask or clearly listed asks |
| 2 | **Context & intent** | 15 | Audience/purpose stated · reasons given ("because", "so that") · relevant background present |
| 3 | **Output specification** | 15 | Format named · length/scope bound · constraints and success criteria |
| 4 | **Structure** | 10 | Delimiters or sections when the prompt is over about 150 tokens · data before question in long prompts · examples separated from instructions |
| 5 | **Examples** | 10 | Few-shot examples present **when the use case needs them** (extraction, formatting, style). Not required for simple Q&A (auto-full marks) |
| 6 | **Token economy** | 20 | Filler/politeness ratio · duplicate sentences or n-grams · redundant restatements · signal density (content words ÷ total) · unbounded output requests · size versus task complexity |
| 7 | **Platform fit** | 10 | Platform-specific rules (below) |

**Platform-fit rules (dimension 7, and they adjust the weights of 1–6):**
- *Claude:* XML-style tags when mixing instructions with data (+) · aggressive ALL-CAPS "MUST/CRITICAL" (−) · mostly negative "don't" instructions without a positive alternative (−) · "why" provided (+).
- *ChatGPT:* role/instructions separated from input (+). If a reasoning model is selected, step-by-step micromanagement is penalized ("give goals, not steps"). If a non-reasoning model is selected, precise explicit steps are rewarded.
- *Gemini:* few-shot weight raised (Examples becomes 15 pts, taken from Structure) · question-at-end rule applies to all long prompts · persuasive filler penalized · advice to leave temperature at default.

**Use-case weighting:** each use case has a weight profile. For example, Data extraction raises Output spec and Examples, Brainstorming lowers Output spec, and Coding raises Context (language, versions, constraints).

**Score bands:** 90–100 Excellent · 75–89 Good · 50–74 Needs work · <50 Weak.

**Suggestions panel:** a list sorted by points recoverable, e.g. "+8: specify output format (e.g. 'return a Markdown table with columns…')", each linked to the source guideline.

**Guardrails against gaming:**
- A token-economy penalty only applies when the waste is *detected* (filler, duplication). A long prompt full of useful context isn't penalized.
- A very short prompt loses points on clarity, context and output spec. It doesn't win on economy.

**Revision (2026-09-24).** Changes to fix weak detection of missing context (e.g. "write an essay" scored 40):
- `clarity.no-subject`: the prompt names a deliverable ("essay", "poem", "code") but no topic. Topic words are instruction words minus stopwords, task verbs, deliverable nouns and empty modifiers.
- `context.no-details`: no names, numbers, quotes or pasted material when producing something.
- Requests to *produce* content ("write/create/generate…") get writing-level context checks even under the Q&A use case.
- New rules from non-Anthropic sources: `clarity.contradiction`, `output.no-fallback`, `economy.whitespace` (see §1.5b).
- **Substance gate** is now a curve: `factor = 0.05 + 0.95·(1 − (1 − substance)^1.6)`. It is ~0.3 for an empty core and ~0.9 for a mostly complete one.
- **Follow-ups:** with conversation history and a short message (under 25 words), topic, context, format and length checks are softened to 45%, because earlier messages usually settle them. Missing-referent and missing-material checks are skipped.
- Every finding lists its sources by publisher. The substance-gate finding is listed last, since fixing the concrete items recovers it.
- Result: "write an essay" scores 24 (writing) or 29 (Q&A); "…about climate change" 52; a fully specified essay prompt 92; "make it shorter" scores 8 in a new chat and 60 in an ongoing one.

**Attachments (2026-09-24, §2.5c).**
- **Tokens:** per-vendor image and PDF rules from §1.2b, stored in `models.json` under `media`, which a model can override (e.g. Haiku 4.5 uses the lower image resolution).
- **Cost:** files count as input for this message and are resent on later turns. They are **not** counted as cached on the message that attaches them, because the prefix cache can only hold what an earlier turn already sent.
- **Core rule:** a file adds context **only if the prompt uses it**. "Uses" means the prompt refers to it ("the attached brief", its file name, "this screenshot"), or there's exactly one file and the prompt names no other topic ("Summarize this").
  - When a relevant file is used, `clarity.no-subject`, `clarity.missing-referent`, `context.no-details` and `context.missing-material` are satisfied.
  - `context.no-purpose`, `context.no-audience` and `context.coding-stack` are softened to 50%, since a brief or spec may cover them but the prompt should still say what matters.
  - `clarity.too-short` is halved, as it already is next to pasted material.
- **New rules:**
  - `context.unreferenced-file`: a file is attached but the prompt never mentions it.
  - `context.file-mismatch`: none of the prompt's topic words appear in the file's text. Such a file also loses the context credit above.
  - `structure.which-file`: several files, but the prompt doesn't say which one is for what.
  - `structure.long-file-quotes`: 20k+ tokens of files for Q&A, analysis or extraction without asking for quotes first.
  - `economy.large-files`: 30k+ file tokens, penalized less for summaries and extraction.
  - `economy.large-images`: an image costs 2,500+ tokens.
  - `claude.many-images`: more than 20 images with any over 2000 px.
- Result:
  - "Write the essay described in the attached assignment brief." scores 37 without the brief and 75 with it.
  - "write an essay" with unmentioned files stays under 50.
  - 8 file cases were added to the calibration set; 58 prompts now, still **96%**, Spearman 0.93.
- Also fixed: "brief" as a noun ("the assignment brief") was being read as "be brief" by both the length rule and the answer-length estimate.

**Revision: reviews and file roles (2026-09-24, from user testing).**
- **The report:** "Review my resume and tell me what to improve" scored 79 with a résumé attached and still 75 after removing it. An unrelated photo earned the same credit as the résumé.
- **Review requests** ("review/critique/proofread/improve/fix **my resume / this essay / the code**") are recognized in every use case:
  - Under Q&A they're weighted like analysis, because a review isn't a quick question.
  - They need a **goal**: `context.no-purpose` at 55%, which now recognizes "for an … role/job/application/class".
  - They need a **yardstick**: the new `output.no-review-focus` (role, criteria, what to focus on).
  - They need an **audience**, which now recognizes recruiters, ATS, admissions, "for our finance team".
- **Missing material:**
  - "my resume" is now a recognized reference. `clarity.missing-referent` is at 60% for reviews.
  - `context.missing-material` now applies to reviews in any use case, not just summaries and extraction.
  - Tagged material (`<code>`, `<document>`) counts as pasted material.
- **File roles:**
  - Only a **brief, spec, rubric or job description** (by file name, or by what the prompt calls it) softens the purpose, audience and stack checks.
  - **Material** (a résumé, an essay, a report) doesn't: it doesn't say what job you're applying for.
  - An attached source file satisfies the "no language or stack" check.
- **Images:**
  - An image earns context credit only when the prompt points at it ("this screenshot", its file name), because the app can't read images.
  - New `context.document-as-image`: the prompt names a document but only an image is attached.
- **Other new checks:**
  - `clarity.unfinished`: the prompt ends on "and", "or", "with"…
  - The wrong file (`context.file-mismatch`) now costs 70% of the context score.
  - Length detection counts "the 5 highest-impact changes".
- **Result:**

  | Prompt | Before | After |
  |---|---|---|
  | "Review my resume and tell me what to improve" + résumé | 79 | 45 |
  | Same, without the résumé | 75 | 9 |
  | "review my resume and" | 74 | 20 |
  | The fully specified review prompt | 64–84 | 86–97 |

- **Calibration:** 5 résumé-review prompts were added (63 total): **94%** in band, Spearman 0.93.

### 2.6 Optional AI rewrite (paid, strictly opt-in)
- **One explicit button: "✨ Rewrite with AI (paid)".** Nothing else in the app calls a paid API. Scoring, estimation and suggestions all run locally or through free counting endpoints.
- The rewrite is done by **Claude** (Anthropic API) and targets the **selected platform**. It rewrites the prompt using that platform's guidance from §1.5, so a Gemini prompt gets Gemini-style fixes.
- Claude receives the prompt, the platform, the use case, the list of failed rules from the local scorer, and the **names and types** of attached files, so it can refer to them. **File contents are never sent**, and the UI says so. It returns structured JSON: the rewritten prompt plus a short list of what changed and why.
- **The rewrite is re-scored by the same free local engine**, so the before and after scores are directly comparable (no second paid call).
- The app shows a side-by-side diff, the token difference, and the per-call cost difference on the target platform.
- Payment disclosure rules are in §3.6.

### 2.7 Calibration
- Build a labeled set of 50–100 prompts (weak/ok/strong for each use case and platform) and tune the rule weights until the rule score correlates with human rankings.
- Later, if v2 exists, compare the rule score with the LLM-judge score to find rules that fire wrongly.

---

## Part 3: App build plan (no code yet)

### 3.1 Decisions (confirmed 2026-09-23)
| # | Decision |
|---|---|
| 1 | Both audiences, with a **Simple / Advanced** toggle |
| 2 | API keys held **server-side** for exact token counting |
| 3 | **AI rewrite included** as a strictly optional button (Claude API); every paid action is labeled |
| 4 | **Vite + React + TypeScript**, hosted on **AWS**, secure, modular and scalable |
| 5 | **Local-first.** Runs on your machine until hosting is needed; no domain yet |
| 6 | **Rewrite spend cap: $2/day** |
| 7 | **A free account is required for rewrites once the site is public**, built in **Phase 2**. Phase 1 is strictly the product |

### 3.2 Simple vs Advanced mode
| | Simple (default) | Advanced |
|---|---|---|
| Inputs | Platform, use case, prompt | Also: specific model, effort/reasoning level, system prompt, attachment size, number of turns, caching on/off |
| Tokens | "≈ 420 tokens" | Exact count, input/output/thinking split, estimate vs exact |
| Cost | "About 2 typical messages", context bar | $ per call, $ over N turns, cached vs uncached, long-context surcharges |
| Score | Dial plus top 3 suggestions | Dial, 7-dimension breakdown, every rule hit with its source link |
| Charts | None | Cumulative cost and context over N turns |

Both modes share the same engine. Simple mode just hides detail. The chosen mode is remembered in `localStorage`.

### 3.3 Architecture

#### Local development (Phase 1)
```
 Browser ──▶ Vite dev server (localhost:5173, React SPA)
                 │  proxies /api/*
                 ▼
            Local API server (localhost:8787, Node + Hono)
                 │  runs the SAME handlers that later deploy to Lambda
                 ├─▶ count-tokens ──▶ Anthropic / Gemini count APIs (free)
                 └─▶ rewrite ───────▶ Anthropic Messages API (PAID, $2/day cap)
            Secrets: .env.local (gitignored) · Spend counter: local JSON file
```
- **One command** (`pnpm dev`) starts both servers. The browser only talks to `localhost`, so it never sees the API keys.
- **Hono** is the API framework because the same app runs on Node locally and on AWS Lambda (including response streaming). Moving to AWS is a deployment change, not a rewrite.
- **Anything that differs between environments sits behind an interface,** and the implementation is picked by environment:

  | Interface | Local implementation | AWS implementation |
  |---|---|---|
  | `SecretsProvider` | `.env.local` | Secrets Manager |
  | `SpendStore` (daily $ cap) | JSON file | DynamoDB atomic counter |
  | `RateLimiter` | in-memory | AWS WAF (+ DynamoDB per-user in Phase 2) |
  | `AuthProvider` | none (Phase 1: local, single user) | Cognito (Phase 2) |

- **`.env.local` and `.env*.local` get added to `.gitignore` in M1**, before any key exists on disk. `.env.example` lists the variable names with no values.

#### AWS hosting (Phase 3, when you're ready to go public)

```
                         ┌──────────────────────── AWS ─────────────────────────┐
 Browser ──HTTPS──▶ Route 53 ──▶ CloudFront (+ AWS WAF, security headers, ACM TLS)
 (React SPA)                        │                       │
                                    │ /*  (static)          │ /api/*
                                    ▼                       ▼
                           S3 bucket (private,     API Gateway HTTP API ──▶ Lambda: count-tokens ──▶ Anthropic / Gemini count APIs (free)
                           Origin Access Control)          │
                                                           └─▶ Lambda: rewrite (streaming) ──▶ Anthropic Messages API (PAID)
                                                                   │            │
                                                     DynamoDB (daily spend    Secrets Manager
                                                     counter, rate state)     (API keys)
                                          CloudWatch (metrics, alarms) · AWS Budgets (billing alarm)
```

- **Frontend:** a static Vite build in a **private S3 bucket**, served only through **CloudFront** with Origin Access Control. No servers to patch, and it scales automatically.
- **API:** serverless **Lambda (Node 24, TypeScript)** behind **API Gateway HTTP API**, exposed on the same domain at `/api/*` through CloudFront. Same origin means no CORS surface. Lambda scales per request and costs almost nothing at low traffic.
- **Rewrite streaming:** API Gateway cuts off requests at about 30 seconds, and a Claude rewrite with thinking can run longer. So `/api/rewrite` uses a **Lambda Function URL with response streaming** behind CloudFront (Origin Access Control, IAM auth), and the UI shows the rewrite as it streams. Gotcha: POST requests through CloudFront Origin Access Control to a Lambda URL need the client to send an `x-amz-content-sha256` payload hash. I'll build that into the API client.
- **Secrets:** Anthropic and Gemini keys live in **AWS Secrets Manager**, read at Lambda cold start and cached in memory. They never go into the repo, the frontend bundle, or environment files.
- **Infrastructure as code:** **AWS CDK in TypeScript**. The whole stack is reproducible, with separate `dev` and `prod` stages.
- **CI/CD:** **GitHub Actions** using **OIDC** to assume an AWS deploy role, so there are no long-lived AWS keys in GitHub. The pipeline runs lint → typecheck → tests → build → `cdk deploy`. Prod deploys need manual approval.

### 3.4 Repository layout (monorepo, pnpm workspaces)

```
promptgenius/
├─ apps/
│  └─ web/                 # Vite + React + TS SPA (UI only)
├─ packages/
│  ├─ core/                # PURE TS, no UI/no network. Shared by web + lambdas
│  │  ├─ platforms/        #   one adapter per platform (claude/, openai/, gemini/)
│  │  ├─ estimation/       #   token heuristics, output/thinking estimator
│  │  ├─ cost/             #   cost + context + session projection formulas
│  │  ├─ scoring/          #   rule engine + rules/ (one file per rule) + weight profiles
│  │  └─ config/models.json#   prices, windows, cache minimums, lastVerified dates
│  └─ api-contract/        # zod schemas + types for every /api request/response
├─ services/
│  └─ api/                 # Lambda handlers: count-tokens, rewrite (thin, call core)
├─ infra/                  # AWS CDK app (stacks: web, api, security, monitoring)
└─ .github/workflows/      # CI + deploy
```

**How it stays modular:**
- **Platform adapter interface.** Adding a platform means writing one adapter. No UI changes needed:
  ```ts
  interface PlatformAdapter {
    id: 'claude' | 'openai' | 'gemini';
    models: ModelSpec[];                       // from models.json
    estimateTokens(text: string, model: ModelSpec): number;   // instant, local
    exactCount?: 'local' | 'server';           // openai=local, others=server
    platformRules: Rule[];                     // §2.5 dimension 7
  }
  ```
- **Rule engine as a plugin registry.** Each rule is `{ id, dimension, appliesTo, evaluate(ctx) → { pointsLost, suggestion, sourceUrl } }`, so a rule can be added, reweighted or disabled without touching the others. Each rule has its own unit tests.
- **`core` is framework-free.** The same scoring code runs in the browser (instant) and in Lambda (to validate a rewrite), so the two can never disagree.
- **Pricing is config, not code.** It ships in `models.json` at first. It can later move to a versioned JSON file in S3 so prices can be updated without a redeploy.
- **The API contract is shared.** Frontend and Lambdas import the same zod schemas, so a mismatch fails at compile time.

### 3.5 Security
| Area | Measure |
|---|---|
| Transport | HTTPS only (ACM certificate, HSTS), TLS 1.2 or higher at CloudFront |
| Headers | CloudFront response-headers policy: strict **CSP** (`default-src 'self'`, no inline scripts), `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors 'none'` |
| Origin | S3 private, reachable only through CloudFront Origin Access Control; API reachable only through CloudFront |
| Secrets | Secrets Manager plus a least-privilege IAM role per Lambda; each function can read only its own secret |
| Input validation | zod on every request; prompt size cap (e.g. 100k chars for counting, 20k for rewrite); reject unknown fields |
| Abuse / cost protection | **Accounts required for rewrite** (Phase 2, Cognito) · **per-user rewrite quota** · **AWS WAF**: managed common-rule set, IP reputation list, rate-based rules (tighter on `/api/rewrite`), **CAPTCHA on sign-up** · **$2/day global spend cap** (`SpendStore`) (atomic counter; rewrites switch off with a clear message when the cap is reached) · **Anthropic Console workspace spend limit** as a hard backstop · **AWS Budgets** alarm |
| Privacy | **Prompts are never stored or logged.** Logs record metadata only (route, latency, token counts, cost). This is stated in the UI |
| Attached files | Read **only in the browser** (pdf.js for PDFs with fonts and XFA forms disabled, mammoth for .docx, `createImageBitmap` for images), never uploaded or persisted. Limits: 10 files, 25 MB each (10 MB for .docx, a zip archive), 1,000 PDF pages, 2M characters of text; binary files with text extensions are rejected. The PDF reader runs in a same-origin worker, so the Phase 3 CSP needs `worker-src 'self'`. The rewrite receives file **names** only, escaped as data |
| Prompt injection | The user's prompt is passed to Claude as clearly delimited *data* to be rewritten, never as instructions; the output is validated against a JSON schema and rendered as plain text, never as HTML |
| Dependencies | Lockfile, Dependabot, `pnpm audit` in CI, CodeQL scanning |
| Deploy | GitHub OIDC (no static AWS keys); prod behind manual approval |

### 3.6 Paid-feature disclosure rules (strict)
1. **Only one paid action exists:** "✨ Rewrite with AI". Everything else is free, and the UI can label it that way ("Exact count: free").
2. **The button always shows the estimated price** before clicking, e.g. `Rewrite with AI · Paid · ≈ $0.08`. The estimate uses the prompt's actual token count and the rewrite model's price from `models.json`.
3. **The first click in a session opens a confirmation dialog:** "This sends your prompt to the Claude API and costs about $X per rewrite, billed to the site's Anthropic account. Continue?"
4. **After the rewrite, the actual cost is shown**, calculated from the API's `usage` data (input, output and cache tokens × price).
5. **No automatic or background paid calls:** no auto-rewrite on typing, no retries without a click, no prefetching.
6. **If the $2 daily cap is reached**, the button is disabled and says why ("Daily rewrite budget reached, resets at midnight UTC"). It never fails silently.
7. **Cap enforcement is reserve-then-settle.** Before calling Claude, the server reserves the *maximum* possible cost of the call (input tokens + `max_tokens` × output price). If that would go over $2, the call is refused. After the response, the reservation is replaced with the actual cost from `usage`. Concurrent clicks therefore can't overshoot the cap.
8. **Phase 2 onward:** the button reads "Sign in to use AI rewrite (paid)" for signed-out users.

**Rewrite model:** defaults to **Claude Opus 5** (`claude-opus-5`, $5 / $25 per 1M tokens). The rewrite system prompt and rubric are stable and cached, so each call mostly pays for the user's prompt and the rewritten output. The expected cost is **roughly $0.05–$0.15 per rewrite**, to be confirmed by measuring in M7. At that cost, $2/day covers roughly **13–40 rewrites per day**. The model is one config value, so switching to a cheaper model (Sonnet 5 at $2 / $10, Haiku 4.5 at $1 / $5) is your call and a one-line change.

### 3.7 Roadmap

**Phase 0: Setup (blank canvas). ✅ Done.**
pnpm monorepo (`apps/web`, `packages/core`, `packages/api-contract`, `services/api`, `infra/`); Vite 8 + React 19 + TypeScript 6.0 (pinned below 6.1 because typescript-eslint doesn't support TS 7 yet); Hono API on `127.0.0.1:8787` with security headers, body limit and JSON errors, proxied by Vite at `/api`; env loading validated by zod from `.env.local`; ESLint (type-aware), Prettier, Vitest projects (jsdom for web); GitHub Actions CI (checks + build + gitleaks secret scan); Dependabot. `pnpm check` runs everything CI runs.

**Phase 1: The product (local only).**  ✅ Built (see *Phase 1 notes* below). Everything runs on `localhost`.
| # | Milestone | Deliverable |
|---|---|---|
| M0 | Research and plan | ✅ this document |
| M1 | Core data model | `models.json` (prices, windows, cache minimums, `lastVerified`) with a zod schema, `PlatformAdapter` and `Rule` interfaces, use-case definitions |
| M2 | Estimation and UI shell | Selectors, prompt box, Simple/Advanced toggle, instant local token estimates, OpenAI exact local count |
| M3 | Cost and context engine | Output/thinking estimator, cost formula, context %, session chart (Advanced) |
| M4 | Scoring engine v1 | Rule registry, 7 dimensions, platform and use-case weights, suggestions, unit tests |
| M5 | Local API: exact counts | Hono server, count-tokens handler for Claude and Gemini, `.env.local` secrets, zod contract, fallback to the estimate if unavailable |
| M6 | Calibration | Labeled prompt set, weight tuning |
| M7 | AI rewrite (paid, local) | Streaming rewrite handler, disclosure UI (§3.6), $2/day cap with reserve-then-settle, cost measured from real calls |

#### Phase 1 notes: what was built and where it differs from the plan

- **Token estimate (§2.2).** `chars ÷ N` was 25–40% off, so the instant estimate is a word/punctuation model fitted against o200k_base (worst case about ±10% on English, Markdown, code, JSON, Spanish, French and CJK; enforced by a test). Per-vendor multipliers convert it: OpenAI 1.0, Gemini 1.0 (unverified), Claude 1.1, or 1.2 for the tokenizer introduced with Opus 4.7 (unverified). Exact counts replace it as soon as they arrive.
- **Score (§2.5).** Implemented as planned (7 dimensions, platform/use-case weights normalized to 100, every lost point mapped to a suggestion with a source link), plus a **substance gate**: structure, examples, economy and platform fit are scaled from 30% to 100% by how complete the core (clarity, context, output) is, so a near-empty prompt can't score well just for being short. The withheld points appear as their own finding.
- **Calibration (M6).** 50 hand-labeled prompts across all use cases and platforms, including topic-less deliverables and chat follow-ups (`packages/core/src/scoring/calibration`): **96% in the labeled band, Spearman 0.93, means weak 24 / OK 62 / strong 98** (after the 2026-09-24 revision). A test fails CI below 90% / 0.85. Caveat: the rules were tuned on this same set, so these numbers are optimistic. Add a held-out set (ideally prompts written by someone else) before trusting them.
- **Rewrite (M7).** Claude Opus 5 at `medium` effort (both configurable in `.env.local`), streamed as SSE, structured JSON output validated with zod, stable cached system prompt, `fallbacks: "default"` for safety declines. The $2/day cap uses reserve-then-settle. Because the reservation is the worst case (full `max_tokens`), the last ~$0.20–0.45 of the daily budget can't start a new rewrite.
- **Not yet measured:** the real cost per rewrite. No API key was configured while building, so the paid path is covered by tests with a fake Claude client. Run a few rewrites and check the "This rewrite cost" line against the $0.05–0.15 estimate in §3.6.

**Attached files (added after Phase 1, 2026-09-24).** ✅ Built. Users can attach PDF, Word, image, text and code files. Everything is read in the browser, and each file's tokens are estimated per vendor (§1.2b). Files count toward cost, context and the session chart, and the score takes them into account (§2.5).

**Entry flow (added 2026-09-24).** ✅ Built.
- **Order:** a short loading screen, then the **Terms of use** with name, email and an "I agree" box, then a **10-step tutorial** that spotlights each part of the app. The tutorial has Next/Back at the bottom and "Skip tutorial" at the top, and can be replayed from the footer.
- **Layout:** the app now spans the full page width.
- **Where the agreement is kept:** only in this browser (`localStorage`: name, email, terms version, time). It isn't sent to the server. The footer shows who agreed and a "Withdraw and delete my details" link.
- **Terms changes:** changing `TERMS_VERSION` asks everyone to agree again.
- **Before going public:**
  - Have a lawyer review the terms text in `TermsText.tsx`. It's a plain-language draft that matches what the app does.
  - In Phase 2, move the agreement record to the account (Cognito, with email verification) if you need a server-side record.

**Phase 2: Identity and accounts.**
| # | Milestone | Deliverable |
|---|---|---|
| M8 | Accounts | Amazon Cognito user pool (email sign-up and verification, password reset), sign-in UI, JWT verified on every rewrite request. Counting and scoring stay free and **don't need an account** |
| M9 | Per-user limits | Per-user daily rewrite quota (on top of the global $2 cap), a "your usage" view, account deletion. Only metadata is stored, never prompts |

Cognito works from a local setup, so Phase 2 can be built and tested before anything is hosted.

**Phase 3: Hosting on AWS.**
| # | Milestone | Deliverable |
|---|---|---|
| M10 | Infrastructure | CDK stacks: S3 + CloudFront + WAF + security headers, API Gateway + Lambda (count), Lambda Function URL (streaming rewrite), Secrets Manager, DynamoDB, OIDC deploy, dev stage on the CloudFront URL |
| M11 | Production | Domain (when you buy one), prod stage, alarms, AWS Budgets, Anthropic workspace spend limit, accessibility and mobile pass, "compare all platforms" view |

**Hard rule: the rewrite feature is never exposed publicly before Phase 2 (accounts) is done.** If you want to host earlier, deploy with rewrite switched off by a feature flag.

### 3.8 Risks
- **Prices and models change monthly.** Keep them in config, show the verified date, and re-check them on a schedule.
- **Paid rewrite abuse on a public site.** Mitigated by the hard rule in §3.7 plus required accounts, per-user quotas, WAF rate limits, the $2/day cap and the Anthropic spend limit.
- **Local secrets.** Keys in `.env.local` could leak through a commit. Mitigated by the `.gitignore` in M1, `.env.example` with no values, and secret scanning in CI.
- **Claude and Gemini counts depend on the backend.** If the API is down, the UI falls back to the estimate (about ±15%) and labels it as an estimate.
- **Consumer-plan limits are opaque.** Simple mode shows relative estimates and says so.
- **The score is a heuristic.** Present it as guidance, calibrate it (M6), and link every rule to its source.

### 3.9 Before M1 starts
- **API keys:** create an Anthropic API key and a Gemini API key (both needed for exact counting in M5). Put them only in `.env.local` when we get there. Set a **spend limit in the Anthropic Console** as a backstop to the in-app $2 cap.
- **Tooling:** Node 24 (installed) and pnpm: run `sudo corepack enable pnpm` once.
- No open product decisions remain. The next step is M1.

---

## Sources
- Anthropic: [Prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) · [Context windows](https://platform.claude.com/docs/en/build-with-claude/context-windows) · [Token counting](https://platform.claude.com/docs/en/build-with-claude/token-counting) · [Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) · [Pricing](https://platform.claude.com/docs/en/about-claude/pricing) · [Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) · [Claude.ai usage limits](https://support.claude.com/en/articles/11647753-understanding-usage-and-length-limits)
- OpenAI: [Pricing](https://developers.openai.com/api/docs/pricing) · [Models](https://developers.openai.com/api/docs/models) · [Prompt engineering](https://developers.openai.com/api/docs/guides/prompt-engineering) · [Prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching) · [Reasoning](https://developers.openai.com/api/docs/guides/reasoning) · [tiktoken](https://github.com/openai/tiktoken)
- Google: [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing) · [Token counting](https://ai.google.dev/gemini-api/docs/tokens) · [Prompting strategies](https://ai.google.dev/gemini-api/docs/prompting-strategies) · [Caching](https://ai.google.dev/gemini-api/docs/caching) · [Thinking](https://ai.google.dev/gemini-api/docs/thinking) · [Gemini 3.8 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash) · [Gemini app limits](https://support.google.com/gemini/answer/16275805)
- Microsoft: [Prompt engineering techniques (Azure OpenAI)](https://learn.microsoft.com/en-us/azure/foundry/openai/concepts/prompt-engineering)
- Google (more): [Vertex AI: introduction to prompting](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/prompts/introduction-prompt-design) · [Prompt Engineering whitepaper (Boonstra, 2024)](https://www.kaggle.com/whitepaper-prompt-engineering)
- OpenAI (more): [Best practices for prompt engineering](https://help.openai.com/en/articles/6654000-best-practices-for-prompt-engineering-with-the-openai-api) (quoted via search; the page blocks automated fetching) · [GPT-5 prompting guide](https://developers.openai.com/cookbook/examples/gpt-5/gpt-5_prompting_guide)
- Files: Anthropic [Vision](https://platform.claude.com/docs/en/build-with-claude/vision) · [PDF support](https://platform.claude.com/docs/en/build-with-claude/pdf-support) · OpenAI [Images and vision](https://developers.openai.com/api/docs/guides/images-vision) · [File inputs](https://developers.openai.com/api/docs/guides/pdf-files) · Google [Document understanding](https://ai.google.dev/gemini-api/docs/document-processing) · [Media resolution](https://ai.google.dev/gemini-api/docs/media-resolution) · [Token counting](https://ai.google.dev/gemini-api/docs/tokens)
- Community: [DAIR.AI Prompt Engineering Guide: general tips](https://www.promptingguide.ai/introduction/tips)
- Research (more): Brown et al., 2020, [Few-Shot Learners](https://arxiv.org/abs/2005.14165) · Wei et al., 2022, [Chain-of-Thought](https://arxiv.org/abs/2201.11903) · Bsharat et al., 2023, [26 Principled Instructions](https://arxiv.org/abs/2312.16171) · Yin et al., 2024, [Politeness](https://arxiv.org/abs/2402.14531) · Sclar et al., 2024, [Formatting sensitivity](https://arxiv.org/abs/2310.11324) · Schulhoff et al., 2024, [The Prompt Report](https://arxiv.org/abs/2406.06608)
- Research: Liu et al., 2023, [Lost in the Middle](https://arxiv.org/abs/2307.03172) · Jiang et al., 2023, [LLMLingua](https://arxiv.org/abs/2310.05736) · Chroma, 2025, [Context Rot](https://www.trychroma.com/research/context-rot)
- ChatGPT plan limits (third-party, not confirmed by OpenAI): [OpenAI Help Center article](https://help.openai.com/en/articles/11909943-gpt-53-and-54-in-chatgpt) (blocked from fetching) · [tokn.watch](https://tokn.watch/blog/chatgpt-usage-limits/)
