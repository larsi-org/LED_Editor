import java.util.Vector;

//static String DIRECTORY = "cube3";
static String DIRECTORY = "hex10";
//static String DIRECTORY = "circle10";

// colors
static int FILL_BACKGROUND = 0xFF333333;
static int STROKE_WIRE     = 0xFFFFFFFF;

static int DIM             = 800;
static int DIM2            = DIM / 2;
static int FACTOR          = int(0.95 * DIM2);

static int MENU_DX         = 0;
static int MENU_DY         = 0;

static int LEDS_DX         =  0;
static int LEDS_DY         = 50;


// LEDs
Checkbox[] leds;

// Lines
int[][] lines;

// Lines
int[] symmetry;

// Animation States
Vector states = new Vector();

// current index
int   current      = 0;
Label currentLabel = new Label("", MENU_DX + 100, MENU_DY + 25, 80, 24);

// clipboard
boolean [] clipboard;

// Buttons
Button[] buttons = {
	new Button("<<",        MENU_DX +  30, MENU_DY + 25, 40, 24, ','),
	new Button(">>",        MENU_DX + 170, MENU_DY + 25, 40, 24, '.'),
	new Button("Copy",      MENU_DX + 255, MENU_DY + 25, 80, 24, 'c'),
	new Button("Paste",     MENU_DX + 345, MENU_DY + 25, 80, 24, 'v'),
	new Button("Clear",     MENU_DX + 455, MENU_DY + 25, 80, 24, ' '),
	new Button("Invert",    MENU_DX + 545, MENU_DY + 25, 80, 24, 'i'),
	new Button("<< Ins",    MENU_DX + 645, MENU_DY + 25, 60, 24, '['),
	new Button("Del",       MENU_DX + 705, MENU_DY + 25, 40, 24, DELETE),
	new Button("Ins >>",    MENU_DX + 765, MENU_DY + 25, 60, 24, ']'),
	new Button("Generate",  MENU_DX + 855, MENU_DY + 25, 80, 24, 'g'),
	new Button("Quit",      MENU_DX + 945, MENU_DY + 25, 80, 24, 'q')
};

int duration = 50;

/** Processing: setup() */
void setup()
{
	size(1000, 850);
	textFont(loadFont("Univers45.vlw"), 16);
	textAlign(CENTER, CENTER);
	smooth();

	String[] text;

	// LEDs
	text = loadStrings(DIRECTORY + "/coords.txt");
	leds = new Checkbox[text.length];
	symmetry = new int[text.length];
	for(int i = 0; i < text.length; i++) {
		String[] pieces = split(text[i], '\t');
		leds[i] = new Checkbox(pieces[0], round(LEDS_DX + DIM2 + FACTOR * PApplet.parseFloat(pieces[1])), round(LEDS_DY + DIM2 + FACTOR * PApplet.parseFloat(pieces[2])), round(FACTOR * PApplet.parseFloat(pieces[3])), false);
		symmetry[i] = i;
	}

	// Lines
	text = loadStrings(DIRECTORY + "/lines.txt");
	if (text == null) {
		lines = new int[0][2];
	} else {
		lines = new int[text.length][2];
		for(int i = 0; i < lines.length; i++) {
			String[] pieces = split(text[i], '\t');
			lines[i][0] = PApplet.parseInt(pieces[0]);
			lines[i][1] = PApplet.parseInt(pieces[1]);
		}
	}

	// Symmetry
	text = loadStrings(DIRECTORY + "/symmetry.txt");
	if (text != null) {
		for(int i = 0; i < text.length; i++) {
			symmetry[i] = PApplet.parseInt(text[i]);
		}
	}

	// create clipboard
	clipboard = new boolean[leds.length];
	for(int i = 0; i < leds.length; i++) clipboard[i] = false;

	// create the first frame
	boolean[] temp = new boolean[leds.length];
	for(int i = 0; i < leds.length; i++) temp[i] = false;
	states.add(temp);
}

