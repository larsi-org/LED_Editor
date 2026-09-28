// Reads a CSS custom property from :root (led-editor.css) - the one shared color palette for
// both this stylesheet's own rules and the p5 canvas, so a color only ever needs changing in
// one place. Called fresh on every Led.backgroundColor()/textColor()/strokeColor() call
// below rather than cached once - measured directly (performance.now(), 60 simulated frames)
// rather than assumed: even the densest real layout (led_25x25, 625 LEDs) costs ~0.9ms/frame
// this way, cube N=10 (1000 LEDs, the densest a live builder can produce) ~1.6ms/frame - both
// comfortably under the 16.7ms budget a 60fps frame has to work with, so there's no need to
// cache these across calls just to save a getComputedStyle() that isn't actually expensive
// here (a page this static has no pending style/layout work forcing a real recalc on each
// call - the cost that same lookup can have on a large, frequently-mutating page).
function cssVar(name) {
	return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

class Led {
	// lit: this LED's current on/off state (draw()'s state/states[][] elsewhere in the app -
	// "lit" reads more naturally for "which of these two colors" than "state" does). Reads
	// led-editor.css's custom properties fresh on every call rather than caching them once -
	// see cssVar()'s own comment for why that's cheap enough here to not bother.
	static backgroundColor(lit) {
		return lit ? cssVar('--led-bg-on') : cssVar('--led-bg-off');
	}

	static textColor(lit) {
		return lit ? cssVar('--led-text-on') : cssVar('--led-text-off');
	}

	// hovered: the mouse is currently over this LED (isOver() below).
	static strokeColor(hovered) {
		return hovered ? cssVar('--led-stroke-hover') : cssVar('--led-stroke-normal');
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
