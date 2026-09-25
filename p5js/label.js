// Port of Processing/LED_Editor/Label.java

class Label {
	static BACKGROUND    = '#336699';
	static TEXT          = '#000000';
	static STROKE_NORMAL = '#000000';

	constructor(label, posX, posY, sizeX, sizeY) {
		this.label = label;
		this.posX  = Math.round(posX);
		this.posY  = Math.round(posY);
		this.sizeX = Math.round(sizeX);
		this.sizeY = Math.round(sizeY);
	}

	setLabel(label) {
		this.label = label;
	}

	draw() {
		fill(Label.BACKGROUND);
		stroke(Label.STROKE_NORMAL);
		rect(this.posX - this.sizeX / 2, this.posY - this.sizeY / 2, this.sizeX, this.sizeY);

		fill(Label.TEXT);
		text(this.label, this.posX, this.posY);
	}
}
