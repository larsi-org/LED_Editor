import processing.core.*;

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
	private int     posX  = 0;
	private int     posY  = 0;
	private int     size  = 1;
	private boolean state = false;

	public Checkbox(String label, int posX, int posY, int size, boolean state)
	{
		this.label = label;
		this.posX  = posX;
		this.posY  = posY;
		this.size  = size;
		this.state = state;
	}

	public void setLabel(String label)
	{
		this.label =  label;
	}

	public String getLabel()
	{
		return label;
	}

	public void setPosX(int posX)
	{
		this.posX = posX;
	}

	public int getPosX()
	{
		return posX;
	}

	public void setPosY(int posY)
	{
		this.posY = posY;
	}

	public int getPosY()
	{
		return posY;
	}

	public void setSize(int size)
	{
		this.size = size;
	}

	public int getSize()
	{
		return size;
	}

	public void setState(boolean state)
	{
		this.state = state;
	}

	public boolean getState()
	{
		return state;
	}

	public boolean isOver(int x, int y)
	{
		int dx = x - posX;
		int dy = y - posY;
		return (PApplet.sq(dx) + PApplet.sq(dy) <= PApplet.sq(size / 2));
	}

	public void draw(PGraphics g, int mouseX, int mouseY)
	{
		g.fill(state ? BACKGROUND_ON : BACKGROUND_OFF);
		g.stroke(isOver(mouseX, mouseY) ? STROKE_HOVER : STROKE_NORMAL);
		g.ellipse(posX, posY, size, size);

		g.fill(state ? TEXT_ON : TEXT_OFF);
		g.text(label, posX, posY);
	}
}
