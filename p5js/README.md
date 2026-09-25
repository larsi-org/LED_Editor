# p5js

A [p5.js](https://p5js.org/) port of `Processing/LED_Editor`, so it runs in a
browser tab instead of the Processing IDE. Functionally a 1:1 port -
`sketch.js`/`checkbox.js`/`button.js`/`label.js` mirror
`LED_Editor.pde`/`Checkbox.java`/`Button.java`/`Label.java` - plus two things
the Processing version didn't need:

- a **Layout** dropdown (Processing picked the layout by editing a `DIRECTORY`
  constant and re-running; here it's a runtime fetch instead)
- **Generate** now opens a text box with a "Copy to clipboard" button, instead
  of printing to the Processing console

The Processing version's `q` "Quit" button was dropped - there's no
equivalent for a browser tab.

This folder has no `data/` of its own - it fetches layouts straight from
`../Processing/LED_Editor/data/<layout>/` to avoid keeping two copies of ~30
layout folders in sync. That means it has to be served over HTTP, not opened
directly as a `file://` URL (browsers block `fetch()` of local files). From
the repo root:

```bash
python3 -m http.server
```

then open `http://localhost:8000/p5js/`.

## Controls

Same as `Processing/LED_Editor` (see its README) - left-click an LED toggles
it and its symmetric partner(s), right-click ignores symmetry, `,`/`.` step
frames, `[`/`]` insert, Delete removes, `c`/`v` copy/paste, Space clears,
`i` inverts, `r` randomizes, `g` generates.
