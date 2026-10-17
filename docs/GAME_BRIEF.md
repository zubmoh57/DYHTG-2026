# TWO KEYS — final game design and build brief (JPMC challenge)

> ⚠️ **Superseded.** The team is building **Dollar Duck**: see `docs/PROJECT_BRIEF.md` and `docs/TEAM_SPLIT.md`. This file is kept only for history. Bill's character API in §9 still applies.

> **Working title:** *Two Keys* (rename once the character is chosen)
> **Challenge:** "Make something fun which uses two buttons or actions maximum."
> **Pitch:** *"Two keys. The whole game. Simple controls, real risks, and a ghost of the best run chasing you to the finish."*
> **Hackathon:** 24 hours · 4 developers + 1 joining later · everyone uses Claude Code / Codex

This is the single source of truth. Give it to every teammate **and** to their AI coding assistant before they write code. If something here conflicts with an older doc, this doc wins.

`[CHARACTER]` is **Bill the duck** (see §9 and `docs/character/CHARACTER.md`). `[BOSS]` and `[GOAL]` are still placeholders. Nothing in the code may depend on what the character looks like (see §9).

---

## 1. What the game is

A **2-minute speedrun** with four sections. Every player in a room gets the **same course**, plays it **on their own device**, and competes for the **fastest completed run** on a live leaderboard. A translucent **ghost of the room's best run** races alongside you.

| # | Section | Target length | What you do |
|---|---|---|---|
| 1 | **Runner 1** | ~35 s | Auto-run in 3 lanes. Dodge obstacles, take risky lanes for boost gates. |
| 2 | **Flight** | ~25 s | Fly through hoops. Time your presses for boosts. Pick safe or risky routes at forks. |
| 3 | **Runner 2** | ~30 s | Harder runner patterns, ends at the boss door. *(Built after the MVP run works.)* |
| 4 | **Boss** | ~30–45 s | Dodge projectile volleys, then land timed attacks. |
| — | **Results** | — | Your time, personal best, room leaderboard, splits vs the leader. |

**Why it answers JPMC's "depth" feedback:** two keys, but every second has a decision. Safe lane or boost lane, safe route or risky route, attack now or wait for perfect. The same course for everyone means you can learn it and get better, and the ghost shows you exactly where the best player gained time.

---

## 2. Controls (agreed): **A and D only, the whole game**

There is no Space key, jump, slide or anything else. The two actions are **LEFT** and **RIGHT**.

| Device | LEFT | RIGHT |
|---|---|---|
| Keyboard | `A` | `D` |
| Phone / tablet | tap left half of screen | tap right half of screen |

| Section | LEFT / RIGHT means… |
|---|---|
| Runner 1 & 2 | Move one lane left / right |
| Flight: normal | **Either key** = boost attempt (timed on hoops) |
| Flight: fork window | LEFT = take the left route, RIGHT = take the right route |
| Boss: dodge phase | Move one lane left / right |
| Boss: attack window | **Either key** = attack (timed) |
| Countdown, transitions, results | No gameplay effect |

Rules:
- Only **key-down edges** count. Key-repeat and held keys never fire twice.
- Every phase change clears pending input, so a press from the last phase can't leak into the next.
- The on-screen UI always shows what LEFT and RIGHT do right now (e.g. `◀ SAFE | RISKY ▶`).
- Menus (join, start, retry) are not gameplay. The host runs the room from the big screen, and Retry is a single on-screen button on results.

---

## 3. Core rules (agreed)

### Lives and damage
- Start every attempt with **3 lives**. Lives carry across sections.
- Entering the boss gives **+1 life** (once per attempt, so 3 becomes 4 if you were never hit).
- An obstacle or projectile hit costs **1 life**, then **1.0 s invulnerability** (overlapping hits in that second do nothing).
- A runner hit also cuts speed: `speed = speed * 0.7`. Normal acceleration then resumes. A hit must slow you **even during a boost**.
- 0 lives means the run **fails**. Failed runs are never ranked.
- Timing mistakes in flight **never** cost lives.

### Retry
- Retry restarts **your** attempt only: 3 lives, timer 0, same room course. Nobody else is affected.
- Every attempt gets a new `attemptId` so stale network messages from an old attempt are ignored.

