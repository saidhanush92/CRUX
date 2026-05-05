# Crux — Product Note

## The one-line pitch

> **Crux is software development with the receipts.**
> Bring whatever you have — an idea, a brief, a ticket, an RFC. AI does the work. The harness catches the mistakes. Every decision, traceable forever.

---

## Why Crux exists

Imagine a restaurant where every cook just starts cooking the moment they hear a customer's order — no clarifying questions, no recipe, no inspection, no record of who put what on the plate. Some dishes come out great. Some come out wrong. When a customer gets sick, nobody can tell you why.

That's how most teams build software today, especially with AI coding tools. The tools are fast, but they:

1. **Build the wrong thing.** They guess at the gaps in your brief and quietly fill them with assumptions.
2. **Hide their work.** When something ships broken, no one can trace why a decision was made.
3. **Skip the boring parts.** Tests, reviews, architecture docs — first to go under deadline pressure.

The result: software that "works" but doesn't solve the real problem, with no paper trail when it goes wrong.

**Crux turns the AI coding kitchen into a professional kitchen.** Every order is interrogated, every recipe is documented, every plate is tasted, every inspection is signed, and the kitchen *learns from every complaint forever*.

---

## What Crux is

A platform that walks every software idea through 8 disciplined checkpoints, with AI doing the work and humans approving the decisions that matter. Built to **force the SDLC process** — not as bureaucracy, but as the only reliable way to keep an audit trail intact while moving fast. **Runtime-neutral by design** — works across Claude Code, Cursor, Aider, and other AI coding backends through a clean adapter interface, so your audit trail isn't tied to one vendor.

Think of it as a strict but helpful head chef + a flight data recorder + a wise old advisor who never forgets a lesson.

---

## How it works — the 8 checkpoints

You bring whatever you have: a one-sentence idea, a Jira ticket, a concept note, or a 10-page RFC. Crux accepts all of it. Then it walks the work through 8 gates — **and you cannot skip a gate.**

| # | Gate | What happens (in plain English) | Who approves |
|---|---|---|---|
| **1** | **Starting point** | You hand in whatever you've got. Crux reads it and figures out what's missing. | — |
| **2** | **Grill & PRD** | An AI interrogator asks sharp questions until your idea is unambiguous, then writes a real product spec. | You ✋ |
| **3** | **Modules** | The spec is broken into bounded pieces — like dividing a restaurant into stations: grill, sauté, pastry, pass. | You ✋ |
| **4** | **Architecture** | AI proposes the technical decisions, with alternatives and tradeoffs documented. Like a head chef writing the recipe: not just "season with salt" but "salt at this stage, this amount, because." | You ✋ |
| **4.5** | **Design** *(fires only for UI-heavy work)* | Wireframes → hi-fi → component inventory → design tokens. The visual intent gets captured precisely enough that future code can be checked against it. | Designer ✋ |
| **5** | **Harness** | AI engineers the kitchen itself: the tests, linters, hooks, and quality gates that will keep the rest of the project clean. **Harness engineering as a deliberate step, not an afterthought.** | Auto |
| **6** | **Plan** | AI builds an ordered task list with dependencies — the ticket sequence in kitchen language. | You ✋ |
| **7** | **Build** | AI writes tests first, then code, then reviews itself in a different agent identity. Each task arrives as a clean PR with a trace block at the top. | You ✋ at PR |
| **8** | **Release** | Stakeholder testing, sign-off, deploy. Like a health inspection before opening to the public. | You ✋ |

Each checkpoint produces a **versioned, auditable artifact** — a document that can be replayed, queried, and pointed back to.

---

## Where design and frontend live

Design isn't a phase you bolt on at the end — it's a discipline that runs through every gate. The mistake most AI tools make is treating design as a Figma-to-code translation step. Crux treats it as a parallel grill, with its own artifacts, signoffs, and audit trail.

| Gate | Design dimension | Artifacts produced |
|---|---|---|
| **2 — Grill & PRD** | Visual direction, tone, brand anchors, references the team approves and rejects | **Design Brief** (sibling to PRD) |
| **3 — Modules** | Which modules have UI, which are headless | Surface tags per module |
| **4 — Architecture** | Design system, component primitives, accessibility commitments, motion philosophy | **Design ADRs**, a11y commitment artifact |
| **4.5 — Design** | Wireframes → hi-fi → component inventory | **Design Tokens spec** (color, typography, spacing, motion as code), responsive matrix |
| **5 — Harness** | Tokens compiled to CSS variables, Storybook installed, visual regression baselines, axe-core, lint rules blocking hardcoded colors/spacing | Live design system, automated a11y + visual checks |
| **7 — Build** | A **design-reviewer agent** runs alongside the code-reviewer on every UI PR — checks token usage, all declared states (hover/focus/disabled), responsive behavior, a11y rules, motion respecting `prefers-reduced-motion` | Per-PR design conformance verdict |
| **7.5 — UAT** | Designer + Brand Lead walk staging, file CHGs for taste-level issues | Design QA artifact |
| **8 — Release** | Final visual sign-off, brand check | Visual changelog (what UI changed) |
| **Loop 9** | Heatmaps, session replay, support tickets tagged "UX confusion," NPS comments mentioning design | Design CHG events feed back to gate 2 or 4 |

