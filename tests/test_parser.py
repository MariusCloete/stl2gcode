"""Tests for stl2gcode.parser."""

import struct
import pytest
from stl2gcode.parser import load_stl


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_binary_stl(triangles, tmp_path):
    """Write a minimal binary STL and return its Path."""
    path = tmp_path / "test.stl"
    with open(path, "wb") as f:
        f.write(b"\x00" * 80)  # header
        f.write(struct.pack("<I", len(triangles)))
        for normal, v1, v2, v3 in triangles:
            f.write(struct.pack("<12f", *normal, *v1, *v2, *v3))
            f.write(b"\x00\x00")  # attribute byte count
    return path


def _make_ascii_stl(triangles, tmp_path):
    """Write a minimal ASCII STL and return its Path."""
    path = tmp_path / "test.stl"
    lines = ["solid test"]
    for normal, v1, v2, v3 in triangles:
        lines.append(f"  facet normal {normal[0]} {normal[1]} {normal[2]}")
        lines.append("    outer loop")
        for v in (v1, v2, v3):
            lines.append(f"      vertex {v[0]} {v[1]} {v[2]}")
        lines.append("    endloop")
        lines.append("  endfacet")
    lines.append("endsolid test")
    path.write_text("\n".join(lines))
    return path


_SAMPLE = [
    ((0.0, 0.0, 1.0), (0.0, 0.0, 0.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0)),
    ((0.0, 0.0, -1.0), (0.0, 0.0, 1.0), (1.0, 0.0, 1.0), (0.0, 1.0, 1.0)),
]


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_binary_stl_triangle_count(tmp_path):
    path = _make_binary_stl(_SAMPLE, tmp_path)
    triangles = load_stl(path)
    assert len(triangles) == len(_SAMPLE)


def test_binary_stl_vertex_values(tmp_path):
    path = _make_binary_stl(_SAMPLE, tmp_path)
    triangles = load_stl(path)
    assert triangles[0]["vertices"][0] == pytest.approx((0.0, 0.0, 0.0))


def test_ascii_stl_triangle_count(tmp_path):
    path = _make_ascii_stl(_SAMPLE, tmp_path)
    triangles = load_stl(path)
    assert len(triangles) == len(_SAMPLE)


def test_ascii_stl_normal(tmp_path):
    path = _make_ascii_stl(_SAMPLE, tmp_path)
    triangles = load_stl(path)
    assert triangles[0]["normal"] == pytest.approx((0.0, 0.0, 1.0))


def test_empty_binary_stl(tmp_path):
    path = _make_binary_stl([], tmp_path)
    assert load_stl(path) == []


def test_missing_file_raises(tmp_path):
    with pytest.raises(FileNotFoundError):
        load_stl(tmp_path / "nonexistent.stl")
