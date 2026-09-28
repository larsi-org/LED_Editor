class Led {
	static BACKGROUND_OFF = '#660000';
	static BACKGROUND_ON  = '#ff3333';
	static TEXT_OFF       = '#ffffff';
	static TEXT_ON        = '#000000';
	static STROKE_NORMAL  = '#000000';
	static STROKE_HOVER   = '#ffffff';

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
		fill(state ? Led.BACKGROUND_ON : Led.BACKGROUND_OFF);
		stroke(this.isOver(dx, dy, f, sf, mx, my) ? Led.STROKE_HOVER : Led.STROKE_NORMAL);
		ellipse(this.getPosX(dx, f), this.getPosY(dy, f), this.getSize(sf), this.getSize(sf));

		fill(state ? Led.TEXT_ON : Led.TEXT_OFF);
		text(this.label, this.getPosX(dx, f), this.getPosY(dy, f));
	}
}
