# Pixel Packs — Game Design Document

> Version 0.3 · 2026-11-23 · pre-production · "Pixel Packs" is a working title
> Companion docs: [`TASKS.md`](TASKS.md) (task board) · [`../CLAUDE.md`](../CLAUDE.md) (rules for Claude sessions)

## Contents
0. Working agreement (Claude sessions)
1. Vision & pillars
2. Core loops
3. World — the Five Cozy Realms
4. Cards & set structure
5. Rarities & pack odds
6. Variants, editions & mint numbers
7. Packs
8. Economy
9. Fusion, dust & crafting
10. Battle — Caravan March
11. Critter Village
12. Collection features
13. Progression
14. Multiplayer & social
15. Scores
16. UI / UX direction
17. Onboarding
18. Accessibility & performance
19. Art pipeline (PixelLab)
20. Audio
21. Tech architecture
22. Security, fairness & anti-abuse
23. Live ops & admin
24. Deployment
25. Roadmap
26. Testing & verification
27. Open questions & user to-dos
28. Parked ideas
29. Decision log

---

## 0. Working agreement (Claude sessions)
**Every task runs in its own Claude Code session** so no session runs into the context limit. The docs in this repo are the shared memory between sessions; nothing important may live only in a chat.

- **Unit of work = one task** from `docs/TASKS.md`, sized to finish in one session (one coherent, testable deliverable). The user starts a session with e.g. "Do T05".
- **Session start**: read `CLAUDE.md` (loaded automatically), the task's entry in `TASKS.md` including earlier handoff notes, and **only the GDD sections the task lists**. Check that its dependencies are done and merged into `main`.
- **During the session**: stay in scope. Extra work you discover becomes a new task in `TASKS.md` and is not done now. Keep context lean: don't open images, lockfiles or generated/huge files, trim command output, use subagents for wide searches, and keep source files small.
- **Session end**:
  1. Make sure typecheck, lint and tests pass.
  2. Update the task's status and handoff notes (what was done, decisions, gotchas, follow-ups).
  3. If the design changed, update the GDD and its decision log (§29).
  4. Commit and push the session branch.
  5. Ask the user whether to open a PR into `main`.
  6. Name the next task.
- **Task too big?** Finish a clean, working sub-part and split the rest into a new task.
- **Milestone start**: a short planning session (no code) breaks the next milestone into tasks.
- **Design changes are never silent**: anything that deviates from this GDD is confirmed by the user or recorded in §29.

## 1. Vision & pillars
**Pitch**: a cozy pixel-fantasy collecting game in the browser. Rip open themed packs, chase rare variants like Void and Glitch, fill your binder, trade with friends, and send your favourite critters into charming auto-battles.

**Audience**: friends and community first, plus collectors and casual strategy players. Sessions last 5–15 min; desktop browser first.

**Pillars**
1. **The rip is the reward.** Every opening feels tactile and escalates with rarity.
2. **Collect with pride.** Binder, collection log, mint numbers, editions and showcases.
3. **Cozy but clever.** Cute critters, but battles reward ordering and synergy.
4. **Fair & generous.** Rolls happen on the server, odds are published, pity exists, and every card can be earned for free. Variants are cosmetic plus a tiny perk.

## 2. Core loops
- **Minute**: open a pack → reveal → the binder fills up → fuse or dust.
- **Session**: claim the free pack and daily reward → do quests → buy packs with gold → adjust caravan and village.
- **Daily/weekly**: a free pack every 8 h (stores up to 2) · 7-day login calendar · 3 daily quests + 1 weekly quest · village harvest.
- **Season (~8 weeks)**: a new set and/or event pack · season pass · ladder reset · First-Edition window (§6).

## 3. World — the Five Cozy Realms
Lore frame: the **Wandering Post**, a courier service of moths and messenger birds, carries sealed packs between the realms. It is used in onboarding, in pack flavour text and for the trading "post office".

| Realm (code) | Critters | Palette | Battle identity | Pack opening |
|---|---|---|---|---|
| Hearthfire (HEA) | candle mice, bread golems, kettle dragons | amber, cream, cocoa | burst ATK, On Faint buffs | wax seal melts, sparks & steam |
| Tidepool (TID) | frogs, crabs, otters, jellyfish | teal, sand, coral | shields, heals | bubble swells & pops, splash |
| Mossgrove (MOS) | mushrooms, hedgehogs, snails, beetles | moss, bark, berry | regen, thorns | vines unwrap, petals fall |
| Skyloft (SKY) | owls, cloud sheep, kite foxes | sky, white, sunflower | Start-of-Battle snipes, repositioning | ribbon pulled, pack floats off like a kite |
| Starhollow (STA) | moths, wisps, sleepy night beasts | indigo, silver, lilac | debuffs, ally-faint synergy (lore home of Void) | moon clasp turns, stardust swirl |