### Timer
- Counts from the first movement tick to the boss-killing attack. Transitions count. It never pauses.
- The timer is **the tick counter** (`elapsedTicks / 60`), not wall-clock time (see §6).

---

## 4. Section designs

### 4.1 Runners (Runner 1 and Runner 2)
- Auto-run forward in **3 lanes**. LEFT/RIGHT change lane (fast, ~0.12 s).
- Speed rises gradually to a normal cap. **Boost gates** push you above the cap for a short time, then expire.
- **Boost gates are activated by running through them in the right lane.** No input needed.
- **Risk vs reward (the depth):** boost gates sit in the dangerous lanes, behind tighter obstacle patterns. Safe players protect lives. Fast players thread the risky lane.
- Courses are built from **pre-validated chunks** (see §6.3). Every chunk is guaranteed beatable at max boosted speed.
- Runner 2 reuses the runner code with harder chunk combinations. **No new mechanics** in Runner 2. It ends at a visible boss door.

### 4.2 Flight
- The `[CHARACTER]` flies along a path. Alignment with hoops is automatic, so there's no steering.
- **Hoops:** each hoop turns from red to **green** for a short window as you reach it. Press **either key** in the window for a boost. Successful boosts **refresh** the boost timer; they don't stack infinitely.
- **Anti-mash:** an early press uses up that hoop's attempt. Each hoop needs a fresh key-down.
- A missed or early press gives no boost and does no damage. It does **not** cancel a boost you already have.
- **Forks (2 per flight):** about 2 s before a fork the UI shows `◀ [route] | [route] ▶`. Your press in the fork window picks the route. No press means the **safe** route.
  - **Safe route:** wide, easy hoop timing, fewer hoops.
  - **Risky route:** more hoops with tighter green windows, so more boost and more time saved if you nail it, and nothing gained if you don't.
  - Which side is risky changes per fork, shown with clear icons.

### 4.3 Boss: `[BOSS]`
**Boss health: 30,000.** Repeat until the boss dies or you run out of lives:

1. **Volley:** 3–4 large glowing projectiles, each with a visible wind-up (~0.6 s warning). Dodge with LEFT/RIGHT across 3 lanes.
2. **Attack window:** movement is disabled. A target circle appears with a larger circle closing in on it (~1.2 s). Press **either key** when they line up.
3. Show precision and damage, apply damage **once**, then the next volley starts.

| Outcome | Damage |
|---|---:|
| Perfect (within ±50 ms of the perfect moment) | 10,000 |
| Imperfect press | `max(10, round(10000 * precision))`; precision falls linearly from 1 at ±50 ms to 0 at ±400 ms |
| Key already held when the window opens | resolves immediately: 10 |
| No press before the window closes | 1 |

Three perfect attacks kill the boss. Timing is measured in **ticks**, not frames, so the challenge is the same on 60 Hz and 144 Hz screens. Boss health can never show below 0, and the victory event fires once.

---

## 5. Multiplayer: rooms, race view and ghost

### 5.1 Room flow
1. The **host** opens `/host` on the big screen and creates a room. It shows a **room code + QR code**.
2. Players open `/play?room=CODE` (scan the QR) and get an **auto-generated name** (editable on the join screen).
3. The host presses **Start**, and everyone gets a synchronised 3-2-1 countdown.
4. Each player runs **locally** on their own device. Players never see each other's avatars, apart from the ghost.
5. Players can fail, finish or retry at any time without affecting anyone else.

### 5.2 Big-screen race view (`/host`) (this is what makes the demo loud)
- One row per player: name, **progress bar across all 4 sections**, current section, lives, boss HP during the boss, status (running / failed / finished / disconnected).
- Live leaderboard: best completed times.
- Big moments get a banner: *"Tejas just beat the boss — 1:52!"*, *"New room record!"*

### 5.3 Ghost of the leader
- When a run becomes the **room best**, the server stores its ghost track.
- At the start of each attempt, the client fetches the current best ghost and renders it as a **translucent `[CHARACTER]`** in runners and flight.
- In the boss arena the ghost is hidden. Show the leader's boss-clear time instead.
- **Splits:** at each section boundary show `+1.4 s` (red) or `−0.8 s` (green) against the ghost. This is the addictive bit.
- **Ghost data, v1 (render this):** position samples at 10 Hz `[tick, section, distance, lane, height]`. That's about 1,200 samples for a 2-minute run, which is tiny. It can't desync.
- **Ghost data, v2 (the engineering flex):** also store the run's **seed + input log** (`[tick, action]` pairs). Because the sim is deterministic (§6.1), replaying the input log reproduces the run exactly. A unit test proves this. Use it in the pitch: *"every run is a seed plus a few hundred key presses."*

