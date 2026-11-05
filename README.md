# Mint & Malice

A satirical 2D management / scam simulator about running a rogue trading-card shop. It's built for **iOS Mobile Safari** in portrait: no install, touch-first, HTML5 Canvas plus the Web Audio API.

Weigh booster packs to find the hits, strip them out, reseal the duds and forge holo cards. Sell all of it to the right customers, and don't let the 🔥 **Heat** reach 100%.

> All franchises (Chokémon, Tragic: The Hoarding, Y-U-No-Pay) are parodies. This is satire. Please don't actually do any of this.

## Running it

It's plain static files with no build step. ES modules need to be served over HTTP:

```sh
npx http-server -c-1 .        # or: python3 -m http.server
```

Then open `http://<your-ip>:8080` in Safari on an iPhone (or any browser at phone width). For an app-like full-screen version, use Share → *Add to Home Screen*.

GitHub Pages works too. Point it at the repo root.

## How to play

New players get a short briefing and a 10-step guided tutorial that walks through one full loop: sell, weigh, crack, reseal, resell. Replay it any time from the **?** button in the top bar.

| Hub | What you do |
| --- | --- |
| 🏪 **Shop** (Front Counter) | Serve a queue of customers. Each archetype has a different detection risk. Pick which product to hand over, gaslight your way out when caught, run sleight-of-hand swaps on trade-ins, buy stock from the supplier and close up to end the day. |
| 🧪 **Bench** (Backroom) | The scam pipeline on a full-bleed canvas: **Weigh** (drag packs onto the scale, then sort them into the heavy or dud bin) → **Crack** (swipe across the crimp, pocket the hit) → **Crimp** (drag the heat iron along the seam; too fast = loose, too slow = burnt) → **Forge** (align the foil with drag/pinch/twist, rub to emboss, sponge the edges to age the card). |
| 📱 **Web** (ScamBay) | A fresh batch of wholesale lots each morning: set a max bid, and the winners ship in 1–2 days. Low-rated sellers are cheap but may send searched boxes or fake singles. List items in limited slots at Quick, Market or Greedy prices. Run one live-stream "break" a day. |
| 🌳 **Tree** (Underground) | Four-tier upgrade branches (Equipment, Art, Hustle), plus PR cover-ups, a corrupt lawyer on retainer, and settings. |

**The day is the turn.** Customers are finite each day, and everything that brings in stock or money happens overnight:

* Supplier orders arrive the next morning. Distributors allocate a limited number of boxes per set per day.
* ScamBay auctions close when you end the day, and won lots ship in 1–2 days.
* ScamBay listings may sell overnight. Cheaper asks and a higher seller rating sell faster. A buyer who spots a fake files a claim: you get no money, your rating drops and Heat rises.
* Card prices drift each day per set, with the occasional hype spike or crash.

**Sets and cards.** There are five sets with 104 original cards in total (20–24 per set), satirising the hobby itself: scalpers, graders, influencers, "investors", power creep and reprints. Every card has procedurally drawn artwork (`js/art.js`), each franchise has its own card layout (`js/cardface.js`), and the rosters are in `js/cards.js`:

| Set | Store level | Layout | Dud | Hit | Hit rate |
| --- | --- | --- | --- | --- | --- |
| Chokémon (1999) | 1 | HP, type, attack, flavour text | 20.88g | 21.45g | 22% |
| Y-U-No-Pay (2002) | 2 | Level stars, ATK/DEF, monster/spell/trap frames | 18.62g | 18.98g | 18% |
| Tragic: The Hoarding (1993) | 3 | Mana cost, type line, rules text, power/toughness | 26.10g | 26.36g | 14% |
| Chokémon: Neon Gutter (2001) | 4 | Neon city expansion | 19.40g | 19.82g | 20% |
| Cryptid Clash (2004) | 5 | Case-file dossiers with threat level and habitat | 22.70g | 22.92g | 12% |

Each card has a Holo, Ultra or Secret rarity. Variants such as 1st Edition, Shadowless, Misprint, Ghost Rare, Alpha, Foil, Reverse Holo, Error Stamp, Blurry Photo and Classified change both a card's value and how it looks. Graded cards are shown in a slab. The 📖 Card index in the Binder tracks which cards you've owned.

**Minigames**

