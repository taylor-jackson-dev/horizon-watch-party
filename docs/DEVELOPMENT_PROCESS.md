# Development Process — AI-Assisted, Review-Gated Engineering

This project was built with an AI coding agent (Claude Code) driven by a
deliberate, repeatable workflow. The tooling wrote code; the *process* — scoping,
decision gates, layered review, and live verification — is what kept a
~7,700-line real-time application coherent, documented, and shippable across many
short sessions. This file exists to explain that process in enough detail to
discuss it accurately.

---

## 1. How the work was structured: phases + resumable sessions

Development was broken into numbered **phases** and sub-phases (Phase 1 Foundation
→ Phase 5.6 Delight), each a single, independently shippable unit of scope. Every
work session opened and closed the same way, so no session depended on the memory
of another.

**Session kickoff — the "resume prompt."** Each session began by pasting a
self-contained brief that stated: what is live, what is done and *verified*, what
this session should do (in order), and what is explicitly out of scope. These
briefs live in `journal/HANDOFF.md`. The discipline: an agent starts every session
cold, so the prompt — not the model's memory — carries the context. A typical
kickoff read like:

> "Resume Watch Party. Phases 1–5.5 are complete and verified live. Phase 5.6 is
> built and static-green but its two-device live verify is still pending. This
> session, in order: (1) re-acquaint by reading PLAN.md and every journal; (2) run
> a whole-repo audit; (3) apply the justified fixes; (4) deliver a written
> assessment. Do not touch the deferred items."

**Decision gates.** Before building anything with more than one reasonable
approach, the agent surfaced the options and waited for an explicit choice. Those
"locked decisions" were then recorded verbatim in the phase journal (e.g., "mobile
layout = tabbed, not a stacked scroll," "spotlight trigger = total bursts, not
distinct users"), so the *why* behind each design was never lost.

**Phase-end ritual.** Every phase closed with the same five steps:
1. Write/update the phase journal (`journal/PHASE_N_*.md`).
2. Commit with a descriptive message.
3. Push (which auto-deploys both services).
4. Report a clean state + hand back the next resume prompt.
5. Clear the context window before the next phase — never carry stale context
   across a phase boundary.

## 2. The documents that carry context

Four living documents are the project's memory, and they are the reason a
multi-session build stayed consistent:

- **`PLAN.md`** — the architectural plan and phase roadmap: stack decisions,
  monetization strategy, the full phase list, and every resolved design question.
- **`journal/HANDOFF.md`** — the bootstrap/quick-start doc and the home of the
  resume prompts.
- **`journal/PHASE_*.md`** — one per phase. Each records: the goal, the
  architecture chosen, decisions locked, **problems hit and how they were
  resolved**, files touched, and how it was verified. These are the primary source
  of truth for cross-session continuity.
- **`DEFERRED.md`** — work intentionally postponed, each item with *what*, *why
  deferred*, and *when to revisit* — so nothing gets silently dropped.

## 3. The review system

Correctness was enforced by layered, purpose-specific review rather than a single
catch-all pass. Three review roles were defined and used consistently:

**Per-change logic review (every phase).** Before a feature shipped, its diff was
reviewed for correctness against its stated intent — broken invariants, missed
edge cases, race conditions, weak error handling, security-relevant mistakes. This
was formalized as **"Part A" of the phase-end ritual**:

```
build → logic-review the diff → apply fixes → unit-test any new pure logic
      → typecheck / lint / build → live-verify
```

This caught real bugs before they reached production — for example, an
open-redirect fix that *looked* correct but was bypassable via a backslash
(`/\evil.com`, which browsers treat as `//`); the reviewer flagged it and it was
replaced with a URL-parse-based sanitizer plus unit tests.

**Structural / architectural audits (phase-group boundaries).** At milestones and
before major changes, a heavier audit reviewed a whole subsystem — or the entire
repository — and produced **severity-ranked findings** (Critical / High / Medium /
Low, plus Strengths) with a prioritized remediation plan. A firm rule kept these
honest: never rate a cross-layer "bypass" claim as High/Critical without reading
*both* layers involved — otherwise cap it and label it unverified. The audit
proposed follow-up tasks for approval rather than acting unilaterally.

**Deep security passes.** A dedicated security review was reserved for
security-sensitive surfaces (auth, tokens, the real-time authorization model) and
is queued again before any payment code ships.

## 4. Verification: static green is not "done"

A feature passing typecheck, lint, build, and unit tests was considered
**static-green**, not finished. The gate for "done" was **two-device live
verification**: the feature confirmed working on two real devices (a host and a
viewer) against the deployed app — because a synchronized, multi-user, real-time
product has whole classes of bugs (sync drift, reconnect behavior, mobile
autoplay/permission quirks) that no local check can catch. Several shipped fixes
came directly out of these live passes.

Unit tests deliberately target **pure logic** (validators, the rate limiter, the
sync/skew math, the reaction-spotlight detector) — the parts that are
deterministic and worth locking down — while integration behavior is covered by
the live-verification ritual. CI (GitHub Actions) runs lint, typecheck, tests, and
a production build on every push.

## 5. Research, when a decision needed evidence

For questions that needed grounding rather than opinion — competitive landscape,
platform (YouTube API) policy constraints, viability — a research pass gathered and
**cross-checked sources under a strict citation rule**: cite only sources actually
opened, corroborate load-bearing claims across at least two independent sources,
and explicitly label anything that couldn't be verified. The full-project
assessment (`journal/AUDIT_2026_07.md`) was informed by exactly this kind of
cited, cross-checked research rather than assumption.

---

### In one sentence

An AI agent did the typing; a disciplined loop of *scoped phases → explicit
decision gates → layered review → live verification → written journals* did the
engineering — and that loop is what made the result maintainable.
