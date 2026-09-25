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

	isOver(dx, dy, f, mx, my) {
		const x = mx - this.getPosX(dx, f);
		const y = my - this.getPosY(dy, f);
		const r = this.getSize(f) / 2;
		return x * x + y * y <= r * r;
	}

	// mx/my omitted => icon mode (thumbnails), full mode otherwise
	draw(dx, dy, f, mx, my) {
		const icon = mx === undefined;

		fill(this.state ? Checkbox.BACKGROUND_ON : Checkbox.BACKGROUND_OFF);
		if (icon) noStroke();
		else stroke(this.isOver(dx, dy, f, mx, my) ? Checkbox.STROKE_HOVER : Checkbox.STROKE_NORMAL);
		ellipse(this.getPosX(dx, f), this.getPosY(dy, f), this.getSize(f), this.getSize(f));

		if (!icon) {
			fill(this.state ? Checkbox.TEXT_ON : Checkbox.TEXT_OFF);
			text(this.label, this.getPosX(dx, f), this.getPosY(dy, f));
		}
	}
}