Each realm also has a sub-palette (§19), a village building (§11) and realm battle bonuses (§10).

## 4. Cards & set structure
**Set 1 (name TBD) = 65 cards, 13 per realm**: 4 Common · 3 Uncommon · 2 Rare · 2 Epic · 1 Legendary · 1 Mythic.

- **IDs**: `<REALM>-<NNN>` (e.g. `MOS-007`), numbered by rarity.
- **Catalog fields**: id, set, name, realm, rarity, atk, hp, abilities (1–2), flavour (≤ 90 chars), `artPrompt` (critter description), flags (event, craftable).
- **Abilities are structured data from day one.** There is no free text; rules text is generated from the data, so the battle engine (M4) needs no data rewrite.
  - Shape: `{ trigger, effect, target, value, every? }`
  - Triggers: `startOfBattle · onEnter · onHurt · onAllyFaint · onFaint · support` (fires every N ticks, only from slots 2–5)
  - Effects (initial list): `damage · heal · buffAtk · buffHp · shield · thorns · regen · weaken` (lowers ATK)
  - Targets: `self · front · behind · allAllies · enemyFront · enemyBack · randomEnemy`
- **Power budget** (base ATK + HP): C 8 · U 9 · R 10 · E 11 · L 12 · M 13. Abilities cost points from a table that is tuned in M4. Stars: ★2 = +30 %, ★3 = +60 % to stats and ability values (rounded).
- **Card face**: 96×128 px frame around a 64×64 art window.
  - Frame material by rarity: wood → copper → silver → amethyst → gold → starmetal.
  - Also on the face: realm crest, ATK/HP badges and **1–6 rarity pips**, so rarity is never shown by colour alone.
- **Per-copy traits**: every copy is its own instance with: variant · stars · edition stamp · mint number · source (pack/craft/fusion/starter) · acquired at · trade lock · account-bound.

## 5. Rarities & pack odds
| Rarity | Slots 1–4 | Featured slot 5 | Reveal |
|---|---|---|---|
| Common | 70 % | — | quick flip |
| Uncommon | 22 % | 55 % | flip + soft chime |
| Rare | 6 % | 32 % | blue edge glow before the flip |
| Epic | 1.6 % | 9 % | pack shakes, purple light leaks through the seams |
| **Legendary** | 0.3 % | 3.2 % | **unique**: screen dims, golden god-rays, card descends spinning, realm crest bursts, slow-mo |
| **Mythic** | 0.1 % | 0.8 % | **unique**: full-screen takeover, time-freeze, realm mini-cutscene (e.g. a Starhollow eclipse), shockwave + camera shake |

- **Featured slot (5)**: always Uncommon or better, always revealed last, with its own glow.
- **Per pack**: ≈ 2.8 C · 1.43 U · 0.56 R · 0.15 E · 0.044 L · 0.012 M.
  - At least one Rare or better in ~60 % of packs; Epic or better in ~20 %.
  - Legendary or better in ~5.5 % (≈ 1 in 18 packs); Mythic in ~1.2 % (≈ 1 in 84).
- **Rarity invariant (unit-tested)**: the chance of getting a *specific* card strictly decreases with rarity. Copies per pack of the card's own realm: C 0.59 · U 0.40 · R 0.24 · E 0.065 · L 0.037 · M 0.010.
- **Pity** works per pity group and has a visible meter:
  - Groups: *Realm packs* (all five share one counter, so switching realms never loses progress) · *Mythic pack* · each *event pack*.
  - Legendary or better: guaranteed in the featured slot of the 40th pack without one (≈ 11 % of players ever reach it).
  - Mythic: soft pity from pack 100 (+1 percentage point per pack on the featured slot), hard pity at pack 150.
  - Scripted onboarding packs don't count towards pity.
- **RNG**: packs use a server-side cryptographic RNG (Web Crypto, unbiased by rejection sampling). Only battles use the seeded RNG.
- All odds, including pity rules, are shown in-game via a "?" on every pack. Config lives in `packages/shared/src/config/odds.ts`.

## 6. Variants, editions & mint numbers
| Variant | Chance per card | Shader | Tiny battle perk |
|---|---|---|---|
| Foil | 1/12 | diagonal light sweep that follows the cursor tilt | +1 HP |
| Prismatic | 1/150 | animated rainbow hue shift, sparkles | +1 to its ability value the first time it triggers |
| Void | 1/400 | starfield inside the art, purple edge warp, particles pulled inward | heals 1 HP on a killing blow |
| Glitch | 1/1500 | RGB split, scanlines, pixel jitter, rare corrupt-frame swap | 10 % chance per trigger to fire twice |

