# raw Anthropic SDK — Second Adapter Feasibility Spec

Paper-only analysis of implementing all 17 `RuntimeAdapter` functions using the
raw Anthropic SDK (TypeScript) as the second adapter target for Crux v1.0.

## Function feasibility matrix

| Function name | Concern group | Verdict | Note |
| --- | --- | --- | --- |
| `session_start` | Lifecycle | feasible | SDK `Anthropic` client instantiation serves as session context; caller holds reference |
| `session_end` | Lifecycle | feasible | Release client reference and clear conversation history; no SDK teardown required |
| `capabilities_supported` | Lifecycle | feasible | Host declares a static `CapabilityMap`; no SDK call needed |
| `spawn_subagent` | Subagents | feasible | Create a new `Anthropic` client instance with an isolated message history |
| `await_subagent` | Subagents | feasible | `await` the Promise returned by the sub-client `messages.create` call |
| `install_skill` | Skills | unknown | Skill format is Claude-Code-specific; raw SDK has no skill registry — host can inline prompt snippets |
| `uninstall_skill` | Skills | unknown | Same host-defined scope as `install_skill`; removal is a host map mutation |
| `list_skills` | Skills | unknown | Returns host-maintained registry; no SDK equivalent exists |
| `install_hook` | Hooks | unknown | Hooks are host-side lifecycle callbacks; raw SDK has no hook mechanism |
| `list_hooks` | Hooks | unknown | Returns host-maintained hook registry; no SDK equivalent |
| `run_command` | SlashCommands | feasible | Host invokes `child_process.execFile`; SDK not involved |
| `read_file` | FilesystemShell | feasible | Node `fs.readFile`; host process supplies the implementation |
| `write_file` | FilesystemShell | feasible | Node `fs.writeFile`; host process supplies the implementation |
| `run_shell` | FilesystemShell | feasible | Node `child_process.exec` returning stdout/stderr/exit code as `ShellResult` |
| `emit_event` | TraceCapability | feasible | Host-side structured log or event emitter; no SDK dependency |
| `resolve_capability` | TraceCapability | feasible | Deterministic lookup in a host-owned `CapabilityMap`; no SDK call |
| `invoke_skill` | TraceCapability | unknown | Composes with `install_skill`; implementation is host-defined when skills are prompt-based |

## References

- Anthropic TypeScript SDK — https://github.com/anthropics/anthropic-sdk-typescript
- Anthropic Messages API reference — https://docs.anthropic.com/en/api/messages
- Anthropic Agent SDK (multi-agent orchestration patterns) — https://docs.anthropic.com/en/docs/agents
- Node.js `child_process` docs — https://nodejs.org/api/child_process.html
- Node.js `fs` (filesystem) docs — https://nodejs.org/api/fs.html
- ADR-CRUX-003 — `docs/sdlc/adr/ADR-CRUX-003.yaml`
- REQ-CRUX-007 — `docs/sdlc/prd/REQ-CRUX-007.yaml`

## Conclusion

Verdict totals across all 17 functions:

- **feasible**: 11 (`session_start`, `session_end`, `capabilities_supported`, `spawn_subagent`, `await_subagent`, `run_command`, `read_file`, `write_file`, `run_shell`, `emit_event`, `resolve_capability`)
- **unknown**: 6 (`install_skill`, `uninstall_skill`, `list_skills`, `install_hook`, `list_hooks`, `invoke_skill`)
- **needs-redesign**: 0

The 6 `unknown` verdicts arise because the raw Anthropic SDK has no concept of
skills or hooks — those are Claude-Code-specific runtime constructs. A host
adapter can supply them through inline prompt injection or a host-owned registry
without requiring SDK changes. `unknown` signals a product-level design decision,
not a technical blocker.

Because **needs-redesign count is 0**, ADR-CRUX-003 does not need to be reopened.
The raw Anthropic SDK is a viable second adapter target for Crux v1.0. The
`unknown` functions should be addressed in a follow-on task that defines the
host-side skill and hook registry contract.
