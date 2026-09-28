class Checkbox {
	static BACKGROUND_OFF = '#660000';
	static BACKGROUND_ON  = '#ff3333';
	static TEXT_OFF       = '#ffffff';
	static TEXT_ON        = '#000000';
	static STROKE_NORMAL  = '#000000';
	static STROKE_HOVER   = '#ffffff';

	constructor(label, posX, posY, size, state) {
		this.label = label;
		this.posX  = posX;
		this.posY  = posY;
		this.size  = size;
		this.state = state;
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

	setState(state) {
		this.state = state;
	}

	getState() {
		return this.state;
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

	// mx/my omitted => icon mode (thumbnails), full mode otherwise
	draw(dx, dy, f, sf, mx, my) {
		const icon = mx === undefined;

		fill(this.state ? Checkbox.BACKGROUND_ON : Checkbox.BACKGROUND_OFF);
		if (icon) noStroke();
		else stroke(this.isOver(dx, dy, f, sf, mx, my) ? Checkbox.STROKE_HOVER : Checkbox.STROKE_NORMAL);
		ellipse(this.getPosX(dx, f), this.getPosY(dy, f), this.getSize(sf), this.getSize(sf));

		if (!icon) {
			fill(this.state ? Checkbox.TEXT_ON : Checkbox.TEXT_OFF);
			text(this.label, this.getPosX(dx, f), this.getPosY(dy, f));
		}
	}
}
