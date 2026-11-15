"""STL file parser.

Reads binary and ASCII STL files and returns a list of triangles.
Each triangle is represented as a dict::

    {
        "normal": (nx, ny, nz),
        "vertices": [(x1,y1,z1), (x2,y2,z2), (x3,y3,z3)],
    }
"""

from __future__ import annotations

import struct
from pathlib import Path
from typing import List


Triangle = dict  # {"normal": tuple, "vertices": list[tuple]}


def load_stl(path: Path) -> List[Triangle]:
    """Load an STL file and return its triangles.

    Supports both binary and ASCII STL formats.

    Args:
        path: Path to the STL file.

    Returns:
        List of triangle dicts.

    Raises:
        ValueError: If the file cannot be parsed as a valid STL.
    """
    data = Path(path).read_bytes()
    if _is_ascii(data):
        return _parse_ascii(data.decode("utf-8", errors="replace"))
    return _parse_binary(data)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

_BINARY_HEADER = 80
_BINARY_TRIANGLE_SIZE = 50  # 12 floats (normal + 3 vertices) + 2 bytes attribute


def _is_ascii(data: bytes) -> bool:
    """Return True when the file looks like an ASCII STL."""
    try:
        header = data[:256].decode("utf-8", errors="strict").lstrip()
        return header.startswith("solid")
    except UnicodeDecodeError:
        return False


def _parse_binary(data: bytes) -> List[Triangle]:
    if len(data) < _BINARY_HEADER + 4:
        raise ValueError("File is too short to be a valid binary STL.")

    num_triangles = struct.unpack_from("<I", data, _BINARY_HEADER)[0]
    expected_size = _BINARY_HEADER + 4 + num_triangles * _BINARY_TRIANGLE_SIZE
    if len(data) < expected_size:
        raise ValueError(
            f"Binary STL declares {num_triangles} triangles but file is truncated."
        )

    triangles: List[Triangle] = []
    offset = _BINARY_HEADER + 4
    for _ in range(num_triangles):
        values = struct.unpack_from("<12f", data, offset)
        normal = (values[0], values[1], values[2])
        v1 = (values[3], values[4], values[5])
        v2 = (values[6], values[7], values[8])
        v3 = (values[9], values[10], values[11])
        triangles.append({"normal": normal, "vertices": [v1, v2, v3]})
        offset += _BINARY_TRIANGLE_SIZE

    return triangles


def _parse_ascii(text: str) -> List[Triangle]:
    triangles: List[Triangle] = []
    lines = [ln.strip() for ln in text.splitlines()]
    i = 0
    while i < len(lines):
        if lines[i].startswith("facet normal"):
            parts = lines[i].split()
            normal = (float(parts[2]), float(parts[3]), float(parts[4]))
            vertices = []
            i += 1  # advance to "outer loop"
            for _ in range(3):
                i += 1  # advance to next "vertex ..." line
                vparts = lines[i].split()
                vertices.append((float(vparts[1]), float(vparts[2]), float(vparts[3])))
            triangles.append({"normal": normal, "vertices": vertices})
        i += 1
    return triangles
