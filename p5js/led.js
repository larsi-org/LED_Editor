// Reads a CSS custom property from :root (led-editor.css) - the one shared color palette for
// both this stylesheet's own rules and the p5 canvas, so a color only ever needs changing in
// one place. Safe to call at plain top-level script scope (not just inside setup()): the
// <link> to led-editor.css sits in <head>, loaded and parsed long before this bundle's
// <script> (in $foot_extra, near the end of the page) ever runs, so the computed value is
// already correct by the time any of this file's static fields evaluate. A plain `function`
// declaration (not `const`), and therefore hoisted - callable from led.js's own static fields
// even though this sits above them textually only by coincidence, not by requirement.
function cssVar(name) {
	return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

class Led {
	// The six raw colors, read once from led-editor.css's :root palette - private, since no
	// caller ever wants one of these on its own, only picked by lit/hovered state via the
	// three static methods below.
	static #backgroundOff = cssVar('--led-bg-off');
	static #backgroundOn  = cssVar('--led-bg-on');
	static #textOff       = cssVar('--led-text-off');
	static #textOn        = cssVar('--led-text-on');
	static #strokeNormal  = cssVar('--led-stroke-normal');
	static #strokeHover   = cssVar('--led-stroke-hover');

	// lit: this LED's current on/off state (draw()'s state/states[][] elsewhere in the app -
	// "lit" reads more naturally for "which of these two colors" than "state" does).
	static backgroundColor(lit) {
		return lit ? Led.#backgroundOn : Led.#backgroundOff;
	}

	static textColor(lit) {
		return lit ? Led.#textOn : Led.#textOff;
	}

	// hovered: the mouse is currently over this LED (isOver() below).
	static strokeColor(hovered) {
		return hovered ? Led.#strokeHover : Led.#strokeNormal;
	}

	constructor(label, posX, posY, size) {
		this.label = label;
		this.posX  = posX;
		this.posY  = posY;
		this.size  = size;
	}

	getPosX(dx, f) {
		return Math.round(dx + f * this.posX);
	}

	getPosY(dy, f) {
		return Math.round(dy + f * this.posY);
	}

	getSize(f) {
		return Math.round(f * this.size);
	}

	// f positions the LED (spacing between LEDs); sf sizes it (circle diameter) - these are
	// the same value everywhere except the main view while it's zoomed, where f grows with
	// the zoom (spreading LEDs apart) but sf deliberately doesn't (see drawLEDs()'s own
	// comment on why: zooming in is supposed to make dense LEDs easier to pick apart from
	// each other, which needs more space *between* them, not bigger circles - scaling both
	// together would just be a uniform magnification that leaves them exactly as hard to
	// tell apart as before).
	isOver(dx, dy, f, sf, mx, my) {
		const x = mx - this.getPosX(dx, f);
		const y = my - this.getPosY(dy, f);
		const r = this.getSize(sf) / 2;
		return x * x + y * y <= r * r;
	}

	// state is passed in rather than stored on the instance - states[currentFrame][i]
	// (sketch.js) is already the one source of truth for on/off, so caching a copy here too
	// would just be a second place it could (in principle) drift out of sync for no benefit.
	//
	// Thumbnails no longer render through here (see sketch.js's renderThumb(), which draws
	// its own plain filled circles into a cached offscreen buffer instead) - this is always
	// the main, interactive view now, so there's no more icon-mode branch to skip
	// stroke/hover/label for.
	draw(state, dx, dy, f, sf, mx, my) {
		fill(Led.backgroundColor(state));
		stroke(Led.strokeColor(this.isOver(dx, dy, f, sf, mx, my)));
		ellipse(this.getPosX(dx, f), this.getPosY(dy, f), this.getSize(sf), this.getSize(sf));

		fill(Led.textColor(state));
		text(this.label, this.getPosX(dx, f), this.getPosY(dy, f));
	}
}
