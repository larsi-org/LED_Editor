import processing.core.*;
import java.lang.Math;

public class Checkbox
{
	// colors
	public static int BACKGROUND_OFF = 0xFF660000;
	public static int BACKGROUND_ON  = 0xFFFF3333;
	public static int TEXT_OFF       = 0xFFFFFFFF;
	public static int TEXT_ON        = 0xFF000000;
	public static int STROKE_NORMAL  = 0xFF000000;
	public static int STROKE_HOVER   = 0xFFFFFFFF;

	private String  label = "";
	private float   posX  = 0;
	private float   posY  = 0;
	private float   size  = 1;
	private boolean state = false;

	public Checkbox(String label, float posX, float posY, float size, boolean state)
	{
		this.label = label;
		this.posX  = posX;
		this.posY  = posY;
		this.size  = size;
		this.state = state;
	}

	public int getPosX()
	{
		return Math.round(posX);
	}

	public int getPosY()
	{
		return Math.round(posY);
	}

	public int getSize()
	{
		return Math.round(size);
	}

	public void setState(boolean state)
	{
		this.state = state;
	}

	public boolean getState()
	{
		return state;
	}

	public boolean isOver(int mouseX, int mouseY)
	{
		int dx = mouseX - getPosX();
		int dy = mouseY - getPosY();
		return (PApplet.sq(dx) + PApplet.sq(dy) <= PApplet.sq(getSize() / 2));
	}

	public void draw(PGraphics g, int mouseX, int mouseY)
	{
		draw(g, mouseX, mouseY, false);
	}

	public void draw(PGraphics g, int mouseX, int mouseY, boolean icon)
	{
		g.fill(state ? BACKGROUND_ON : BACKGROUND_OFF);
		if (icon) g.noStroke();
		else g.stroke(isOver(mouseX, mouseY) ? STROKE_HOVER : STROKE_NORMAL);
		g.ellipse(getPosX(), getPosY(), getSize(), getSize());

		if (!icon) {
			g.fill(state ? TEXT_ON : TEXT_OFF);
			g.text(label, getPosX(), getPosY());
		}
	}
}
