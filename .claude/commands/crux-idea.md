---
description: Ingest a brief, ticket, or concept note. Classify depth, detect claims and unknowns.
allowed-tools: Read, Write, Glob, Grep
argument-hint: '<input-file>'
---

You are running `/crux-idea` with input file: $ARGUMENTS

## Steps

1. Read the input file. If `$ARGUMENTS` is empty, halt and ask the user to pass a path or paste the content into a file under `docs/sdlc/input/`.
2. Determine the next monotonic id by listing `docs/sdlc/input/IDEA-*.md` and incrementing.
3. Copy the input into `docs/sdlc/input/IDEA-<n>.md` verbatim. Prepend a frontmatter block:

   ```yaml
   ---
   id: IDEA-<n>
   ingested_at: <ISO-8601 timestamp>
   source_path: <original path>
   classification: <one of: brief | ticket | concept_note | research_note>
   depth: <one of: surface | medium | deep>
   ---
   ```

   - **Brief** = under 200 words, marketing/intent-shaped.
   - **Ticket** = bug or single-feature framing with acceptance criteria.
   - **Concept note** = multi-page narrative arguing for a product or system.
   - **Research note** = exploratory analysis, no commitment yet.
   - Depth = surface (≤300 words), medium (300–2000), deep (>2000).

4. Scan the body for:
   - **Claims** — statements asserted as true that have no citation. List them under `## Claims (unverified)`.
   - **Unknowns** — explicit "TBD", "?", "we don't know", or hedged future-tense verbs. List them under `## Unknowns`.
   - **Implicit decisions** — anywhere the author picks A over B without justifying. List under `## Implicit decisions`.
5. Append all three lists to the IDEA file under a `## Crux annotations` section, AFTER the original body. Do NOT mutate the original body text.

## Output

- The path to the written `IDEA-<n>.md`.
- A 3-line summary: classification, depth, count of claims/unknowns/implicit decisions.
- A reminder: "Run `/crux-grill IDEA-<n>` next to interrogate this idea."

## Trace

This command does not write to `derived_from` of anything; the IDEA is the root of a trace chain.
