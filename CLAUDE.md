# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the game

Open `index.html` directly in a browser — no build step, no server needed. On Windows:

```
start index.html
```

Or drag `index.html` into a browser window.

## Architecture

Four files, no dependencies, no bundler:

| File | Role |
|------|------|
| `index.html` | Character-select landing page. Inline SVG art for each character. Clicking a card navigates to `game.html?character=peppa` or `game.html?character=suzy`. |
| `game.html` | Thin shell: sizes a full-window `<canvas>` and loads `game.js`. |
| `style.css` | Shared styles for the landing page only (Comic Sans, sky-gradient body, card hover animations). The game canvas is unstyled — all visuals are drawn in JS. |
| `game.js` | All game logic. No framework. |

## How game.js is structured

1. **Boot sequence** — canvas is sized, then `buildSprite()` converts an SVG string to an `Image` via a Blob URL. Only after that resolves does `init(true)` + `loop()` run.
2. **Character selection** — read once from `URLSearchParams` on load (`character = 'peppa' | 'suzy'`). Controls balloon/string colour via `BALLOON_COLOR` and `STRING_COLOR` maps.
3. **Physics constants** at the top — `GRAVITY`, `PADDLE_SPEED`, `PADDLE_W`, `BALLOON_RX/RY`. Tweak these to change feel.
4. **`init(fresh)`** — `fresh=true` resets score and randomises balloon starting velocity; `fresh=false` only resets paddle position (used nowhere currently, kept for resize safety).
5. **Game loop** — `requestAnimationFrame` calls `update()` then `draw()` every frame. `update()` skips when `gameOver=true`; `draw()` always runs so the game-over overlay is shown.
6. **Paddle collision zone** — the hit zone is the top 30 px of the character sprite, calculated as `canvas.height - GRASS_H - 110` (grass strip height + sprite height).
7. **Audio** — synthesised via Web Audio API in `playPop(score)`. Pitch rises with score (capped at 30 hits). No external audio files.
8. **`roundRect(ctx, x, y, w, h, r)`** — manual polyfill for the game-over modal; do not use `ctx.roundRect()` directly (browser support gap).

## Adding a new character

1. Add an SVG string constant (e.g. `BLUEY_SVG`) following the same 180×220 viewBox convention used by `PEPPA_SVG` / `SUZY_SVG`.
2. Add the character key to `BALLOON_COLOR` and `STRING_COLOR`.
3. Add a card `<a>` to `index.html` with `href="game.html?character=bluey"`.
4. Wire the SVG in the `buildSprite()` call at the bottom of `game.js`.
