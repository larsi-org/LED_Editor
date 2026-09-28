# layouts/

Empty as of 2026-09-28. Every file that used to live here (`cube3`, `hex3`,
`hex10`, `led_6x5`, `led_7x7`, `led_5x1`, `led_8x1`, `led_20x1`,
`led_25x25`) turned out to be either an exact match for its live builder's
output, or (`cube3` specifically) close enough that the builder was chosen
as the single source going forward instead - see the main README's
"?layout=`<name>.json`" section for the comparison that confirmed this.
Every real-hardware project page now links in with `?builder=` instead.

Drop a `<name>.json` file here (see the main README's "Layout file format"
section) and add a matching entry to `sketch.js`'s `LAYOUTS` array whenever
a genuinely hand-edited layout - one no live builder can reproduce - needs
one again. Both `?layout=<name>.json` and `loadLayout()` stay fully wired
up for this; nothing else needs to change.
