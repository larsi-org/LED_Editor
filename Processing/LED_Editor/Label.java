import processing.core.*;
import java.lang.Math;

public class Label
{
	// colors
	public static int BACKGROUND    = 0xFF336699;
	public static int TEXT          = 0xFF000000;
	public static int STROKE_NORMAL = 0xFF000000;

	private String label;
	private float  posX;
	private float  posY;
	private float  sizeX;
	private float  sizeY;

	public Label(String label, float posX, float posY, float sizeX, float sizeY)
	{
		this.label  = label;
		this.posX   = posX;
		this.posY   = posY;
		this.sizeX  = sizeX;
		this.sizeY  = sizeY;
	}

	public void setLabel(String label)
	{
		this.label =  label;
	}

	public String getLabel()
	{
		return label;
	}

	public int getPosX()
	{
		return Math.round(posX);
	}

	public int getPosY()
	{
		return Math.round(posY);
	}

	public int getSizeX()
	{
		return Math.round(sizeX);
	}

	public int getSizeY()
	{
		return Math.round(sizeY);
	}

	public void draw(PGraphics g)
	{
		g.fill(BACKGROUND);
		g.stroke(STROKE_NORMAL);
		g.rect(getPosX() - getSizeX() / 2, getPosY() - getSizeY() / 2, getSizeX(), getSizeY());

		g.fill(TEXT);
		g.text(label, getPosX(), getPosY());
	}
}
