"""Tests for stl2gcode.slicer."""

import pytest
from stl2gcode.slicer import slice_model, _compute_z_levels


# A single upright triangle crossing Z = 0.5
_VERTICAL_TRIANGLE = [
    {
        "normal": (0.0, 1.0, 0.0),
        "vertices": [(0.0, 0.0, 0.0), (1.0, 0.0, 0.0), (0.5, 0.0, 1.0)],
    }
]


def test_z_levels_basic():
    levels = _compute_z_levels(thickness=6.0, layer_depth=2.0)
    assert levels == pytest.approx([2.0, 4.0, 6.0])


def test_z_levels_non_divisible():
    levels = _compute_z_levels(thickness=5.0, layer_depth=2.0)
    # Should end exactly at thickness
    assert levels[-1] == pytest.approx(5.0)


def test_z_levels_invalid_layer_depth():
    with pytest.raises(ValueError):
        _compute_z_levels(thickness=6.0, layer_depth=0)


def test_z_levels_invalid_thickness():
    with pytest.raises(ValueError):
        _compute_z_levels(thickness=0, layer_depth=2.0)


def test_slice_model_returns_correct_depth_count():
    result = slice_model(
        _VERTICAL_TRIANGLE,
        thickness=1.0,
        layer_depth=0.5,
        tool_dia=3.175,
    )
    # Expect layers at z=0.5 and z=1.0
    assert len(result) == 2


def test_slice_model_z_values():
    result = slice_model(
        _VERTICAL_TRIANGLE,
        thickness=1.0,
        layer_depth=0.5,
        tool_dia=3.175,
    )
    z_values = [r[0] for r in result]
    assert z_values == pytest.approx([0.5, 1.0])


def test_slice_model_empty_triangles():
    result = slice_model([], thickness=6.0, layer_depth=2.0, tool_dia=3.175)
    for _, layers in result:
        assert layers == []
