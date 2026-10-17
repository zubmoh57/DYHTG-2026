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
  oxygen: {
    start: 3,
  },
  runner: {
    lanes: [-2.5, 0, 2.5] as const,
    laneChangeSec: 0.15,
    startSpeed: 12,
    maxSpeed: 22,
    acceleration: 1,
    hitSpeedMultiplier: 0.7, // confirmed: a hit removes 30% of current speed
    runner1Distance: 1400,
    runner2Distance: 850,
  },
  underwater: {
    speed: 15,
    distance: 1000,
    smallBoost: 1.25,
    strongBoost: 1.5,
    boostSec: 3,
    windows: 10,
    ringSec: 2,
    strongBoostMinAccuracy: 90,
    smallBoostMinAccuracy: 50,
  },
  boss: {
    health: 30000, // confirmed (addendum §1)
    shotsPerVolley: 3, // confirmed: three single bullets per cycle
    shotIntervalSec: 1.5,
    /** Reaction attack: Ready → Aim → Fire (green). Every number here is UNDECIDED (addendum §1). */
    reaction: {
      readySec: 0.8,
      aimSec: 0.8,
      fireWindowSec: 1.2,
      maxDamage: 10000, // at a 0 ms reaction
      minDamage: 1000, // at the end of the fire window
    },
  },
  timing: {
    perfectToleranceSec: 0.05, // underwater ring
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
