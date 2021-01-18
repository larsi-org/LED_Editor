import processing.core.*;

public class Button
{
	// colors
	public static int BACKGROUND    = 0xFF336699;
	public static int TEXT          = 0xFF000000;
	public static int STROKE_NORMAL = 0xFF000000;
	public static int STROKE_HOVER  = 0xFFFFFFFF;

	private String label;
	private int    posX;
	private int    posY;
	private int    sizeX;
	private int    sizeY;
	private char   hotkey;

	public Button(String label, int posX, int posY, int sizeX, int sizeY, char hotkey)
	{
		this.label  = label;
		this.posX   = posX;
		this.posY   = posY;
		this.sizeX  = sizeX;
		this.sizeY  = sizeY;
		this.hotkey = hotkey;
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

	public void setSizeX(int sizeX)
	{
		this.sizeX = sizeX;
	}

	public int getSizeX()
	{
		return sizeX;
	}

	public void setSizeY(int sizeY)
	{
		this.sizeY = sizeY;
	}

	public int getSizeY()
	{
		return sizeY;
	}

	public void setHotkey(char hotkey)
	{
		this.hotkey = hotkey;
	}

	public char getHotkey()
	{
		return hotkey;
	}

	public boolean isOver(int x, int y)
	{
		int dx = PApplet.abs(x - posX);
		int dy = PApplet.abs(y - posY);
		return (dx <= sizeX / 2 && dy <= sizeY / 2);
	}

	public void draw(PGraphics g, int mouseX, int mouseY)
	{
		g.fill(BACKGROUND);
		g.stroke(isOver(mouseX, mouseY) ? STROKE_HOVER : STROKE_NORMAL);
		g.rect(posX - sizeX / 2, posY - sizeY / 2, sizeX, sizeY);

		g.fill(TEXT);
		g.text(label, posX, posY);
	}
}
