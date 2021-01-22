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

	public int getPosX(int dx, int f)
	{
		return Math.round(dx + f * posX);
	}

	public int getPosY(int dy, int f)
	{
		return Math.round(dy + f * posY);
	}

	public int getSize(int f)
	{
		return Math.round(f * size);
	}

	public void setState(boolean state)
	{
		this.state = state;
	}

	public boolean getState()
	{
		return state;
	}

	public boolean isOver(int dx, int dy, int f, int mouseX, int mouseY)
	{
		int x_ = mouseX - getPosX(dx, f);
		int y_ = mouseY - getPosY(dy, f);
		return (PApplet.sq(x_) + PApplet.sq(y_) <= PApplet.sq(getSize(f) / 2));
	}

	public void draw(PGraphics g, int dx, int dy, int f)
	{
		draw(g, dx, dy, f, 0, 0, true);
	}

	public void draw(PGraphics g, int dx, int dy, int f, int mouseX, int mouseY)
	{
		draw(g, dx, dy, f, mouseX, mouseY, false);
	}

	public void draw(PGraphics g, int dx, int dy, int f, int mouseX, int mouseY, boolean icon)
	{
		g.fill(state ? BACKGROUND_ON : BACKGROUND_OFF);
		if (icon) g.noStroke();
		else g.stroke(isOver(dx, dy, f, mouseX, mouseY) ? STROKE_HOVER : STROKE_NORMAL);
		g.ellipse(getPosX(dx, f), getPosY(dy, f), getSize(f), getSize(f));

		if (!icon) {
			g.fill(state ? TEXT_ON : TEXT_OFF);
			g.text(label, getPosX(dx, f), getPosY(dy, f));
		}
	}
}
