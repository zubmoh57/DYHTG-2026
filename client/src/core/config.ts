// Every tuning number in one place (brief §8 + DUCK_RUN_ADDENDUM). Starting values only: change
// them after playtests, never hard-code a copy inside a phase.
//
// Anything marked UNDECIDED is a placeholder so the stand-in phases can run. The team has NOT
// agreed it (see DUCK_RUN_ADDENDUM "Still to decide"). Don't build real rules on top of it.

export const CONFIG = {
  lives: {
    start: 3,
    invulnerableSec: 1, // confirmed
  },
  /**
   * Pacing (Tejas, 17 Oct): about 20 s for Runner 1, 15 s for the swim, 10 s for Runner 2, and the
   * duck gets a little faster each stage (22 → 26 top speed). Distances are fixed; times vary.
   */
  runner: {
    lanes: [-2.5, 0, 2.5] as const,
    laneChangeSec: 0.15,
    startSpeed: 13,
    maxSpeed: 22, // Runner 1
    runner2MaxSpeed: 26,
    acceleration: 1.4,
    hitSpeedMultiplier: 0.7, // confirmed: a hit removes 30% of current speed
    runner1Distance: 410, // ~20 s
    runner2Distance: 255, // ~10 s
  },
  /** The swim (DESIGN_CHANGES.md): A/D lanes, dodge sea creatures, collect coins. */
  swim: {
    speed: 18,
    distance: 270, // ~15 s
    coinsLostOnHit: 5,
    hitSlowdown: 0.6,
  },
  /** Bought automatically with swim coins: the best one you can afford (DESIGN_CHANGES.md). */
  powerUps: {
    shieldCoins: 20,
    boostCoins: 50,
    laserCoins: 100,
    shieldSec: 5, // at the start of the boss fight
    boostSec: 4, // at the start of Runner 2; Bill smashes through branches while it lasts
    boostSpeedMultiplier: 1.3,
    laserDamageMultiplier: 1.5,
  },
  boss: {
    health: 30000, // confirmed (addendum §1)
    shotsPerVolley: 3, // confirmed: three single bullets per cycle
    shotIntervalSec: 0.75, // faster rounds (Tejas): 3 quick shots, then Ready → Aim → FIRE
    /**
     * Reaction attack: Ready → Aim → Fire (green), decided by Zubair's sim/boss.ts.
     * Agreed: early press or Space held at Fire = 1 damage (that lives in sim/boss.ts).
     * Every number below is UNDECIDED (GAME_BRIEF "Decisions needed") and only feeds the sim's rules.
     */
    reaction: {
      readySec: 0.45,
      aimSec: 0.45,
      fireWindowSec: 1.0,
      maxDamage: 10000, // at a 0 ms reaction
      minDamage: 1000, // at the end of the fire window
      noPressDamage: 0,
    },
    bulletSpeed: 21, // UNDECIDED: units per second
    windUpSec: 0.35, // readable warning before each shot
  },
  score: {
    max: 300000, // confirmed cap (addendum §3); how the points are allocated is UNDECIDED
    perDistanceUnit: 10, // UNDECIDED: original brief's suggestion, not yet scaled to the cap
    perBreadcrumb: 100, // UNDECIDED: same
  },
  flow: {
    countdownSec: 3,
  },
} as const;
