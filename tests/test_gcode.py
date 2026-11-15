"""Tests for stl2gcode.gcode."""

import pytest
from stl2gcode.gcode import generate_gcode


_TOOLPATHS = [
    (2.0, [[(0.0, 0.0), (10.0, 0.0), (10.0, 10.0), (0.0, 10.0)]]),
    (4.0, [[(0.0, 0.0), (10.0, 0.0), (10.0, 10.0), (0.0, 10.0)]]),
]


def test_generate_gcode_returns_string():
    result = generate_gcode(_TOOLPATHS, feed=1000, plunge=300, spindle=24000)
    assert isinstance(result, str)


def test_generate_gcode_contains_spindle():
    result = generate_gcode(_TOOLPATHS, feed=1000, plunge=300, spindle=24000)
    assert "S24000" in result


def test_generate_gcode_contains_feed():
    result = generate_gcode(_TOOLPATHS, feed=800, plunge=200, spindle=20000)
    assert "F800" in result


def test_generate_gcode_contains_plunge():
    result = generate_gcode(_TOOLPATHS, feed=800, plunge=200, spindle=20000)
    assert "F200" in result


def test_generate_gcode_has_program_delimiters():
    result = generate_gcode(_TOOLPATHS, feed=1000, plunge=300, spindle=24000)
    assert result.startswith("%")
    assert result.rstrip().endswith("%")


def test_generate_gcode_has_end_of_program():
    result = generate_gcode(_TOOLPATHS, feed=1000, plunge=300, spindle=24000)
    assert "M30" in result


def test_generate_gcode_empty_toolpaths():
    result = generate_gcode([], feed=1000, plunge=300, spindle=24000)
    assert "M30" in result


def test_generate_gcode_z_depth_in_output():
    result = generate_gcode(_TOOLPATHS, feed=1000, plunge=300, spindle=24000)
    assert "Z-2.000" in result
    assert "Z-4.000" in result
