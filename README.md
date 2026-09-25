# LED_Editor

Design files and tooling for a few LED animation projects: an addressable-LED
cube, an LED shield, and an addressable-LED snowflake. Each project's write-up
(build photos, parts list, background) lives on [larsi.org](https://larsi.org):

- [LED Cube3](https://larsi.org/make/LedCube3) - a 3x3x3 cube of individually
  wired LEDs, driven from a custom Arduino shield
- [LED 6x5 Shield](https://larsi.org/make/led_6x5) - a 6x5 grid of LEDs on a
  custom Arduino shield
- [Schneeflocke (Hex10)](https://larsi.org/make/Schneeflocke) - a hexagonal
  snowflake built from WS2812B addressable LED strip on a wooden board

## Layout

- `Processing/` - a small Processing app for laying out LED animation frames
  by hand and exporting them as bitmaps; see its own README
- `p5js/` - a p5.js port of the Processing app, runs in a browser; see its
  own README
- `Eagle/` - schematic and board files for the LED_6x5 and LED_Cube3 shields
- `Arduino/` - firmware for the shields (see caveat in its own README)
