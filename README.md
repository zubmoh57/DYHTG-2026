# Duck Run

Funny, colourful 3D browser game for the JPMorgan hackathon.

## Shared context

Read these before implementing an assigned feature:

- [Game brief](docs/GAME_BRIEF.md): confirmed mechanics, technical recommendations, and open decisions.
- [Additional information](ADDITIONAL_INFO.md): boss, targeting, score, and completion clarifications.
- [Team split](docs/TEAM_SPLIT.md): current ownership and integration boundaries.
- [Bill the duck](docs/character/CHARACTER.md): existing character and preview reference.

The updated Duck Run design supersedes the older Two Keys flight and boss-circle design. Follow the per-phase A/D/Space controls in the game brief.

## Team and branches

### Active code paths

- `client/src/main.ts` uses `OfflineRoomService` for the lobby. It delegates room membership, shared seeds and synchronized starts to `network/localRooms.ts`; both use the `RoomApi` contract. Rooms work across tabs in the same browser.
- `course/generateCourse.ts` is the runner course generator; `phases/underwater/swimCourse.ts` generates the separate swim course.
- `ui/results.ts` is the results screen. Extend it rather than adding a second screen.
- `phases/underwater/SwimPhase.ts` implements the current coin swim. The old oxygen/timing-ring simulation has been removed.
- `phases/boss/BossPhase.ts` renders and adapts the rules in `sim/boss.ts`; both are needed.

Online Supabase rooms and progress/result publishing from game events remain unfinished. The offline service retains attempt-storage methods for that integration; the game currently uses its lobby methods only.

Team 46 [AKA team monster] 
8 - branches

main (default)
dev - (this is where we push our code ONLY WHEN YOU COMPLETE IN YOUR BRANCH)
dev-test - (testing of dev branch MUST BE IN SYNC WITH DEV)

the rest 5 are the branches based on members
1. Tejas-br
2. rayyan-br
3. mayank-br
4. Zubair-br
5. Vansh-br