### 5.4 Ranking
- Primary: **lowest completed run time.** Ties go to whoever finished first.
- Secondary stats on results: score, boosts hit, perfect attacks, hits taken.
- Results show **latest attempt** and **personal best** separately. A failed attempt never replaces a best.
- In-progress ordering on the race view: section, then distance (or boss HP removed).

---

## 6. Engineering design

### 6.1 Deterministic simulation (agree this on hour 0, it's hard to retrofit)
- The game logic runs at a **fixed 60 ticks per second**. Rendering runs at whatever the screen does and **interpolates** between ticks.
- `client/src/sim/` is **pure and deterministic**:
  - No Three.js, no DOM, no `Date.now()`, no `performance.now()`, no `Math.random()`.
  - **No `Math.sin/cos/tan/exp/pow` in sim code.** These can differ slightly between browsers. Keep trig in `render/` only.
  - All randomness comes from a seeded PRNG (`mulberry32`). Gameplay RNG and cosmetic RNG are **separate** streams.
  - Time is the integer tick counter. Durations are stored in ticks (e.g. invulnerability = 60 ticks).
- Input events are stamped with the tick they're applied on.
- Same seed + same input log = same run, every time, on every machine.

```ts
// client/src/sim/types.ts (shape, not final)
export type Action = 'LEFT' | 'RIGHT';
export interface InputEvent { tick: number; action: Action }

export type Phase =
  | 'COUNTDOWN' | 'RUNNER_1' | 'FLIGHT' | 'RUNNER_2'
  | 'BOSS_DODGE' | 'BOSS_ATTACK' | 'FINISHED' | 'FAILED';

export interface RunState {
  seed: number;
  tick: number;            // elapsed ticks = the timer
  phase: Phase;
  lives: number;
  invulnUntilTick: number;
  lane: 0 | 1 | 2;
  distance: number;        // within current section, world units
  speed: number;
  boostUntilTick: number;
  bossHp: number;
  score: number;
  events: SimEvent[];      // hits, boosts, phase changes; render and net read these each tick
  // section-specific state lives in sub-objects owned by each section's module
}

// client/src/sim/run.ts
export function createRun(seed: number): RunState;
export function step(state: RunState, actions: Action[]): void; // advances exactly 1 tick
```

Each section module exposes the same lifecycle: `enter(state)`, `step(state, actions)`, `isComplete(state)`. Only `run.ts` (owned by the integration dev) moves between phases, owns lives and the timer, and routes input.

### 6.2 Architecture

```
            ┌──────────────────────── Browser (player) ────────────────────────┐
 A / D  ──▶ │ input/ ──▶ sim/ (pure, 60 Hz) ──▶ render/ (Three.js) ──▶ screen  │
 touch      │                │                                                 │
            │                └──▶ net/ (one WebSocket) ◀── ghost track         │
            └────────────────────────│─────────────────────────────────────────┘
                                     ▼
            ┌──────────── Server (FastAPI) ────────────┐       ┌─ Browser (/host) ─┐
            │ rooms (in memory) · leaderboard          │ ────▶ │ race view,        │
            │ ghost store (SQLite) · progress fan-out  │       │ leaderboard, QR   │
            └──────────────────────────────────────────┘       └───────────────────┘
```

**Trade-offs to put on the architecture slide:**
- *Local sim + server relay* instead of a server-run game: zero input lag for players, and the server stays tiny. The cost is that times are client-reported. That's fine for a friendly prototype. The v2 input log makes server re-verification possible later.
- *Rooms in memory, results in SQLite:* fast and simple. A server restart loses live rooms but keeps records.
- *Ghost as position samples:* can't desync. The input log is kept for verification, not rendering.
- *One FastAPI process* serves the built frontend **and** the WebSocket: one URL, one deploy.

