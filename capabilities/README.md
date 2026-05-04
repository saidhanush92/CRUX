# Capability registry

The capability registry is the keystone Crux artifact. Every gate that needs an
installed skill resolves it by querying capabilities, not by naming the skill
directly. This decouples gates from the specific skill bundles installed and
keeps the harness reproducible.

## Files

- **`registry.v1.yaml`** — the canonical Crux capability registry. Versioned (semver). Every skill imported into `.claude/skills/` declares which of these capabilities it provides.
- **`local.yaml`** — project-specific extensions. Capabilities added here are not part of the canonical registry; they live for this project only until promoted.

## Field shape

Each capability has three fields:

```yaml
- id: namespace.kebab-case-name
  description: One line. What an installed skill MUST teach the agent to do.
  governs_gate: 5
```

- `id` — globally unique within the registry. Namespace prefix is required.
- `description` — single sentence, present tense, action-oriented.
- `governs_gate` — primary gate (1..8) that fails to close if no skill provides this capability.

## Namespaces

| Namespace | Scope |
|-----------|-------|
| `language`  | Which language a skill teaches |
| `framework` | Specific tools or libraries within a language |
| `data`      | Storage and persistence patterns |
| `testing`   | Test strategy, runners, layers |
| `process`   | Workflow patterns; how to think and work |
| `ops`       | CI/CD, deployment, infrastructure |
| `design`    | Design systems, accessibility, visual quality |
| `quality`   | Code review, verification loops, defect prevention |

## Semver rules

The registry follows semver:

- **Patch (1.0.x)** — typo fixes, doc-only changes that do not alter intent.
- **Minor (1.x.0)** — additive only:
  - New capability id.
  - New namespace.
  - Description clarification that does not change which skills satisfy the capability.
- **Major (x.0.0)** — breaking:
  - Renaming or removing a capability id.
  - Description change that would invalidate existing skill mappings.
  - Removing a namespace.

A major bump produces a new file at `registry.v2.yaml`. The previous version stays
in the repository so existing harness locks remain auditable.

## How skills map to capabilities

Every skill under `.claude/skills/<name>/SKILL.md` declares its capabilities in
frontmatter:

```yaml
provides_capabilities:
  - testing.tdd-loop
  - quality.coverage-floor
```

The harness installer (Gate 5) resolves the set of skills required to provide
every capability the project's stack and gates demand. If a capability has no
provider, Gate 5 halts and reports the gap.

## Mapping rules

- A capability MAY be provided by multiple skills; the harness picks one (preferring local origins, then ECC, then Pocock).
- A skill MUST only declare capabilities it genuinely teaches. False claims surface as gate failures during the verification loop.
- Adding a capability to a skill's frontmatter requires the capability to exist in `registry.v1.yaml` OR `local.yaml`. Unknown capabilities fail the registry-cross-reference check.

## Cross-reference check

`scripts/check-orphans.sh` will be extended in a later phase to also verify:

- Every `provides_capabilities` value in every skill resolves to an id in the registry.
- Every capability in the registry has at least one provider in the installed skill set (or is intentionally unprovided and flagged).
