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

**Sets and cards.** Each set has its own pack weights and hit rate, and later sets have a smaller gap between a dud and a hit. The reference weights are shown under the scale. Each set has 8 chase cards across Holo, Ultra and Secret rarities, plus variants such as 1st Edition, Shadowless, Ghost Rare, Alpha and Misprint that multiply value.

| Set | Dud | Hit | Hit rate |
| --- | --- | --- | --- |
| Chokémon | 20.88g | 21.45g | 22% |
| Y-U-No-Pay | 18.62g | 18.98g | 18% |
| Tragic: The Hoarding | 26.10g | 26.36g | 14% |

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
```

Safari specifics: the viewport is locked with `100dvh` and `user-scalable=no`, and `gesturestart` is suppressed so the page itself never zooms. Canvas touch handlers are non-passive and call `preventDefault`. Web Audio is unlocked with a silent buffer on the first tap. `navigator.vibrate` isn't available on iOS, so haptics fall back to a screen pulse plus a low audio thump.
