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
   * Pacing (Tejas, 18 Oct): about 20 s for Stage 1 (Runner 1), 15 s for the swim, 15 s for Stage 2
   * (Runner 2), then the boss. The duck gets a little faster each stage (22 → 26 top speed); its speed
   * carries from Stage 1 into Stage 2. Distances are fixed; times vary with hits and the boost.
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
    runner2Distance: 385, // ~15 s (starts at ~22, builds to 26)
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
     * Agreed: early press or a button held through Fire = 1 damage (that lives in sim/boss.ts).
     * Ready/Aim last one second each, followed by a random wait before Fire.
     * The wait range is tuning; the damage curve and no-response outcome remain UNDECIDED.
     */
    reaction: {
      readySec: 1,
      aimSec: 1,
      fireDelayMinSec: 0.25,
      fireDelayMaxSec: 1.5,
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
    // The race score rooms are ranked by (RunState.raceScore). Tejas, for the multiplayer leaderboard.
    perSection: 25000, // each of the 4 sections, pro rata (the boss by damage dealt)
    perCoin: 250,
    finishBonus: 50000,
    perLifeLeft: 5000, // on a finish
    parSec: 120, // a finish earns timeBonusPerSec for every second under this
    timeBonusPerSec: 1000,
  },
  flow: {
    countdownSec: 3,
    /**
     * Room races use the full course (1). Below 1 shortens every section for a quicker party race,
     * e.g. 0.5 for about 25 s before the boss.
     */
    roomCourseScale: 1,
  },
} as const;
