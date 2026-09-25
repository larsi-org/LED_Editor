// Port of Processing/LED_Editor/Button.java

class Button {
	static BACKGROUND    = '#336699';
	static TEXT          = '#000000';
	static STROKE_NORMAL = '#000000';
	static STROKE_HOVER  = '#ffffff';

	constructor(label, posX, posY, sizeX, sizeY, hotkey) {
		this.label  = label;
		this.posX   = posX;
		this.posY   = posY;
		this.sizeX  = sizeX;
		this.sizeY  = sizeY;
		this.hotkey = hotkey;
	}

	isOver(x, y) {
		return Math.abs(x - this.posX) <= this.sizeX / 2 && Math.abs(y - this.posY) <= this.sizeY / 2;
	}

	draw(mx, my) {
		fill(Button.BACKGROUND);
		stroke(this.isOver(mx, my) ? Button.STROKE_HOVER : Button.STROKE_NORMAL);
		rect(this.posX - this.sizeX / 2, this.posY - this.sizeY / 2, this.sizeX, this.sizeY);

		fill(Button.TEXT);
		text(this.label, this.posX, this.posY);
	}
}
