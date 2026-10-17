# Duck Run: design changes (17 Oct, decided by Tejas)

These replace the matching parts of `GAME_BRIEF.md` / `PROJECT_BRIEF.md` / `DUCK_RUN_ADDENDUM.md`.
Everything not listed here is unchanged.

## The run now

1. **Runner 1** on a muddy forest road. **A dog chases Bill** (see below).
2. **Pond dive** (stage `DIVE`, was `SUB_ENTRY`): a natural pond sits in the road just past the end of Runner 1 (you see it coming); Bill runs up, leaps and dives in with a splash. **No submarine, no portal.**
3. **Swim** (stage `UNDERWATER`): Bill swims with **A/D in three lanes**, collects **coins** and dodges **jellyfish and pufferfish**.
4. **Dollar hook** (`SURFACE_RETURN`): Bill's eyes turn to `$`, his tongue flops out (greedy duck), he grabs the dollar and gets yanked up.
5. **Runner 2** on the same road, with breadcrumbs (bread slices) and the heart. Gets the **speed boost** if it was bought.
6. **Boss: Don Crumbs, "The Mafia Pigeon"** (fedora, pinstripe suit, cigar, tommy gun). **Intro (~4 s):** Bill skids to a stop, the Don swoops down from the sky onto his crate and lands with a thump; letterbox bars, his name card, and the taunt *"You're going down, birdie!"*; then FIGHT!. Real bullets. His face shows the damage: smug → furious → battered → wrecked.

## Swim, coins and power-ups

- **The timing ring and oxygen are dropped.** Space can't be live while A/D steer (two-button rule), so the swim is A/D only.
  Zubair's `sim/underwater.ts` and `sim/timing-ring.ts` are no longer used by the game. `sim/boss.ts` still is.
- **A hit underwater costs 5 coins and slows Bill**, never a life, so lives still pass through the swim unchanged.
- Coins buy **the best power-up you can afford, automatically** (no menu):

| Coins | Power-up | Effect |
|---|---|---|
| 100+ | 💥 Laser +50% | Every laser hit on the boss does 1.5× damage |
| 50+ | ⚡ Speed boost | Runner 2 starts at 1.3× top speed for 4 s, and Bill smashes through branches while it lasts |
| 20+ | 🛡️ Shield | A bubble for the first 5 s of the boss fight; bullets bounce off |

The swim is **hard on purpose**: about 120 coins on a trail that hops lanes every few coins and leads right up to creatures ("bait"), with creature rows every ~12 units, mostly blocking two lanes, and the pace rising through the swim. The trail only moves one lane at a time, so every coin is collectable, but the 100-coin laser needs a near-perfect swim. In test runs, a perfect bot got 99–109 coins and a slower one 44–72.

## Pacing (latest)

| Stage | Length | Top speed |
|---|---|---|
| Runner 1 | ~20 s (410 units) | 22 |
| Swim | ~15 s (270 units) | 18 |
| Runner 2 | ~10 s (255 units) | 26: the duck gets faster each stage |
| Boss | ~5 s per round | 3 quick shots (0.75 s apart), then a short Ready → Aim → FIRE |

A full run is about 65–80 s.

## The dog (Runner 1)

- It chases at the start, then drops back out of sight.
- **First branch hit:** it catches up and stays right behind Bill for 5 s.
- **Another hit while it's close:** it bites once Bill's 1 s invulnerability ends, costing one extra life.

## Still undecided (unchanged)

The boss timings, damage curve, no-press outcome, bullet aim and the 300,000-point score split. Placeholders are marked UNDECIDED in `client/src/core/config.ts`.