**Two artifacts matter most:**

- The **Design Brief** captures the visual direction precisely enough that an agent can later check work against it. *"Editorial-premium, photography-forward, restrained motion"* is something the design-reviewer can hold a PR up to. *"Make it look nice"* isn't.

- The **Design Tokens spec** is the contract from design to code. Every color, spacing value, and motion duration becomes a versioned token. When the Designer changes the hover-transition duration, every component using that token updates automatically — and the trace graph captures the decision.

**One critical separation:** the design-reviewer agent checks *conformance* (did the code follow the spec?). It cannot judge *taste* (does this feel right?). Visual judgment stays with humans. Crux structures the designer's work — it doesn't replace it.

**The deeper insight:** traditional design hands off to engineering and loses fidelity. Crux makes design and engineering share one pipeline, with shared artifacts — design intent survives the handoff because it's the same artifact engineering implements against.

---

## The orchestrators — three roles, no more

Crux itself is just three things:

- **Planner** — the head chef. Designs menus, breaks orders into station tickets, decides recipes.
- **Dispatcher** — the maître d'. Routes the right ticket to the right station with the right tools, never letting two cooks crash into each other.
- **Monitor** — the silent restaurant inspector. Watches everything, never cooks, never decides — just flags issues and surfaces them to humans.

Everything else is an AI agent or a skill that the dispatcher calls into. **The platform is the conductor; the AI agents are the instruments; harness engineering is the stage.**

---

## The continuous feedback loop — Loop 9

Once a feature ships, Crux doesn't stop watching.

**Loop 9** is an always-on side channel that listens to:
- Production telemetry (is the feature meeting its declared health metrics?)
- User feedback (support tickets, NPS, app store reviews)
- Operational incidents (something broke at 3am)
- Experiment results (A/B test outcomes)

When real-world signal contradicts an earlier assumption, Loop 9 generates a **Change Event** that re-enters the pipeline at the right gate. It doesn't bypass the gates; it **re-opens them surgically.**

Analogy: a customer leaves a review — *"the soup was salty."* Loop 9 doesn't yell at the cook. It traces the recipe, finds where the salt decision was made, and proposes amending the recipe (with the head chef's approval). The next time anyone makes that soup, it's better.

---

## Brownfield onboarding — Gate 0

Most projects already have code, opinions, and bad habits. Crux doesn't demand you throw it out and start over. Gate 0 attaches Crux to an existing repo:

