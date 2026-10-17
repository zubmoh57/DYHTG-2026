# Duck Run: design changes (17 Oct, decided by Tejas)

These replace the matching parts of `GAME_BRIEF.md` / `PROJECT_BRIEF.md` / `DUCK_RUN_ADDENDUM.md`.
Everything not listed here is unchanged.

## The run now

1. **Runner 1** in a forest river. **A dog chases Bill** (see below).
2. **Pond dive** (stage `DIVE`, was `SUB_ENTRY`): a glowing whirlpool pops up on the river and Bill dives in. **No submarine any more.**
3. **Swim** (stage `UNDERWATER`): Bill swims with **A/D in three lanes**, collects **coins** and dodges **jellyfish and pufferfish**.
4. **Dollar hook** (`SURFACE_RETURN`): Bill's eyes turn to `$`, his tongue flops out (greedy duck), he grabs the dollar and gets yanked up.
5. **Runner 2**, with breadcrumbs (now real bread slices) and the heart. Gets the **speed boost** if it was bought.
6. **Boss: "The Don"**, a mafia pigeon (fedora, pinstripe suit, cigar, tommy gun). Real bullets. His face shows the damage: smug → furious → battered → wrecked.

## Swim, coins and power-ups

- **The timing ring and oxygen are dropped.** Space can't be live while A/D steer (two-button rule), so the swim is A/D only.
  Zubair's old `sim/underwater.ts` and `sim/timing-ring.ts` were removed after being superseded by `phases/underwater/SwimPhase.ts`. `sim/boss.ts` still supplies the boss rules.
- **A hit underwater costs 5 coins and slows Bill**, never a life, so lives still pass through the swim unchanged.
- Coins buy **the best power-up you can afford, automatically** (no menu):

| Coins | Power-up | Effect |
|---|---|---|
| 100+ | 💥 Laser +50% | Every laser hit on the boss does 1.5× damage |
| 50+ | ⚡ Speed boost | Runner 2 starts at 1.35× top speed for 6 s (Tejas's interpretation of "boost") |
| 20+ | 🛡️ Shield | A bubble for the first 5 s of the boss fight; bullets bounce off |

A course has about 130–150 coins, so the laser needs a good swim.

## The dog (Runner 1)

- It chases at the start, then drops back out of sight.
- **First branch hit:** it catches up and stays right behind Bill for 5 s.
- **Another hit while it's close:** it bites once Bill's 1 s invulnerability ends, costing one extra life.

## Still undecided (unchanged)

The boss timings, damage curve, no-press outcome, bullet aim and the 300,000-point score split. Placeholders are marked UNDECIDED in `client/src/core/config.ts`.
