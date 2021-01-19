#!/usr/bin/env python3

import math

zigzag = False


def pretty(f):
	return "{:,g}".format(0 if abs(f) < 0.000001 else f)


def f_equal(a1, a2):
	return abs(a1 - a2) < 0.001


def p_find(a, r, t):
	for i, p in enumerate(a):
		if f_equal(p['r'], r) and f_equal(p['t'], t): return i
	return -1


def find_symmetry(a):
	for i0, p in enumerate(a):
		r = p['r']
		t = p['t']
		if f_equal(r, 0.0):
			print(i0)
		elif t < 45.001:
			if f_equal(t, 0.0) or f_equal(t, 45.0):
				i1 = p_find(a, r,  90 + t)
				a[i0]['next'] = i1
				i2 = p_find(a, r, 180 + t)
				a[i1]['next'] = i2
				i3 = p_find(a, r, 270 + t)
				a[i2]['next'] = i3
				a[i3]['next'] = i0
			else:
				i1 = p_find(a, r,  90 - t)
				a[i0]['next'] = i1
				i2 = p_find(a, r,  90 + t)
				a[i1]['next'] = i2
				i3 = p_find(a, r, 180 - t)
				a[i2]['next'] = i3
				i4 = p_find(a, r, 180 + t)
				a[i3]['next'] = i4
				i5 = p_find(a, r, 270 - t)
				a[i4]['next'] = i5
				i6 = p_find(a, r, 270 + t)
				a[i5]['next'] = i6
				i7 = p_find(a, r, 360 - t)
				a[i6]['next'] = i7
				a[i7]['next'] = i0


def create_matrix(dim_x, dim_y):
	directory = "led_{}".format(dim_x) if dim_y == 1 else "led_{}x{}".format(dim_x, dim_y)
	coords = open('data/{}/coords.txt'.format(directory), 'w')
	#lines = open('data/{}/lines.txt'.format(directory), 'w')
	symmetry = open('data/{}/symmetry.txt'.format(directory), 'w')


	all_coords = []

	n = 0
	direction = 1
	for j in range(dim_y):
		y = 0 if dim_y == 1 else 2 * j / (dim_y - 1) - 1
		for i in range(dim_x):
			x = direction * (2 * i / (dim_x - 1) - 1)
			p = {
				'name': n + 1,
				'next': n,
				'x': x,
				'y': y,
				'r': (x ** 2 + y ** 2) ** .5,
				't': (360 + math.degrees(math.atan2(y,x))) % 360
			}
			all_coords.append(p)
			print("{}\t{}\t{}\t{}".format(p['name'], pretty(p['x']), pretty(p['y']), 0.1), file = coords)
			n += 1
		if zigzag: direction *= -1


	#find_symmetry(all_coords)
	for p in all_coords:
		print(p['next'], file = symmetry)


	coords.close()
	#lines.close()
	symmetry.close()


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