| Where | Minigame | What it does |
| --- | --- | --- |
| Counter | 🤝 Haggle | Tap 🤝 next to an offer, then drag the price dial while the customer's face reacts. Push too far and they walk. |
| Counter | 🎲 Kid's pick | A kid insists on choosing their own pack. Swap packs while they look away to keep your heavy pack out of their hands. |
| Counter | 🗣️ Talk your way out | When a customer catches you: three timed accusations and a suspicion meter. Contradict your own story and it backfires. |
| Counter | 🥁 Distraction | A rhythm game before a sleight-of-hand swap. Good timing widens the swap wheel's green zone. |
| Bench | 👆 Feel | Rub a sealed pack to feel for the foil ridge. Quicker than the scale, but less reliable. |
| Bench | ♨️ Steam open | Hold to heat the kettle and keep it in the green band. A clean job adds a bonus to the reseal. |
| Bench | ⚖️ Balance | An emptied pack is a card's weight light. Drag shims onto it until it matches the set's dud weight within ±0.05g. |
| Binder | ✂️ Trim | Shave borders to improve centering and value. Trim over 1mm and the card is undersized, which experts notice. |
| Binder | 🏅 Grading | Send cards to the grader (results come back after 1–3 days). Graders catch trims; sneak a fake in for a slab. |
| ScamBay | 📸 Photo | Position the lamp for the listing photo. A good photo sells faster and hides a fake's flaws. |
| ScamBay | ⏱️ Live ending | Some lots end live: last bid wins, and rivals can't answer a bid made in the final half-second. |
| ScamBay | 🔴 Stream | Tap ❤️ on hype, answer questions, and delete suspicious comments before they spread. |
| ScamBay | 🔍 Returns | A buyer sends a card back. Spot the differences and decide whether it's really yours. |
| Raid | 🚨 Cleanup | Trading Standards are at the door. Drag the evidence into hiding spots before time runs out. |
| Underground | 💵 Bribe | Read the inspector's face and offer the right amount for −25% Heat. Once a day. |
| Underground | ✍️ Shill reviews | Build a believable fake 5-star review from word tiles for up to −10% Heat. Once a day. |

**Forgery grade** = Alignment × 0.40 + Texture × 0.35 + Art Skill × 0.25. That total is then multiplied by an aging-match factor (a mismatch of more than ±8 wear points costs up to 40%).
At ≥ 90% a forgery fools grading houses. From 65% to 89% it fools parents and casual buyers. Below 65% it fails instantly, triggering a chargeback and +25% heat.

**Heat tiers**

* 0–25%, Safe: business as usual.
* 26–50%, Suspicious: ScamBay holds 20% of revenue, and refund demands show up at the counter.
* 51–80%, Severe: a streamer exposé halves foot traffic, and heat no longer cools overnight unless you pay for PR.
* 81–100%, Critical: Trading Standards raid at closing. You pay heavy fines and lose seized stock, and if you can't pay the fine it's game over, unless you have a lawyer or a fall-guy.

## Code map

```
index.html            portrait shell: HUD, four hub views, bottom nav, splash
css/style.css         100dvh layout, safe-area insets, 44px+ touch targets
js/main.js            boot, navigation, HUD, day cycle, heat escalation, raids
js/state.js           game state, localStorage save, event bus, money/heat helpers
js/data.js            sets, archetypes, upgrade trees, tuning constants
js/rules.js           detection-risk maths, gaslighting odds, hit rarity
js/shop.js            Front Counter
js/bench.js           Bench canvas host + Weigh / Crack / Crimp stations
js/forge.js           3-step Forgery Engine
js/swap.js            Sleight-of-Hand tap wheel
js/scambay.js         ScamBay app
js/tree.js            Underground upgrade tree & services
js/input.js           touchstart/move/end (+ mouse) → canvas pointers, multi-touch
js/audio.js           Web Audio synth SFX, unlocked on first gesture
js/draw.js            canvas primitives (packs, cards, workbench)
js/art.js             procedural card illustrations (bodies, extras, backdrops)
js/cardface.js        franchise card layouts, variants, slabs, bitmap cache
js/cards.js           card rosters for all five sets
js/binder.js          binder, card viewer, card index, grading
js/games/             minigames on a shared overlay
```

Safari specifics: the viewport is locked with `100dvh` and `user-scalable=no`, and `gesturestart` is suppressed so the page itself never zooms. Canvas touch handlers are non-passive and call `preventDefault`. Web Audio is unlocked with a silent buffer on the first tap. `navigator.vibrate` isn't available on iOS, so haptics fall back to a screen pulse plus a low audio thump.