- **Rank**: Glitch > Void > Prismatic > Foil > Normal. The variant is rolled per card, independently of rarity. The Mythic pack triples all variant chances.
- **Expected for a free player** (~5 packs/day): Foil ~2/day · Prismatic ~1/week · Void ~1 every 2–3 weeks · Glitch ~1 every 2 months.
- **Variant stingers**: each variant adds its own moment on top of the rarity reveal. Glitch, for example, tears the screen, briefly corrupts the UI and shows "ERR_LUCK_OVERFLOW".
- **Later variants** (parked): Gilded, Celestial, Inverted, Full-Art.

**First-Edition stamps**
- Every pack has a release season. A copy pulled from a pack **during that pack's release season** gets a cosmetic "1st Edition · S‹n›" stamp.
- New sets launch with new packs at the start of a season, so every set, and every event pack, gets its own First-Edition window. The Mythic pack gets a new edition whenever a set is added.
- Never stamped: crafted copies, starter copies, and anything pulled in Season 0 (pre-launch).

**Mint numbers**
- Every Void and Glitch copy gets a global serial number per card and variant (e.g. "Void #12 · Moonmoth").
- The number is assigned at pull time, in the same transaction, and is never reused.
- It is shown on the card, in inspect, in trades and on profiles.

**Launch reset**: Season 0 covers development and the alpha. Before the public launch, all player data and mint counters are reset; alpha testers keep a cosmetic *Founder* title.

