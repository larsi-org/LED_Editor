# Arduino

Firmware for the shields in `Eagle/`: [LED 6x5](https://larsi.org/make/led_6x5)
and [LED Cube3](https://larsi.org/make/LedCube3). Both projects' write-ups on
larsi.org point here for the sketch source, but the sketches themselves were
never committed to this repo (the "Arduino Code" section on both pages is
empty too) - see each subfolder's README.

Each sketch reads a bitmap animation exported by the `p5js/` app's Generate
command: one line per frame, one `0`/`1` character per LED in the order it
appears in that layout's `p5js/layouts/<layout>.json`.