### 6.3 Course generation
- A hand-made library of **obstacle chunks** (e.g. 15–25 per runner, ~40 units long each), each tagged with difficulty and an entry/exit safe lane.
- A seeded PRNG picks the chunk order. Runner 2 picks from harder tags.
- A **validator** (unit-tested) checks every generated course is beatable at **max boosted speed**: there's always a reachable safe lane with enough reaction distance (lane change time + ~0.4 s).
- Obstacles are placed by **distance**, not time. The boss volley pattern for cycle *n* comes from `seed + n`, so everyone faces the same boss.

### 6.4 Stack
| Part | Choice | Why |
|---|---|---|
| Client | TypeScript + Vite + **Three.js** | Runs in any browser, nothing to install |
| UI overlay | Plain DOM + CSS over the canvas | HUD, lobby and results are faster to build as HTML |
| Sound | Howler.js | Simple, reliable browser audio |
| Server | **Python FastAPI** + WebSockets | Your team already knows FastAPI |
| Storage | SQLite (results, ghosts) + in-memory rooms | No external services, no secrets |
| Tests | Vitest (client), pytest (server) | |
| Deploy | One container (FastAPI serves `client/dist`) on Render or Railway, **plus** a laptop + phone hotspot backup | WebSockets work, one URL |

### 6.5 Message protocol (WebSocket JSON, `/ws/{roomCode}`)

Client → server:
```jsonc
{ "type": "join",     "name": "Speedy Otter", "reconnectToken": null }
{ "type": "progress", "attemptId": "a1", "phase": "FLIGHT", "sectionProgress": 0.42,
  "elapsedTicks": 2710, "lives": 2, "bossHp": null }                       // every 0.5 s
{ "type": "finish",   "attemptId": "a1", "elapsedTicks": 6843, "score": 15200,
  "ghost": { "samples": [[0,"RUNNER_1",0,1,0], ...], "inputs": [[12,"LEFT"], ...] } }
{ "type": "fail",     "attemptId": "a1", "phase": "BOSS_DODGE", "elapsedTicks": 5120 }
{ "type": "retry",    "attemptId": "a2" }
```
Host → server: `{ "type": "create_room" }`, `{ "type": "start" }`

Server → clients:
```jsonc
{ "type": "joined",      "playerId": "p3", "reconnectToken": "…", "seed": 91827 }
{ "type": "lobby",       "players": [{ "id": "p3", "name": "Speedy Otter" }] }
{ "type": "countdown",   "startAtServerMs": 1760712000000 }
{ "type": "race",        "players": [{ "id": "p3", "phase": "FLIGHT", "progress": 0.48,
                                       "lives": 2, "status": "running" }] }   // to host, ~4 Hz
{ "type": "leaderboard", "entries": [{ "name": "Speedy Otter", "ticks": 6843 }] }
{ "type": "ghost",       "ownerName": "Speedy Otter", "ticks": 6843, "samples": [...] }
```
Server rules: validate message shape and size (cap the ghost payload at about 200 KB), ignore messages with an old `attemptId`, mark a player **disconnected** after 5 s without messages, and let a dropped phone rejoin its seat with `reconnectToken`.

### 6.6 Repo layout
```
two-keys/
  client/
    src/
      sim/      constants.ts rng.ts course.ts chunks.ts run.ts runner.ts flight.ts boss.ts types.ts
      render/   scene.ts character.ts runnerView.ts flightView.ts bossView.ts ghostView.ts effects.ts
      input/    input.ts            (keyboard + touch → Action events)
      net/      socket.ts           (the ONLY place that talks to the server)
      ui/       lobby.ts hud.ts results.ts
      host/     raceView.ts
      play.ts   host.ts             (two entry pages)
    tests/      lives.test.ts boost.test.ts boss.test.ts course.test.ts replay.test.ts
  server/
    app/        main.py rooms.py models.py storage.py
    tests/      test_rooms.py test_leaderboard.py test_full_race.py
  docs/         GAME_BRIEF.md (this file)  ARCHITECTURE.png
  README.md     (how to run in one command, controls, team)
```

### 6.7 Starting tuning values (all in `sim/constants.ts`, all expected to change in playtests)
| Constant | Start value |
|---|---|
| `TICK_RATE` | 60 |
| Lane change time | 7 ticks (~0.12 s) |
| Runner start / cap / boost-cap speed | 12 / 24 / 32 units/s |
| Runner acceleration | 1.5 units/s² |
| Boost duration | 120 ticks (2 s) |
| Hit penalty / invulnerability | ×0.7 speed / 60 ticks |
| Runner 1 / Runner 2 length | ~750 / ~650 units |
| Flight length / speed / boost speed | ~550 units / 20 / 30 units/s |
| Hoop green window | 12 ticks safe route, 7 ticks risky route |
| Boss HP | 30,000 |
| Projectile warning | 36 ticks |
| Attack circle close time | 72 ticks; perfect = ±3 ticks |

