# Processing

`LED_Editor/` is a minimalistic [Processing](https://processing.org/) sketch
for laying out LED animation frames by hand: click LEDs on/off, step through
frames, and export the result as rows of `0`/`1` bits to paste into Arduino
firmware.

## Layout

- `LED_Editor.pde` - the sketch. Set `DIRECTORY` at the top to pick which LED
  layout to edit (a folder name under `data/`), then run in the Processing IDE.
- `Button.java` / `Checkbox.java` / `Label.java` - small UI widget helpers
  used by the sketch.
- `data/<layout>/` - one folder per supported LED layout:
  - `coords.txt` - tab-separated `name\tx\ty\tradius` per LED, normalized to
    roughly `[-1, 1]`
  - `symmetry.txt` - one line per LED, the index of its mirror partner (used
    so a left-click toggles both LEDs of a symmetric pair at once; a line
    that just repeats its own index has no symmetry partner)
  - `lines.txt` (only present for `cube3`) - pairs of LED indices to draw as
    connecting wires, since the cube isn't a flat grid
- `create_matrix.py` - generates `coords.txt`/`symmetry.txt` for the
  rectangular grid layouts (`led_5`, `led_8`, ..., `led_16x16`)
- `create_hex_circle.py` - generates `coords.txt`/`symmetry.txt` for the
  hexagonal (`hex3`-`hex13`) and circular (`circle3`-`circle13`) layouts
- `Univers45.vlw` - the sketch's Processing font

`led_6x5` and `cube3` were hand-authored rather than generated (cube3 also
needs `lines.txt`, which neither generator script produces).

## Controls

- Left-click an LED to toggle it (and its symmetric partner, if any); right-click
  toggles just that one LED, ignoring symmetry
- `,` / `.` - previous / next frame
- `[` / `]` - insert a blank frame before / after the current one
- Delete - remove the current frame
- `c` / `v` - copy / paste the current frame
- Space - clear the current frame
- `i` - invert the current frame
- `r` - flip a random LED (and its symmetric partner, if any)
- `g` - print the whole animation (every frame, every LED, as `0`/`1`) to the
  console
- `q` - quit
