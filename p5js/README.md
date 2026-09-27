# p5js

A [p5.js](https://p5js.org/) app for laying out LED animation frames by hand:
click LEDs on/off, step through frames, and export the result as bitmap rows
to paste into Arduino firmware. Originally a port of a Processing sketch, but
the Processing version was removed once this one had full feature parity -
this is now the only editor in the repo.

Only the LED grid itself is drawn on `<canvas>` (`checkbox.js`'s `Checkbox`
class) - the toolbar (layout picker, frame nav, clipboard, generate, ...) is
real HTML in `index.html`, each button wired straight to `executeKey()` in
`sketch.js`. That used to all be canvas-drawn too (a literal port of
Processing's button-widget classes, which don't exist in the browser's DOM),
but there's no reason to hand-roll buttons when p5.js runs happily alongside
real ones - real `<button>`s get native hover/focus/keyboard handling for
free, and don't need per-frame hit-testing against the mouse position.

Must be served over HTTP, not opened directly as a `file://` URL (browsers
block `fetch()` of local files). From the repo root:

```bash
python3 -m http.server
```

then open `http://localhost:8000/p5js/`.

## Layout

- `index.html` / `style.css` - the toolbar and page chrome
- `sketch.js` / `checkbox.js` - the app logic and the LED grid's canvas drawing
- `layouts/<name>.json` - one file per supported LED layout, fetched at
  runtime by the **Layout** dropdown; see "Layout file format" below
- `create_hex_circle.py` - generates `layouts/hex*.json`/`layouts/circle*.json`
  for the hexagonal (`hex3`-`hex13`) and circular (`circle3`-`circle13`)
  layouts

Rectangular grids don't have a generator script anymore - **Matrix
(Custom)** in the Layout dropdown builds any size live (see below), so
there's nothing left to commit a file for. `led_6x5` and `led_7x7` are the
exceptions: real hardware (the [LED 6x5 Shield](https://larsi.org/make/led_6x5)
and [LED Coffee Table](https://larsi.org/make/CoffeeTable)), kept as
checked-in files so the layout doesn't depend on someone rebuilding it with
the right settings. Both were produced by the same live builder (6x5:
W=6, H=5, Zigzag off; 7x7: W=7, H=7, Zigzag on - matching each project's
actual wiring order - then **Export Layout**), not hand-written - same as
`cube3`, which also has no generator since it needs a `lines` list neither
script produces.

## Matrix (Custom)

Builds a rectangular grid live, in memory - nothing is saved to a file
unless you use **Export Layout** (`e`) to grab it yourself. Width and
height each 1-32; **Zigzag** mirrors every other row so LED numbering
snakes back and forth (row 0 left-to-right, row 1 right-to-left, ...)
instead of always running left-to-right, matching how an LED strip is
usually wired - continuing straight into the next row rather than a long
return wire back to the start of each one. Off by default.

Both axes share one pitch (the larger dimension sets it), so LEDs are
evenly spaced even when width and height differ, rather than stretched to
fill a square. Wire lines are drawn across every row and down every
column. Symmetry is computed too: horizontal flip, vertical flip, and
180° rotation always apply; a square additionally gets both diagonal
flips and both 90° rotations (only then does swapping the two axes map
the grid back onto itself); a 1-wide or 1-tall strip degenerates to just
one reversal (first↔last, second↔second-to-last, ...).

## Layout file format

```json
{
  "leds": [{ "x": -1, "y": -1, "r": 0.1 }, ...],
  "symmetry": [9, 8, 7, ...],
  "lines": [[0, 2], [3, 5], ...]
}
```

- `leds` - one entry per LED, in display-number order (LED 1 is `leds[0]`,
  etc.). `x`/`y` are position, normalized to roughly `[-1, 1]` (canvas center
  is `(0, 0)`, edge is `±1`); `r` is the LED's dot size on that same scale.
- `symmetry` - optional. `symmetry[i]` is "the next LED in LED `i`'s
  mirror-symmetry group": a left-click toggles LED `i`, then walks
  `j = symmetry[j]` until it loops back to `i`, setting each one to `i`'s new
  state - a cycle, not just a pair (hex/circle layouts have up to 6-way
  rotational symmetry near the center; a rectangular grid has up to 8-way,
  see "Matrix (Custom)" below). Omitted entirely when no LED has a partner
  (`cube3` only, among the checked-in layouts).
- `lines` - optional. Each entry is a `[i0, i1]` pair of 0-based LED indices
  to draw a connecting wire between. `cube3` needs it because the cube isn't
  a flat convex shape, so the physical wiring can't be inferred just from
  LED positions the way it can for a flat grid/hex/circle; a rectangular
  grid's rows/columns get one each too (see "Matrix (Custom)" below).

## Controls

Left-click an LED to toggle it (and its symmetric partner, if any); uncheck
the toolbar's **Symmetry** checkbox (on by default), or right-click, to
toggle just that one LED. Random respects the checkbox too; right-click
always ignores symmetry regardless of it.

- `,` / `.` - previous / next frame
- `[` / `]` - insert a blank frame before / after the current one
- Delete - remove the current frame
- `c` / `v` - copy / paste the current frame
- Space - clear the current frame
- `i` - invert the current frame
- `r` - flip a random LED (and its symmetric partner, if any)
- `g` - open a text box with the whole animation (every frame, every LED, as
  `0`/`1`) and a "Copy to clipboard" button
- `e` - open the same text box with the current layout's own `layouts/*.json`
  contents instead - the only way to keep a layout built with **Matrix
  (Custom)**, since those are never written to a file on their own
