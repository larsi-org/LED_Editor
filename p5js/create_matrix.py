#!/usr/bin/env python3

import json

zigzag = False


def clean(f):
	v = float("{:,g}".format(0 if abs(f) < 0.000001 else f))
	return int(v) if v == int(v) else v


def create_matrix(dim_x, dim_y):
	name = "led_{}".format(dim_x) if dim_y == 1 else "led_{}x{}".format(dim_x, dim_y)

	leds = []
	direction = 1
	for j in range(dim_y):
		y = 0 if dim_y == 1 else 2 * j / (dim_y - 1) - 1
		for i in range(dim_x):
			x = direction * (2 * i / (dim_x - 1) - 1)
			leds.append({'x': clean(x), 'y': clean(y), 'r': 0.1})
		if zigzag: direction *= -1

	with open('layouts/{}.json'.format(name), 'w') as f:
		json.dump({'leds': leds}, f)
		f.write('\n')


# main
create_matrix( 5,  1)
create_matrix( 8,  1)
create_matrix(16,  1)
create_matrix(20,  1)

create_matrix( 3,  3)
create_matrix( 4,  4)
create_matrix( 5,  5)
create_matrix( 8,  8)
create_matrix(16, 16)

create_matrix( 6,  5)