- **Repo scan** — detects your stack, conventions, and anti-patterns
- **ADR archaeology** — reverse-engineers the decisions implicit in your code into formal documents
- **Gap report** — tells you honestly: no CI, no ADRs, 32% test coverage, etc.
- **Mode pick** — Strict (everything goes through gates from now on), Progressive (only new modules), or Observation-only (Crux watches but doesn't gate)

The gap report alone is sellable. Some teams will adopt Crux just for the audit, without ever reaching gate 7.

---

## The trace graph — the audit product

Here's the thing competitors don't have: **every line of code in a Crux project traces back to the question that produced it.**

```
Production code
  ← linked to → PR
  ← linked to → Task
  ← linked to → Module
  ← linked to → Architecture Decision (ADR)
  ← linked to → Requirement (REQ)
  ← linked to → Grill question (the original interrogation)
  ← linked to → Original input (your ticket, brief, RFC)
```

Six months later, anyone — engineer, PM, regulator, new hire — can ask *"why did we build it this way?"* and follow the chain to a real answer.

Same chain runs forward: a production incident links to the requirement it violated, the architecture decision it broke, the test that didn't catch it, and the reviewer prompt that missed it. **You can replay the full belief history of the project.**

That's the actual product. Not the AI coding. The receipts.

---

## The learning system — what makes Crux compounding

Most SDLC tools forget. A team learns a hard lesson after an incident, writes it in a wiki, and three engineers later the lesson is gone. New person makes the same bug.

Crux refuses to forget. Every incident triggers an automatic cascade:

1. **A regression test** is added to the permanent suite
2. **A reviewer-prompt amendment** is written, so future code reviews check this exact thing
3. **An ADR clause** captures the failure mode for future architecture decisions
4. **A pattern miner** watches for recurring root causes across all incidents

Year 1: Crux teams ship at roughly the same quality as traditional teams, plus a paperwork tax.
Year 2: Crux teams ship measurably fewer *recurring* bug classes.
Year 3: Crux teams carry a codified body of engineering wisdom that survives 100% team turnover.

> **The pitch isn't "fewer bugs today." It's "no bug ever ships twice in this organization for the same reason."**

Like a restaurant whose recipe book gets stricter and smarter every time a customer complains. The cooks change. The kitchen gets wiser.

---

## Waterfall or agile? (The honest answer)

**Per feature: linear and gated** (looks waterfall).
**Per portfolio: many features in flight** (looks agile).
**Per release: modules ship as ready** (looks continuous).
**Over time: Loop 9 reshapes priorities** (looks lean).

The real label: **disciplined per-feature flow with continuous feedback.**

Pure agile — "figure it out as we sprint" — is exactly the failure mode Crux exists to prevent. Pure waterfall locks scope for 6 months, which is also a failure mode. Crux is the dial in between, with **HITL gate count** as the tightness knob: regulated industries keep all 8, mature trusted teams compress to 2–3.

---

## Two real examples

### Example 1 — patient data export at a healthtech SaaS

A small healthtech company gets a Jira ticket: *"Add data export — PDF for patients, CSV for providers maybe?"* Four lines.

**Gate 2 (Grill & PRD).** Surfaces 11 unknowns the ticket didn't mention: pediatric/proxy access? MFA before export? Retention of generated files? Audit logging? The PM is mildly annoyed at the friction — until they realize the questions would have shown up as bugs in week 3.

**Gate 4 (Architecture).** Self-grill catches a hidden risk: the existing PDF library is in a "legacy zone" of the codebase. ADR documents the decision to copy the pattern rather than touch legacy. Future engineers will know why.

**Gate 7 (Build).** A reviewer rejects a coder's PDF template twice for putting too much PHI on the cover page. Third attempt passes. PM sees the rejection in the PR digest and files a v1.1 cosmetic ticket — captured, not lost.

**Day 17 in production.** An export accidentally contains another patient's data. Postmortem traces the root cause to a queue worker race condition. Reviewer prompt didn't include "verify context propagation through async boundaries." **The amendment is written into the reviewer skill, permanently.** The next time anyone writes queue code, the agent checks for this exact bug class.

The audit told the full story. The system got smarter. The bug class will not return.

### Example 2 — product detail page redesign at a DTC brand

A small e-commerce brand needs a new PDP before Black Friday. Conversion has flatlined. Brand wants "editorial-premium, not Shopify-default." 10 weeks. One designer, five engineers.

**Gate 2 (Grill & PRD + Design Brief).** Two parallel grills run by different agents. The PRD grill asks about conversion targets, performance budgets, scope of variants. The *Design Brief* grill asks Designer + Brand Lead: *"Editorial as in Aesop or as in NYT — they're different. Photography-forward or typography-forward? Subtle motion or expressive?"* The Designer notes afterward: "first time anyone made me articulate 'editorial-premium' precisely enough that an AI could later check it."

**Gate 4.5 (Design).** Designer spends ~5 days on wireframes → hi-fi → component inventory. AI runs conformance checks during exploration: contrast ratios fail on a focus ring at smallest size; Designer adjusts. Output: a tokens spec where every color, spacing, and motion duration is named and versioned.

**Gate 7 (Build).** Designer reviews a PR for the variant pill. Says: *"the hover transition is too snappy for our brand — bump from 120ms to 180ms."* Files a CHG. Token updated. **Three other components automatically get the new value because they reference the token.** Design system payoff visible in real time.

**Gate 7 (later).** A coder ships a gallery using framer-motion for swipe — violates ADR-D-005 (CSS for micro-interactions). Code-reviewer catches it via ADR-conformance check. Coder rewrites with native scroll-snap. **The audit captures this: an architecture decision survived implementation pressure.**

**Loop 9 (week 3 post-launch).** LCP drifts from 1.6s to 2.1s. Investigation: marketing added a third-party script via Shopify GTM. Hook caught the next deploy attempt. ADR amended: third-party script governance now requires PR review. Future drift won't go silent.

**Result:** new PDP converts +9.4% on mobile, +3.1% on desktop. External a11y audit found 2 small issues vs the 10–20 typical for unaudited launches. Design intent survived from brief to production — and is queryable forever.

### Example 3 — greenfield SaaS at a 3-person founding team

A founder + one engineer + a contract designer set out to build **Looplog** — an async retrospective tool — in 6 weeks. Crux runs in **Compressed Mode**: only 3 HITL gates instead of 5+, on the assumption that a 3-person team trusts itself.

**Gate 0 (Greenfield variant).** No repo to scan. Crux instead surfaces three viable reference architectures (Next.js + Supabase, Remix + Postgres + Fly, Astro + Cloudflare) with tradeoffs. Founder + engineer pick in 30 minutes — vs the 1–2 weeks small teams typically lose to stack debates.

**Gate 5 (Harness).** 15 minutes. Vitest, Playwright, Storybook, Chromatic, axe-core, token-lint hook, GitHub Actions deploys all installed and verified. The engineer's comment: *"This would have been a Tuesday I lost setting up. Now it's done."*

**Gate 7 (Build), Week 1.** The reviewer agent flags an RLS gap on the engineer's first PR — a room owner could read other rooms via a join. The engineer hadn't noticed. **On a 3-person team, every PR is one person's code reviewed by zero people. The reviewer agent caught a security bug that would have shipped.** This single moment justifies Crux's cost for the entire project.

**Gate 7, Week 3.** A Linear-integration task spikes to $14 in agent cost (multi-cycle review escalated to Opus). Crux flags it in the daily digest. Founder notes for retrospective and sets a per-task budget cap.

**Loop 9, Week 1 post-launch.** 10 paid signups. Three users in the first week ask: *"Is this anonymous?"* — confirming that ADR-004's deferred decision is the right v1.1 priority. Founder prioritizes anonymous mode based on data, not vibe. The audit trail tells her which question/decision led to each user pain point.

**Result:** MVP shipped in 6 weeks. ~$355 total agent cost. Reviewer agent caught 4 real bugs (1 RLS, 1 race condition, 1 keyboard nav, 1 missing empty state). The audit trail is worth ~0 today and ~lots in 18 months when the team grows. Pitched honestly: *"You're paying for future-you, not today-you — plus the peer reviewer you don't have."*

---

## How rigor scales — Crux is a dial, not a fixed setting

Different projects need different amounts of rigor. Crux ships with **HITL gate count** as the visible knob.

| Mode | HITL gates | Best for |
|---|---|---|
| **Strict** | All 8 (PRD, Modules, Architecture, Design, Plan, PRs, UAT, Release) | Regulated industries, complex products, larger teams |
| **Standard** | 5 (PRD, Architecture, Plan, PRs, Release) | Default for most teams |
| **Compressed** | 3 (PRD, PRs, Release) | Small/founding teams (≤4 people), fast MVPs, trusted contributors |
| **Solo** | 2 (PRD, Release) | Solo developers, weekend builds — Crux still records, just doesn't gate |
| **Observation-only** | 0 | Teams measuring SDLC discipline before enforcing it |

The audit trail, learning system, capability registry, and Loop 9 are **the same in every mode.** What changes is how often a human signs. Compress when speed matters; tighten when stakes do.

**Crux's value scales with project complexity and team size — but not linearly.** Solo + simple project = some value. 3-person + simple = real value (peer reviewer is the killer feature). 3-person + regulated = highest value per dollar. 8-person + complex = saturation point. 30-person + complex = diminishing returns until multi-team coordination layers exist (planned, not yet shipped).

---

## What you get

- **A product spec** built from real interrogation, not a template
- **Architecture decisions** documented with alternatives and reasoning
- **A harness** — tests, lints, CI, quality gates — engineered to your stack
- **Code** with tests, reviews, and clean PRs — every one traceable
- **An audit trail** that survives team turnover and regulatory questions
- **Cost visibility** — exactly how much each feature consumed in AI time
- **A learning loop** that gets smarter with every incident
- **A queryable graph** of why every piece of code exists

---

## Who it's for

**Small dev teams** that want enterprise-grade discipline without enterprise-grade overhead. Especially:

- Teams shipping into regulated industries (finance, healthcare) where audit trails matter
- Teams with non-technical stakeholders who need to *see* what's happening
- Teams burned by AI coding tools that produced fast slop
- Teams that have lost institutional knowledge to turnover
- Teams that already write briefs and RFCs and want them taken seriously by AI tooling
- Design-conscious teams tired of design intent decaying between Figma and production

**Not for:**
- Solo founders (no second human to UAT, no compliance lead — Crux is fundamentally a team product)
- Pure exploratory R&D with no users yet (run in observation-only mode until product-market fit)
- Throwaway prototypes
- Teams allergic to process

---

## The honest tradeoffs

- **Slower start.** You don't write code in the first hour. The interrogation and harness phases pay off later.
- **More approvals.** Humans gate 5+ checkpoints per feature. Friction is the feature, not a bug.
- **Doesn't fit chaos.** If your team thrives on undocumented decisions and emergent design, Crux will feel suffocating.
- **AI cost is real.** A typical feature costs meaningful tokens (~$150–$200 for backend, ~$280–$350 for UI-heavy work). Caps and per-task budgets keep it bounded, but it's not free.
- **UI-heavy projects cost ~30% more human time** at gates 4.5, 7, and 7.5. Designer time at Gate 4.5 is irreducible — Crux structures the work, doesn't replace taste judgment. Plan accordingly.
- **Sharpen the axe, then cut the tree.** Crux is slower per feature start, faster per feature finish, dramatically faster per *correct* feature finished. Net velocity goes up; perceived velocity in the first hour goes down.

---

## Runtime neutrality — Crux sits above the tool wars

Crux is **not tied to any single AI coding tool.** The pipeline, the trace graph, the capability registry, the artifacts, and Loop 9 are all runtime-neutral by design. Adapters connect Crux to specific execution backends — Claude Code, Cursor, Aider, raw Anthropic/OpenAI SDKs, and others as they emerge.

This matters for one reason: **receipts that only work as long as you keep paying one vendor aren't real receipts.** Crux's audit-trail thesis demands portability. Your trace graph, your ADRs, your test plans, your reviewer-prompt amendments — all of it lives in your repo as plain markdown and YAML. Switch tools tomorrow and the audit survives.

The v1 reference adapter targets **Claude Code**, because that's where the richest skill ecosystem already lives. New adapters slot in without refactoring the core. Cursor adapter, Aider adapter, raw-SDK adapter — same Crux, different runtimes underneath.

| Layer | Tool-coupling |
|---|---|
| 8-gate pipeline | None |
| Trace graph (REQ → ADR → Task → PR) | None — markdown/YAML data |
| Capability registry | None — taxonomy you own |
| Loop 9 feedback | None |
| HITL gates and artifacts | None |
| Agent execution + hook installation | Adapter-shaped — pluggable |

About 80% of Crux is fundamentally tool-neutral. Only the execution edge is adapter-coupled, and the adapter interface is small (~15 functions a backend must provide).

## Built on open-source shoulders

The Claude Code reference adapter pulls from three projects:

- **Ruflo** — orchestration patterns (DAG batching, hook conventions). Crux ports the patterns, doesn't fork the codebase.
- **Everything Claude Code (ECC)** — a library of 200+ skills covering most engineering domains, plus the rules/hooks/agents framework
- **Matt Pocock's skills** — sharp interrogation tools (notably `grill-me`) and TS testing depth. Crux bundles a curated subset (`grill-me`, `grill-with-docs`, `diagnose`, `zoom-out`).

Crux is the conductor. ECC and Pocock are the instrument library *for the Claude Code adapter*. Other adapters bring their own libraries. Harness engineering is the stage. The Capability Registry — Crux's own contribution — is the shared vocabulary that lets every piece work together cleanly across runtimes.

---

## What Crux is, in three sentences

Crux is a learning system disguised as an SDLC platform. The pipeline is the substrate; the trace graph is the memory; Loop 9 is the input; amendments are the consolidation. Every incident makes the next month's reviewer permanently smarter — across the whole organization, regardless of who quits.

That's a defensible 10-year product story.

---

## Ready to build?

Suggested next steps, in order:

1. **Adapter Interface v0.1** — the ~15 functions any runtime backend must provide (spawn agent, run hook, install skill, capture output). Defining this day 1 saves ~3–4 months of structural rework later.
2. **Capability Registry v0.1** — the keystone artifact every gate depends on. ~30–40 capabilities covering core stacks.
3. **Crux core scaffold** — runtime-neutral data model, trace graph storage, gate state machine. Written in TypeScript or Go for portability across adapter implementations.
4. **Claude Code reference adapter** — wraps ECC plugin install, bundles curated Pocock skills, handles hook installation. The first working backend.
5. **Prototype Gate 0** (brownfield audit) — lowest-risk wedge, demonstrably useful even if the rest is incomplete, forces trace storage to exist early.
6. **Gate 5 (harness install)** — second-biggest integration surface.
7. **Gates 1–4, 4.5, and 7** — the headline build, once the hard integration questions are settled.

Later: Cursor adapter, Aider adapter, raw-SDK adapter — each ~1–2 months once the interface is stable.