---

## 7. Tests (minimum set)

Client (Vitest), all against `sim/` with no rendering:
- One hit removes exactly one life, and overlapping hits within invulnerability don't.
- Hit during a boost still slows the player by 30%.
- Boss entry gives +1 life exactly once per attempt.
- Boss damage table: perfect = 10,000; imperfect ≥ 10; held key = 10 once; no press = 1; HP never below 0.
- Flight: an early press uses up the hoop's attempt; a miss never cancels an active boost.
- **Course validator:** 1,000 random seeds all produce beatable courses.
- **Replay determinism:** run a scripted input log twice and get an identical `elapsedTicks` and final state.

Server (pytest):
- Room create, join, start, reconnect with token.
- Leaderboard: failed runs are never ranked, a best is only replaced by a faster time, stale `attemptId` is ignored.
- **One integration test:** two simulated WebSocket clients join, one finishes and one fails, and the leaderboard and ghost are correct.

---

## 8. Team split (5 owners, separate folders, no stepping on each other)

| Owner | Owns | First deliverable |
|---|---|---|
| **Dev 1: Integration + Runners** | `sim/run.ts`, `sim/runner.ts`, `sim/course.ts`, `input/`, `render/scene.ts`, `render/runnerView.ts`, `play.ts` | Runner 1 playable with a capsule placeholder (fun gate, hour 4) |
| **Dev 2: Flight** | `sim/flight.ts`, `render/flightView.ts` | Hoops + green windows + one fork |
| **Dev 3: Boss** | `sim/boss.ts`, `render/bossView.ts` | Volley + closing circle + damage table + its tests |
| **Dev 4: Server + net** | `server/`, `net/socket.ts`, `ui/lobby.ts`, deployment | Room create/join/start working between two browsers |
| **Dev 5: Race view + polish** *(joins later)* | `host/raceView.ts`, `ui/results.ts`, `ui/hud.ts`, `render/effects.ts`, sound, balancing, pitch deck, backup video | Race view from fake data, then live data |

Rules: only Dev 1 changes `sim/types.ts` and `run.ts`, and only after telling the team. Only Dev 4 changes the protocol. Merge small working pieces into `dev` often, and keep `dev` always runnable.

---

## 9. The character: `[CHARACTER]` = Bill the duck

**Bill is done.** He's built from primitives (option B below) in `client/src/render/character.ts`, with all the poses listed below. The art, poses and how to drop him in are in `docs/character/CHARACTER.md`.

Until Bill is wired in, the player can stay a **capsule placeholder** (a coloured capsule with a little "face" cube so you can see which way it points). Everything must keep working when the real character is dropped in.

**Hard rules so the character never breaks gameplay:**
- **Hitboxes are fixed boxes defined in `sim/constants.ts`** and never read from the model. Changing the character changes zero gameplay.
- All character code lives in `render/character.ts` behind one interface:
```ts
export interface CharacterView {
  object: THREE.Object3D;
  setPose(pose: 'run' | 'laneLeft' | 'laneRight' | 'hit' | 'fly' | 'attack' | 'victory' | 'fail' | 'idle'): void;
  setGhost(isGhost: boolean): void;   // translucent version for the ghost
  update(dtSeconds: number): void;    // animation only
}
```

**What the art person needs to deliver** (either option works):
- **Option A, a 3D model:** `.glb`, low-poly (under ~5k triangles), origin at the feet, facing +Z, about 1.8 units tall. Animations: run, lean left/right, hit/stumble, fly, attack, victory, fail, idle.
- **Option B, built from primitives in code:** spheres, cylinders and boxes, with code-driven bobbing, squash and lean. This is faster, looks charming, and needs no rigging.

