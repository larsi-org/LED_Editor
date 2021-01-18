#!/usr/bin/env python3

import math

zigzag = True


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


def create_matrix(x, y):
	directory = "led_{}".format(x) if y == 1 else "led_{}x{}".format(x, y)
	coords = open('data/{}/coords.txt'.format(directory), 'w')
	lines = open('data/{}/lines.txt'.format(directory), 'w')
	symmetry = open('data/{}/symmetry.txt'.format(directory), 'w')


	def create_a_row(i_start, i_cnt, direction, y):
		for i in range(i_cnt):
			x = direction * dx * (i - (i_cnt - 1) / 2.0)
			p = {
				'name': i_start + i,
				'next': i_start + i,
				'x': x,
				'y': y,
				'r': (x ** 2 + y ** 2) ** .5,
				't': (360 + math.degrees(math.atan2(y,x))) % 360
			}
			all_coords.append(p)
			print("{}\t{}\t{}\t{}".format(p['name'], pretty(p['x']), pretty(p['y']), 0.1), file = coords)
		print("{}\t{}".format(i_start, i_start + i_cnt - 1), file = lines)


	all_coords = []

	dx = 1.0 / (n - 1)
	dy = math.sqrt(0.75) * dx

	direction = 1
	i = 0
	i_cnt = n

	for y in range(1, n):
		create_a_row(i, i_cnt, direction, dy * (y - n))
		i += i_cnt
		i_cnt += 1
		if zigzag: direction *= -1

	i_cnt = 2 * n - 1
	create_a_row(i, i_cnt, direction, 0.0)
	i += i_cnt
	i_cnt -= 1
	if zigzag: direction *= -1

	for y in range(1, n):
		create_a_row(i, i_cnt, direction, dy * y)
		i += i_cnt
		i_cnt -= 1
		if zigzag: direction *= -1


	find_symmetry(all_coords)
	for p in all_coords:
		print(p['next'], file = symmetry)


	coords.close()
	lines.close()
	symmetry.close()


def create_circle(n):
	all_coords = []

	coords = open('data/circle{}/coords.txt'.format(n), 'w')
	lines = open('data/circle{}/lines.txt'.format(n), 'w')
	symmetry = open('data/circle{}/symmetry.txt'.format(n), 'w')

	i = 0
	p = {
		'name': i,
		'next': i,
		'x': 0,
		'y': 0,
		'r': 0,
		't': 0
	}
	all_coords.append(p)
	print("{}\t{}\t{}\t{}".format(p['name'], pretty(p['x']), pretty(p['y']), 0.1), file = coords)
	i += 1

	for c in range(1, n):
		r = c / (n - 1)
		f_a = 60.0 / c
		for a in range(6 * c):
			angle = f_a * a
			p = {
				'name': i,
				'next': i,
				'x': r * math.cos(math.radians(angle)),
				'y': -r * math.sin(math.radians(angle)),
				'r': r,
				't': angle
			}
			all_coords.append(p)
			print("{}\t{}\t{}\t{}".format(p['name'], pretty(p['x']), pretty(p['y']), 0.1), file = coords)
			i += 1
		# print("{}\t{}".format(i_start, i_start + i_cnt - 1), file = lines)


	find_symmetry(all_coords)
	for p in all_coords:
		print(p['next'], file = symmetry)


	coords.close()
	lines.close()
	symmetry.close()


# main loop
for n in range(3, 14):
	create_hex(n)
	create_circle(n)
