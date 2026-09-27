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

The landing layout defaults to `hex10`, but `?layout=<name>.json` in the
URL overrides it - e.g. `?layout=led_7x7.json` opens straight on the LED
Coffee Table's layout. Handled entirely client-side (`sketch.js` reads
`location.search` itself), so it works the same whether the page is served
by `python3 -m http.server` here or by `index.php` on larsi.org. Every
larsi.org page for a real piece of hardware links in with its own layout
this way instead of leaving the visitor to pick it from the dropdown:

| Page | `?layout=` |
| --- | --- |
| [make/Schneeflocke](https://larsi.org/make/Schneeflocke/) | `hex10.json` |
| [make/LedCube3](https://larsi.org/make/LedCube3/) | `cube3.json` |
| [make/led_6x5](https://larsi.org/make/led_6x5/) | `led_6x5.json` |
| [make/CoffeeTable](https://larsi.org/make/CoffeeTable/) | `led_7x7.json` |
| [electronics/ATtinyX5/hex3](https://larsi.org/electronics/ATtinyX5/hex3/) | `led_hex3.json` |
| [electronics/ATtinyX5/led5](https://larsi.org/electronics/ATtinyX5/led5/) | `led_5x1.json` |
| [electronics/ATtinyX5/led20](https://larsi.org/electronics/ATtinyX5/led20/) | `led_20x1.json` |
| [electronics/ATmegaX8/led5](https://larsi.org/electronics/ATmegaX8/led5/) | `led_5x1.json` |
| [electronics/ATmegaX8/led8](https://larsi.org/electronics/ATmegaX8/led8/) | `led_8x1.json` |
| [electronics/ATmegaX8/Peggy2LE](https://larsi.org/electronics/ATmegaX8/Peggy2LE/) | `led_25x25.json` |

(ATtinyX5/led5 and ATmegaX8/led5 intentionally share `led_5x1.json` - both
are a plain 5-LED row, just on different chips. make/'s own gallery tile
for the editor links with no `?layout=` at all, since it's the tool's
generic entry point, not tied to one project.)

No generator scripts anymore - **Circle (Custom)**, **Hex (Custom)**, and
**Matrix (Custom)** in the Layout dropdown build any size live (see below),
so there's nothing left to commit a file for most shapes. The `led_*` files
are exceptions: real hardware, kept as checked-in files so each layout
doesn't depend on someone rebuilding it with the right settings -
[LED 6x5 Shield](https://larsi.org/make/led_6x5) (`led_6x5`: W=6, H=5,
Zigzag off), [LED Coffee Table](https://larsi.org/make/CoffeeTable)
(`led_7x7`: W=7, H=7, Zigzag on - matching each project's actual wiring
order), and five older electronics boards (single strips, one hex, one
square matrix) -
[ATtinyX5/hex3](https://larsi.org/electronics/ATtinyX5/hex3/) (`led_hex3`:
Hex N=3, Zigzag off - a static Charlieplexed hexagon, not a wired strip),
[ATtinyX5/led5](https://larsi.org/electronics/ATtinyX5/led5/) and
[ATmegaX8/led5](https://larsi.org/electronics/ATmegaX8/led5/) (`led_5x1`),
[ATmegaX8/led8](https://larsi.org/electronics/ATmegaX8/led8/) (`led_8x1`),
[ATtinyX5/led20](https://larsi.org/electronics/ATtinyX5/led20/)
(`led_20x1`), and [Peggy 2LE](https://larsi.org/electronics/ATmegaX8/Peggy2LE/)
(`led_25x25`: W=25, H=25, Zigzag off). All were produced by the live
builder then **Export Layout**, not hand-written - same as `cube3`, which
has no live builder equivalent since it needs a `lines` list a flat shape
doesn't.
Only two `hex*` presets stay checked in now: `hex10` (real hardware -
[Schneeflocke](https://larsi.org/make/Schneeflocke)) and `hex3` (kept as a
small example, since it's the size most likely to get poked at first). The
rest (`hex4`-`hex9`, `hex11`-`hex13`) were removed once Hex (Custom) could
reproduce any of them live, same reasoning that removed all the `circle*`
presets - none of them were tied to real hardware either.

## Circle (Custom)

Builds N rings (plus a center LED) live, in memory, growing outward - ring
`c` gets `6c` LEDs, evenly spaced. N from 3 to 20. No zigzag option: unlike
a row-by-row shape, going around each ring in one direction is already a
sensible order to solder in.

## Hex (Custom)

Builds a hexagon live: `2N-1` rows, widest in the middle, narrowing N-1
LEDs at a time toward each point. N from 3 to 20. **Zigzag** mirrors every
other row so LED numbering snakes back and forth (row 0 left-to-right, row
1 right-to-left, ...) instead of always running left-to-right, matching
how an LED strip is usually wired - continuing straight into the next row
rather than a long return wire back to the start of each one. On by
default (every checked-in `hex*` layout was built this way).

## Matrix (Custom)

Builds a rectangular grid live. Width and height each 1-32; **Zigzag**
works the same way as Hex's, but off by default - most checked-in `led_*`
grids were built without it, `led_7x7` (LED Coffee Table) being the one
exception that needs it checked.

Both axes share one pitch (the larger dimension sets it), so LEDs are
evenly spaced even when width and height differ, rather than stretched to
fill a square. Wire lines are drawn across every row and down every column.

## Symmetry, for all three builders

None of the three save anything to a file on their own - use **Export
Layout** (`e`) to grab one yourself. All three also compute `symmetry`
(see "Layout file format" below) from the shape's actual geometry, not
its row/column/ring index, so it's already correct under Hex/Matrix's
Zigzag without needing to special-case it - the same principle
`create_hex_circle.py` used to follow (matching real coordinates, not
array position) before it was replaced by this.

- **Circle/Hex**: both are rings of points around a center, which always
  has the full 12-element dihedral group available (6 rotations, each
  paired with a mirror) - a generic point's orbit uses all 12; a point
  that already sits on a mirror line (or is the center itself) has a
  smaller one.
- **Matrix**: horizontal flip, vertical flip, and 180° rotation always
  apply to any rectangle; a square additionally gets both diagonal flips
  and both 90° rotations, since only then does swapping the two axes map
  the grid back onto itself ("n×n has the most symmetry, n×m loses half,
  1×n keeps only first↔last, second↔second-to-last, ...").

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
  state - a cycle, not just a pair (hex/circle layouts have up to 12-way
  symmetry near the center, a rectangular grid up to 8-way - see "Symmetry,
  for all three builders" below). Omitted entirely when no LED has a
  partner (`cube3` only, among the checked-in layouts).
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
  contents instead - the only way to keep a layout built with **Circle**,
  **Hex**, or **Matrix (Custom)**, since those are never written to a file
  on their own