## 7. Packs
- **Realm packs** (×5), 100 gold each. Each card is rolled in three steps:
  1. rarity;
  2. realm (80 % the pack's realm, 20 % any enabled realm);
  3. a random card of that rarity and realm.
- **Mythic pack**, 300 gems; all realms are equally likely.
  - Slots 1–4 roll like a realm pack. The featured slot rolls Epic 75 % / Legendary 20 % / Mythic 5 %.
  - Triple variant chances.
  - Pity: Legendary or better by the 8th Mythic pack; Mythic hard pity at the 40th.
- **Event packs** are seasonal, bought with gold (optionally gems) and contain limited cards. Event cards return in reruns or become craftable after the event, so no card is ever locked behind gems or time forever.
- **Free pack**: one every 8 h, up to 2 stored; the player chooses which realm pack it is.
- **Pack inventory**: earned and bought packs stay unopened until the player opens them (right away, later, or in a live room). The roll happens on the server at opening and is saved before the animation starts. If the tab closes mid-reveal, "Resume reveal" appears on the next visit.
- **Opening**:
  - Drag across the seal to tear it (mouse or touch), or click.
  - Cards are revealed in ascending rarity, featured slot last. "Reveal all" and "Skip" are available.
  - Afterwards comes a results summary with NEW badges and "Dust extras".
- **Themes**: each realm pack has its own tear animation (§3). The Mythic pack opens in stages (lock → runes → burst); event packs use an event theme.

## 8. Economy
| Currency | Earned from | Spent on |
|---|---|---|
| Gold | daily calendar, quests, battles, village | realm and event packs, village upgrades |
| Gems (premium) | achievements, weekly quest, season free track (~100/week for free players); buyable later | Mythic pack, premium season pass, cosmetics |
| Stardust | dusting, quests, daily calendar, season track | crafting |

- **Target for free players (full game)**: 4–6 packs/day = 3 free packs + 1–3 bought ones.
  - An engaged player earns about 230–260 gold/day: quests ~100, battles 10 per win (capped at 60), village ~50, calendar 20–50.
- **Sources grow with the milestones**:
  - M1: calendar only, ≈ 3.5 packs/day.
  - M2 adds quests, M4 battles, M5 the village.
  - Whenever a source is added, the others are rebalanced so the daily total stays on target. `tools/econ-sim` checks this every time.
- **Gems**: an active free player gets a Mythic pack roughly every 3 weeks.
- **Realm completion targets**:
  - all 12 non-Mythic cards of a realm (Normal copies) in about 1 week of focused opening;
  - its Mythic in about 3 weeks, through luck, pity or crafting.
- **Timers**: daily reset at 00:00 UTC; all timers are server-side.
- **Premium (later)**: a gem store through a payment provider, with spending caps. It is never required for any card.

## 9. Fusion, dust & crafting
- **Fusion (classic 3×3)**: 3 × ★1 of a card → ★2; 3 × ★2 → ★3 (9 copies in total). No extra fee.
- **Trait inheritance**: the result keeps the *best* traits of its inputs:
  - the highest variant, with its mint number;
  - any edition stamp (earliest season);
  - the longest trade lock;
  - account-bound if any input is account-bound.
- **Fusing special copies**:
  - An extra special input (e.g. a second Void) refunds its variant dust bonus.
  - A confirmation dialog appears whenever a variant, stamp or mint number would be used up.
- **★1-equivalents**: ★1 = 1 · ★2 = 3 · ★3 = 9; a card is "maxed" at 9.
- The binder stacks copies ("×4"); expanding a stack lists each copy's traits.
- **Helpers**:
  - "Fuse all" uses Normal copies only, unless the player opts in.
  - "Dust extras" dusts only Normal, unstamped copies beyond 9 equivalents. It never touches variants, stamps or mint numbers unless the player selects them one by one.
- **Dust values**: C 5 · U 15 · R 50 · E 200 · L 800 · M 2 500. Variant multiplier: Foil ×2 · Prismatic ×10 · Void ×25 · Glitch ×60.
- **Crafting**: any non-event card as a Normal copy for C 40 · U 100 · R 400 · E 1 600 · L 4 000 · M 12 000 Stardust.
  - Crafted copies never have variants, stamps or mint numbers.
  - Event cards become craftable after their event.

## 10. Battle — Caravan March (M4)
- **Setup**: each player puts **5 cards** in order. The two front cards duel, and damage each tick is simultaneous. When a card faints, the next one steps up and its `onEnter` fires.
- **Tick order**:
  1. Both front cards hit.
  2. Triggers resolve in a fixed queue: side A front→back, then side B. Which side is A is decided by a seeded coin flip per battle.
  3. Faints and step-ups.
  4. `support` abilities every N ticks.
- **Tick limit 60**: after that, the side with more remaining HP % wins; equal HP % is a draw. This prevents endless heal loops.
- **Realm bonuses** apply at 2/3/4 cards of one realm. They are designed in M4 from the realm identities in §3.
- **Determinism**: a battle is a pure function of (seed, caravans) and produces an identical event log on server and client. The server is authoritative, the client renders the log, and replays come for free.
- **Modes**:
  - Practice against AI caravans.
  - Async PvP ladder: fight other players' saved defense caravans, matched by MMR and caravan-power bands.
  - Later: live PvP; **Fair Play arena** (every card counts as ★1, no variant perks); **Gauntlet** (roguelike draft from your own collection, 3 lives, streak rewards).
- **Presentation**:
  - Side-view road with a parallax realm backdrop.
  - Your caravan faces east; the enemy uses the same sprites mirrored.
  - Triggers show a small emote bubble and VFX.
  - Speed 1× / 2× / skip, plus an MVP summary after the battle.
- **Rewards**: gold per win (daily cap) and quest progress.

## 11. Critter Village (M5)
- **Buildings**: one per realm (Bakery · Pond Dock · Mushroom Farm · Kite Tower · Observatory), each with 1–3 card slots that unlock with account level.
- **Production**: assigned cards produce gold, Stardust or XP per hour.
  - Rarity and stars raise output; a matching realm gives +25 %.
  - Storage caps at 12 h.
- **Variants** change how a building looks: a Void bakery glows purple, a Glitch tower flickers.
- Cards in the village can still be used in battles; nothing is locked out.

## 12. Collection features
- **Binder**: a book with page turns and realm tabs.
  - Missing cards show as silhouettes; copies are stacked.
  - Filters for rarity, variant, stars, owned, edition and minted, plus sorting; the grid is virtualised.
- **Card inspect**: 3D tilt with the card's shader, lore, the traits of each copy, and fuse / dust / wishlist / showcase actions.
- **Collection log**: completion per realm and per variant.
  - Rewards: card backs, binder themes, titles, animated profile frames (e.g. for a full Glitch row).
- **Pull history**: every opening, filterable.
- **Share image**: a PNG of a pull (card, username, pull score), generated in the browser at no server cost.
- **Wishlist**: visible to trade partners, with matches highlighted.

## 13. Progression
- **Account level**: XP from opening packs, quests, battles and the village.
  - Unlocks: L1 packs & binder · L3 village · L5 trading · L6 battles · L10 ranked.
  - The level curve is tuned with `tools/econ-sim`.
- **Season pass**: ~8 weeks, 50 tiers, with season XP from quests.
  - Free track: gold, packs, Stardust, gems, cosmetics.
  - Premium track (gems): extra packs, exclusive card backs and frames, one guaranteed event card.
- **Achievements**: award titles.

## 14. Multiplayer & social (M3)
- **Friends**: add each other by `name#1234`.
- **Trading (light limits)**:
  - Unlocks at L5; 1:1 offers held in escrow on the server.
  - Both sides confirm; any change resets the confirmations, then a final 3-second review.
  - Max 10 trades/day.
  - Freshly pulled Mythic and Glitch copies are trade-locked for 72 h; account-bound copies can never be traded.
  - No currency transfers; a trade history is kept.
- **Live opening rooms**:
  - Up to 8 players open their own unopened packs, with reveals synchronized in a shared feed.
  - Emotes and reactions; a room-wide fanfare plays above a pull-score threshold.
- **Profiles**: 3 showcase cards, title, frame, collection score, set completion, best pull.
- **Leaderboards**: collection score · ladder MMR · weekly best pull (scripted packs excluded).
- **Communication**: emotes only, no free chat, so there is no moderation load. Usernames are filtered.

## 15. Scores
- **Pull score** of one copy = rarity points × variant multiplier.
  - Rarity points: C 1 · U 3 · R 10 · E 40 · L 150 · M 600.
  - Variant multiplier: Normal ×1 · Foil ×2 · Prismatic ×6 · Void ×15 · Glitch ×40.
  - Used for room fanfare, the best-pull leaderboard, share images and the profile's "best pull".
- **Collection score** = the sum of pull scores over each distinct (card, variant) owned, +50 % for that entry if a ★3 copy is owned.
- Edition stamps and mint numbers are shown but not scored.

## 16. UI / UX direction
Goal: simple, intuitive and modern with eye-candy, and clearly hand-crafted, **not AI-generated**.

**Do**
- Use one **master palette** (~32 colours) for all art and UI. UI tokens only reference palette entries.
- Use **one pixel scale per context** (e.g. 1 art pixel = 3 screen px in the UI). Never mix pixel sizes, and scale only by integers.
- Use a pixel display font for headings and numbers, a readable body font at ≥ 16 px, and no more than ~4 text sizes.
- Build panels as 9-slice pixel art made of materials (parchment, wood, cloth, brass) instead of flat boxes. Shadows are hard 2–4 px offsets, never blurred.
- Make buttons chunky, with rest / hover / pressed states (pressed moves down 2 px and the shadow shrinks) and a click sound.
- Use physical metaphors: a shop counter with a pack shelf, a binder book, a fusion workbench, a post office for trades.
- Add hand-placed details: stamps, stickers, string, pins, little critters peeking over panel edges.
- Give motion a purpose. UI moves take 120–250 ms with a slight cozy overshoot and stay still at rest. Particles, shake and slow-mo are only for big moments.
- Draw illustrated empty states and keep microcopy warm and short.

**Don't**
- Purple→blue gradients, glassmorphism, neon glow everywhere.
- Rounded-2xl cards with soft drop shadows.
- Emoji icons or generic icon sets; use pixel icons instead.
- A centered hero with three feature cards.
- Inter- or Roboto-only typography.
- Hype copy ("Unleash…", "Elevate…").

**Approval gate**: the user approves a style tile (palette, type, panels, buttons, one card, one home-screen fragment) before any screen is built (T06).

**Screens**
- M1 flow: Login/Register → Home (Open Packs button, free-pack timer, daily, quests, season bar) → Shop (pack shelf, odds, pity) → Opening scene → Results → Binder → Card inspect.
- Later: Caravan editor, Battle, Village, Trades (post office), Rooms, Profile, Leaderboards, Settings.
- Navigation has at most 5 items; in M1 these are Home · Packs · Binder.

**Device**: desktop-first, responsive down to phone width.

## 17. Onboarding (first ~90 s)
1. Register; a moth courier from the Wandering Post delivers your first satchel (3 short lines, skippable).
2. **Pack 1 (scripted)**: an Epic in the featured slot, which teaches the anticipation glow.
3. **Pack 2 (scripted)**: the featured card is a Foil, which teaches variants and tilt.
4. A binder tour (2 tooltips), then 5 account-bound starter cards, which form a ready caravan for M4.
5. Home, with the free-pack timer highlighted.

Every step can be skipped. In scripted packs only the forced slot is scripted; everything else rolls normally. Scripted packs don't count towards pity or the best-pull leaderboard.

## 18. Accessibility & performance
- Rarity is readable without colour (pips, frame material, label), and the rarity hues are checked for colour-blind safety.
- `prefers-reduced-motion` is respected, and an in-game "reduce effects" setting removes shake and flashes and softens the Glitch flicker (photosensitivity).
- Every menu works with the keyboard, with visible pixel-style focus states.
- In the binder, shaders run only on hovered, inspected or on-screen variant cards; the rest use static overlays, and the grid is virtualised.
- Targets: 60 fps on a mid-range laptop; first screen under 2 MB; opening scenes and their assets lazy-loaded; texture atlases.

## 19. Art pipeline (PixelLab)
**Tool**: `tools/artgen` turns specs into PixelLab API calls and polls background jobs.
- Output: PNGs and spritesheets in `apps/client/public/assets/`.
- Every call is logged in `tools/artgen/manifest.json` (endpoint, params, seed, cost, status).
- A review gallery lets the user approve or reject each asset.
- Flags: `--dry-run`, `--only <id>`, `--budget <n>`.
- API reference: the condensed `docs/pixellab-api-notes.md` (written in T04). Sessions never load the full OpenAPI spec.

**Consistency rules**
- The master palette and an 8–16 colour sub-palette per realm are passed as `target_palette`.
- **Style anchors**: 3–4 approved "golden" card arts. All card art is generated with `/generate-with-style-v2`, using the anchors as `style_images` plus a fixed `style_description`. The output size follows the anchors (64×64).
- **Card-art prompt template** (fixed): `<critter description>, cozy whimsical fantasy critter, full body, facing the viewer in 3/4 front view, centered, feet on one ground line, transparent background, 1 px dark outline, soft shading, light from top-left, no text, no frame, no scenery`. Constants: 64×64, `no_background: true`, the realm palette, and a recorded seed.
- **One PixelLab character per card**:
  - The approved card art is the south-facing `reference_image` for `/create-character-v3` with `n_directions: 4` (the API minimum).
  - South = binder idle loop (Legendary/Mythic only); east = battle sprite; enemies are the east sprite mirrored.
  - The `view` parameter, canvas size and feet baseline are chosen in the T17 trial, then locked here.
- **Battle animation spec**, identical for every critter, made with `/characters/animations` and `directions: ["east"]` only:

| Animation | Frames | Rule |
|---|---|---|
| idle | 4 | breathing in place, loops |
| walk | 6 | walking east in place, loops |
| attack | 6 | lunge east, return to the base pose |
| hurt | 4 | recoil west, return to the base pose |
| faint | — | **procedural** in code (tip-over, squash, poof VFX) |

  Every animation prompt adds the same constraints:
  - always faces east (right) and never turns;
  - no camera movement, and nothing leaves the canvas;
  - no background and no ground shadow (the game adds one);
  - feet stay on the fixed baseline;
  - the first and last frame are the base pose.
- **Binder idle loops** for Legendary/Mythic: south direction, 4–8 frames, staying inside the 64×64 window. Trialled in T17 and dropped if the consistency is poor.

**Other assets**
- Pack art and icons: `/generate-with-style-v2`.
- UI panels and buttons: `/create-ui-asset`, as 9-slice.
- Rarity frames and card back: a generated base, hand-tuned if needed.
- Realm battle backdrops (M4) and VFX: `/vfx`.
- Heading font: `/generate-font-pro`; fallback is an OFL-licensed pixel font, with its licence file in the repo.
- Music and SFX: see §20.

**QA & budget**
- Every asset is approved in the review gallery before use. Rejects are regenerated with a new seed, at most 2 retries before the prompt is revised. Approved files are immutable: a new version gets a new filename.
- Check `GET /v2/balance` at the start of every art task, and record the real cost per endpoint in the API notes.
- Budget in generations: M1 ≈ 260 · M2 ≈ 250 · M4 ≈ 350 · M5 ≈ 150, so ~1 000 in total against 1 163 left on 2026-11-23. Whether the allotment renews monthly is still open (§27).

## 20. Audio
- **Music** (`/music`, instrumental, looped with `/music/{id}/loop`), in a cozy lo-fi chiptune style:
  - M1: home, binder, pack opening (a base loop plus rarity layers).
  - Later: battle, village, per-realm themes.
- **SFX** (`/sound-effects`):
  - Pack opening: tear, card slide, flip, 6 rarity stingers, 4 variant stingers.
  - UI and rewards: button hover/press, coin/gem/dust gain, fusion, error.
- Playback uses Howler.js with audio sprites, separate music and SFX volumes, and mute. Audio starts after the first user interaction (browser autoplay rules).

## 21. Tech architecture
- **Monorepo** (pnpm workspaces, TypeScript strict):
  - `apps/client`: React + Vite; PixiJS v8 for opening scenes, card shaders, particles and battles; Motion (formerly Framer Motion) for UI transitions; Zustand; TanStack Query; Howler; CSS modules + design tokens.
  - `apps/server`: Fastify (REST under `/api`) + Socket.IO (M3); Drizzle ORM; Zod; argon2id; pino logs.
  - `packages/shared`: pure, unit-tested game rules (types, Zod schemas, catalog, odds, pack roll, fusion, scores, and the M4 battle engine).
  - `tools/artgen`, `tools/econ-sim` and `tools/admin` (command-line tools).
- **Database**: PostgreSQL in CI and production. **PGlite (embedded Postgres)** is used for local dev, tests and cloud sessions, so Windows needs only Node; a Docker Postgres can be used instead via `DATABASE_URL`. Drizzle runs the migrations. The catalog lives in `packages/shared` and is synced into the `cards` table on server start.
- **Core tables**: users, sessions, oauth_accounts, wallets, ledger (every currency or card change, with a reason), cards, user_cards (instances + traits), pack_types, pack_inventory, pack_openings, pity_counters, mint_counters, seasons, daily_claims, quests, user_quests, trades, trade_items, village_slots, season_progress, achievements, analytics_events.
- **Economy writes**: every economy action is a single DB transaction on the server. Mutations accept an **idempotency key**, so a retried request can't spend twice.
- **Config & secrets**: settings come from `.env`; `.env.example` is committed, secrets never are. In cloud sessions PixelLab is reached through the session proxy; locally through `PIXELLAB_API_KEY`.
- **Strings**: all UI text lives in one module (English only, ready for i18n later).
- **CI**: GitHub Actions runs typecheck, lint, unit tests, and integration tests against a Postgres service.

## 22. Security, fairness & anti-abuse
- **Accounts**: argon2id passwords; httpOnly + SameSite=Lax session cookies; a CSRF token on every mutation; Discord OAuth with `state`.
- **Email**: verification and password reset. In dev the emails are printed to the console; production needs an SMTP provider (§27).
- **Requests**: rate limits on auth, pack opening and trades; Zod validation on every input.
- **Economy**: server-authoritative, with idempotency keys and an append-only ledger for support and debugging.
- **Trading and accounts**: the trading safeguards in §14, account-bound starter cards, and usernames filtered against a blocklist.
- **Later**: bot protection on sign-up (e.g. Cloudflare Turnstile).

## 23. Live ops & admin
- **Admin CLI** (from M1): grant gold or packs, reset onboarding, inspect a user. Odds overrides are dev-only and never available in production.
- **Admin panel** (M5): seasons, event packs, grants, bans, economy overview.
- **Analytics** (M2): first-party `analytics_events` in Postgres (pack opened, rarity, quest done, session start). No third-party trackers, so no cookie banner is needed.
- **Season calendar**: seasons last 8 weeks. New sets and event packs start with a season, the pass and the ladder reset, and each pack gets its First-Edition window (§6).

## 24. Deployment
- **Now**: runs locally on the user's Windows PC (`pnpm dev`, PGlite).
- **Friends alpha after M3** (multiplayer needs real players), on the Debian VPS:
  - A separate compose project `pixel-packs` with an app container (Node server serving the built client, API and websockets) and its own small, memory-limited Postgres container, isolated from the production Worldforge stack.
  - Routing: an extra hostname rule in the existing Cloudflare Tunnel points at the app container, so Worldforge's Caddy stays untouched.
  - Backups: nightly `pg_dump` with rotation, copied off the server.
  - Needs: a (sub)domain on Cloudflare and an SMTP provider for emails.

## 25. Roadmap
| Milestone | Goal |
|---|---|
| **M1 — Pack-opening slice** | Mossgrove + Starhollow (26 cards), auth, free pack and daily reward, pack shop and opening with all reveals and variant shaders, mint numbers, binder, pull history, onboarding, character trial |
| M2 — Full set & progression | +39 cards (Hearthfire, Tidepool, Skyloft), 5 realm packs, fusion, crafting, seasons + First-Edition stamps, quests, account level, collection log, wishlist, share image, analytics, more music |
| M3 — Social + alpha | friends, trading, live rooms, profiles, leaderboards, VPS alpha deploy |
| M4 — Caravan March | battle engine, sprites and animations, caravan editor, practice + async PvP ladder |
| M5 — Village & seasons | Critter Village, season pass, event packs, admin panel |
| M6 — Launch prep | Gauntlet, Fair Play arena, premium store + legal, launch reset, later variants |

The task breakdown is in `docs/TASKS.md`.

## 26. Testing & verification
- **Unit tests (shared)**:
  - Odds: 100k-roll statistics per pack type against the published odds, the rarity invariant, exact pity counts, variant rates.
  - Rules: fusion 3×3 and trait inheritance, "dust extras" safety, scores, scripted packs.
  - M4: battle determinism (same seed → identical event log).
- **Catalog tests**: unique IDs, composition per realm as in §4, power budget, an approved art file for every card.
- **Integration tests (server)**: opening a pack is atomic; free pack and daily reward can't be claimed twice; retries are idempotent; concurrent opens are safe (real Postgres in CI).
- **E2E and visual (Playwright)**: register → onboarding → open packs (rarities forced via the dev `/debug` page) → binder. Screenshots are reviewed against §16.
- **Economy**: `tools/econ-sim` must hit the §8 targets for the current milestone's sources.
- **Art QA**: approvals in the review gallery; the generation budget is tracked in the manifest.

## 27. Open questions & user to-dos
**Open questions**
- Game name and the name of Set 1.
- Does the PixelLab allotment renew monthly?
- Do PixelLab's terms allow commercial use of the generated art and audio? (Check before monetising.)
- Which payment provider?
- Loot-box rules per region: odds disclosure is covered; age ratings and regional restrictions are not yet.
- Privacy policy and imprint for the public launch.
- Realm completion spread (econ-sim v0, T02): the medians hit the §8 targets (≈8 days for the 12 non-Mythic cards, ≈19 for the Mythic), but the p90 is ≈16 / 33 days, and crafting barely helps in M1 because only copies beyond 9 are dusted. Revisit when quests and the calendar are tuned.

**User to-dos** (when a task needs them)
- Create a Discord application for OAuth (T09; a guide will be in the README).
- Domain and SMTP provider (alpha deploy).
- Approvals: card list (T03), style anchors (T04), card art (T05), style tile (T06), idle-loop keep/scrap (T17).

## 28. Parked ideas
- Gilded, Celestial, Inverted and Full-Art variants.
- Marketplace or auction house.
- Pack Duels in live rooms.
- Installable app (PWA) with free-pack notifications.
- Live PvP and guilds.
- German localisation and gamepad support.
- A "realm of the day" bonus.

## 29. Decision log
| Date | Decision |
|---|---|
| 2026-11-23 | Web game (TypeScript, React + PixiJS), desktop-first and responsive, English only |
| 2026-11-23 | Cozy whimsical setting with five realms: Hearthfire, Tidepool, Mossgrove, Skyloft, Starhollow |
| 2026-11-23 | 6 rarities; Legendary and Mythic each get a unique reveal |
| 2026-11-23 | Variants Foil, Prismatic, Void, Glitch = cosmetic + tiny perk; Gilded/Celestial/Inverted/Full-Art later |
| 2026-11-23 | 5 realm packs (80 % own realm / 20 % any), Mythic pack, event packs, visible pity |
| 2026-11-23 | Featured slot 5 = Uncommon or better instead of a guaranteed Rare, so a specific card's chance always drops with rarity; 65-card set, 4/3/2/2/1/1 per realm |
| 2026-11-23 | Economy: 8 h free packs + gold + daily calendar + quests; premium gems later; 4–6 packs/day for free players |
| 2026-11-23 | Fusion is classic 3×3 (9 copies for ★3); the result inherits the best traits; no fusion fees |
| 2026-11-23 | Battle: Caravan March auto-battler with async PvP first; Gauntlet and Fair Play arena later |
| 2026-11-23 | In scope: Critter Village, collection log, pull history, share image, wishlist, mint numbers (Void/Glitch), First-Edition stamps per pack release season |
| 2026-11-23 | Not chosen (parked): Pack Duels, PWA/notifications |
| 2026-11-23 | Progression: account level + 8-week season pass; trading with light limits |
| 2026-11-23 | Onboarding: the first two packs are scripted (Epic, then Foil) |
| 2026-11-23 | Art: 64×64 art in a 96×128 frame; battle sprites always face east with a fixed animation spec; faint is procedural; Legendary/Mythic idle loops only if the T17 trial is consistent |
| 2026-11-23 | Login: email + password, and Discord |
| 2026-11-23 | Local first (Windows) with PGlite for dev; later the VPS with its own Postgres container behind the existing Cloudflare Tunnel; friends alpha after M3 |
| 2026-11-23 | Workflow: one task per Claude session; the docs in the repo are the shared memory |
| 2026-11-23 | T02: the 20 % "any enabled realm" share of a realm pack includes its own realm (own realm = 80 % + 20 %/n) |
| 2026-11-23 | T02: pity counters reset when a Legendary+ (or Mythic) appears in any slot; a forced Legendary+ featured slot rolls Legendary vs Mythic at their current weights |
| 2026-11-23 | T02: the Mythic soft-pity bonus (+1 pp/pack) is taken from the featured slot's lowest rarity (Uncommon), so Rare–Legendary odds stay unchanged |
| 2026-11-23 | T02: dusting a ★2/★3 copy gives its ★1-equivalents (×3/×9) times the ★1 value, so fusing never changes dust value |
| 2026-11-23 | T02: the collection score's +50 % for ★3 is rounded half up per entry (scores stay integers) |
| 2026-11-23 | T02: the pack RNG is Web Crypto `getRandomValues` with rejection sampling (same guarantee as `crypto.randomInt`, and the shared package stays isomorphic) |