/** Processing: draw() */
void draw()
{
	background(FILL_BACKGROUND);

	// draw wires
	stroke(STROKE_WIRE);
	for (int i = 0; i < lines.length; i++)
		line(leds[lines[i][0]].getPosX(), leds[lines[i][0]].getPosY(), leds[lines[i][1]].getPosX(), leds[lines[i][1]].getPosY());

	// draw LEDs
	for (int i = 0; i < leds.length; i++) {
		leds[i].setState(((boolean[])states.get(current))[i]); // copy current frame to LEDs
		leds[i].draw(g, mouseX, mouseY);
	}

	// draw current frame
	currentLabel.setLabel("" + (1 + current) + " / " + states.size());
	currentLabel.draw(g);

	// draw buttons
	for (int i = 0; i < buttons.length; i++)
		buttons[i].draw(g, mouseX, mouseY);
}

void executeKey(char key)
{
	boolean[] temp; // needed for insert a frame

	switch (key) {
	case ' ': // clear current frame
		for (int i = 0; i < leds.length; i++) ((boolean[])states.get(current))[i] = false;
		break;
	case 'i': // inverts current frame
		for (int i = 0; i < leds.length; i++) ((boolean[])states.get(current))[i] = !((boolean[])states.get(current))[i];
		break;
	case ',': // selects previous frame
		current = (current > 0) ? current - 1 : states.size() - 1;
		break;
	case '.': // selects next frame
		current = (current < states.size() - 1) ? current + 1 : 0;
		break;
	case '[': // inserts a frame before the current frame
		temp = new boolean[leds.length];
		for(int i = 0; i < leds.length; i++) temp[i] = false;
		states.add(current, temp);
		break;
	case ']': // inserts a frame after the current frame
		temp = new boolean[leds.length];
		for(int i = 0; i < leds.length; i++) temp[i] = false;
		current++;
		states.add(current, temp);
		break;
	case DELETE: // deletes current frame
		if (states.size() > 1) { // keep at least one frame
			states.remove(current);
			if (current > states.size() - 1) current = states.size() - 1;
		}
		break;
	case 'c': // copy frame to clipboard
		for (int i = 0; i < leds.length; i++) clipboard[i] = ((boolean[])states.get(current))[i];
		break;
	case 'v': // copy clipboard to frame
		for (int i = 0; i < leds.length; i++) ((boolean[])states.get(current))[i] = clipboard[i];
		break;
	case 'g': // generate source code of animation
		for (int j = 0; j < states.size(); j++) {
			print("\t{ ");
			for (int i = 0; i < leds.length; i += 3)
				print("B" +
						(((boolean[])states.get(j))[i    ] ? "1" : "0") +
						(((boolean[])states.get(j))[i + 1] ? "1" : "0") +
						(((boolean[])states.get(j))[i + 2] ? "1" : "0") +
				", ");
			println(duration + " },");
		}
		break;
	case 'q': // quit applet
		exit();
		break;
	}
}

/** Processing: keyReleased() */
void keyReleased()
{
	executeKey(key);
}

/** Processing: mouseReleased() */
void mouseReleased()
{
	switch (mouseButton) {
	case LEFT:
		for (int i = 0; i < leds.length; i++)
			if (leds[i].isOver(mouseX, mouseY)) {
				((boolean[])states.get(current))[i] = !((boolean[])states.get(current))[i];

				int j = i;
				while ((j = symmetry[j]) != i)
					((boolean[])states.get(current))[j] = !((boolean[])states.get(current))[j];
			}

		for (int i = 0; i < buttons.length; i++)
			if (buttons[i].isOver(mouseX, mouseY)) executeKey(buttons[i].getHotkey());

		break;
	case RIGHT:
		for (int i = 0; i < leds.length; i++)
			if (leds[i].isOver(mouseX, mouseY)) {
				((boolean[])states.get(current))[i] = !((boolean[])states.get(current))[i];
			}

		for (int i = 0; i < buttons.length; i++)
			if (buttons[i].isOver(mouseX, mouseY)) executeKey(buttons[i].getHotkey());

		break;
	}
}