**Theme slots to fill once the character is chosen:**
| Slot | Placeholder now | Fill in later |
|---|---|---|
| `[CHARACTER]` | Capsule | **Bill the duck**: a lazy, scruffy duck in a suit who is terrible with money. See `docs/character/CHARACTER.md` |
| Runner 1 setting | Grey track, red blocks | Where do they start? |
| Flight vehicle/setting | Capsule with a trail | What do they fly on/through? |
| Runner 2 setting | Darker track | Where are they heading? |
| `[BOSS]` | Big red cube with an "eye" | Who/what stands in the way? |
| `[GOAL]` | Glowing finish gate | Where do they need to get to? |
| Closing line | "Two keys. The whole game." | The pitch's last sentence |

Keep a bank/finance flavour in `[GOAL]` or the closing line if it fits naturally. It's a free JPMorgan tie-in.

---

## 10. 24-hour plan

| Hours | Outcome | Notes |
|---|---|---|
| **0–2** | Repo scaffold, `types.ts` + protocol agreed, capsule on a track, deploy "hello world" | Nobody codes features before the contract is merged |
| **2–4** | Runner 1 playable: lanes, obstacles, speed, hits, lives | **Fun gate at hour 4:** lane changes instant and hits feel punchy? If not, fix that before anything else |
| **4–8** | Flight and boss modules on placeholders; server rooms working | Flight and boss can be tested in isolation via a `?phase=FLIGHT` URL param |
| **8–11** | **One complete local run:** Runner 1 → Flight → Boss → Results, retry, fail | **Most important milestone** |
| **11–15** | Rooms, countdown, progress, leaderboard, race view, ghost v1 | Test with 4+ devices |
| **15–19** | Runner 2, character drop-in, theme, sound, screen shake, splits | |
| **19–20** | **Feature freeze** | Only bug fixes after this |
| **20–22** | Balance on real phones and venue Wi-Fi, fix bugs | |
| **22–24** | Deploy check in a fresh browser, rehearse demo twice, record backup video | |

**If you're behind, cut in this order:** Runner 2 → forks (keep plain hoops) → ghost v2 input log → splits → extra chunk variety. **Never cut:** a complete run, lives and retry, the leaderboard.

---

## 11. Demo plan (3–5 minutes)

1. **Hook (15 s):** *"Two keys. The whole game. Nothing else."* Put the room QR on screen.
2. **Judges play (2–3 min):** every judge joins on their phone and they all race **at once**. The big screen shows the live race view. Someone takes the risky route, someone nails a perfect boss hit, and the banner pops.
3. **Ghost and splits (30 s):** a second attempt shows the leader's ghost and `−1.2 s` splits, so they can see the depth.
4. **Engineering (30 s):** one architecture slide. Deterministic 60 Hz sim; *"every run is a seed and a few hundred key presses"*; tests; the trade-offs.
5. **Close (15 s):** the theme's closing line.

**Backups:** a laptop running the server on a phone hotspot, keyboard play on the laptop, and a recorded video.

---

## 12. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Scope too big for 24 h | Primitives only until hour 11; strict cut order (§10) |
| Runner doesn't feel good | Fun gate at hour 4; instant lane changes, sound + shake on hits |
| Impossible courses | Chunk library + validator test over 1,000 seeds |
| Venue Wi-Fi | Gameplay is local, so only the leaderboard needs the network; hotspot backup |
| Phone touch quirks | `pointerdown` not `click`; CSS `touch-action: none`; disable zoom; test iOS + Android by hour 15 |
| Ghost desync | Render ghost from position samples (v1), not input replay |
| Different refresh rates | Fixed-tick sim; all timing in ticks |
| Merge chaos | One owner per folder; contract first; small merges to `dev` |
| "Two buttons" dispute | A and D only, everywhere. Menus are host/on-screen, not gameplay |

---

## 13. Instructions for AI coding assistants

- Read this whole document and the repo README before changing anything. Implement **only** your assigned scope (§8).
- **Never** add gameplay inputs beyond LEFT and RIGHT.
- **Never** put Three.js, DOM, `Date.now`, `performance.now`, `Math.random` or `Math.sin/cos/tan/exp/pow` inside `client/src/sim/`.
- Don't change `sim/types.ts`, `run.ts` or the protocol unless you own them. Propose the change instead.
- Don't make the character's model affect hitboxes or any gameplay value.
- Don't add accounts, live player avatars (other than the ghost) or extra backend services.
- No secrets in code or Git. Small, reviewable changes, and say how you tested each one.
