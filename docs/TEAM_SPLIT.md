# Duck Run — team ownership

This is the current split supplied by the team, replacing the generic Dev 1–5 assignments in the older brief. Read [GAME_BRIEF.md](GAME_BRIEF.md) and [ADDITIONAL_INFO.md](../ADDITIONAL_INFO.md) for mechanics and unresolved decisions.

| Person | Owns |
| --- | --- |
| **Tejas** | Core setup, both runner sections, Bill, merging everyone's work, all lobby UI (create/join room, room code, nickname, waiting list, host Start, countdown), and the HUD. |
| **Mayank + Rayyan** | Backend pair. Mayank handles Supabase setup, security rules, room logic, live scoreboard, and deployment. Rayyan handles network code, offline mode, progress updates, the course generator, and the results screen. |
| **Zubair** | Shared timing ring, underwater, submarine-entry and dollar-hook surface transitions, and the pigeon boss. |
| **Vansh (joins later)** | All tests and sound, Bill's new poses, game feel, testing in different browsers, balancing, and the demo. |

## Integration boundaries

- Latest clarification for Zubair's contribution: Tejas owns its frontend scenes, animation, UI, and input wiring. Zubair supplies gameplay state/rules; see [ZUBAIR_BASE.md](ZUBAIR_BASE.md). This supersedes any assumption that Zubair is building frontend previews or stage rendering.
- The timing ring serves the underwater circle mechanic. The boss uses Ready → Aim → green Fire reaction timing.
- Tejas coordinates core integration; Zubair implements his assigned stage/transition behaviour against the agreed integration contract.
- Coordinate shared types, input routing, lives, oxygen, scoring, and phase names before changing common interfaces. Exact file ownership remains to be agreed.
- Mayank and Rayyan agree backend/network interfaces before integration.
- Coordinate tests with Vansh and check your own changes before handing them over.
- Work on personal branches and follow the team's integration process. Coordinate edits to another owner's implementation.
