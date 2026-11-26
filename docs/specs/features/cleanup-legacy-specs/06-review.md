# Review: Cleanup Legacy Specs

## Findings

| Category | File | Description | Resolution |
|----------|------|-------------|------------|
| blocker | `src/provider/ollama/` | Files were deleted on disk (leaked from sibling feature branch) causing compile failure. | Fixed: `git checkout -- src/provider/ollama/` restored from HEAD. |
| blocker | `README.md:58` | Still referenced deleted `specs/initial-engine/`. | Fixed: updated to point at `docs/specs/`. |
| blocker | `CLAUDE.md:11` | Still referenced deleted `specs/initial-engine/`. | Fixed: updated to point at `docs/specs/`. |
| blocker | `CHANGELOG.md:33,87` | Two links/references to deleted `specs/initial-engine/`. | Fixed: removed links, prose updated. |
| blocker | `docs/specs/features/cleanup-legacy-specs/07-changes.md` | Missing file referenced by CHANGELOG. | Fixed: file created. |

## Outcome

All blockers resolved. `npm run compile` and `npm test` (84/84) pass. No stale `specs/` references remain outside the `07-changes.md` history file. Ready for Phase 8.
