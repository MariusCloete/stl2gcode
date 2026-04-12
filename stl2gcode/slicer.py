"""Slicer module.

Converts a list of STL triangles into a series of 2-D toolpath layers
suitable for flat-bed CNC machining.

Each layer is a list of (x, y) contour points at a given Z depth.
"""

from __future__ import annotations

from typing import List, Tuple

Triangle = dict  # {"normal": tuple, "vertices": list[tuple]}
Point2D = Tuple[float, float]
Layer = List[Point2D]


def slice_model(
    triangles: List[Triangle],
    *,
    thickness: float,
    layer_depth: float,
    tool_dia: float,
) -> List[Tuple[float, List[Layer]]]:
    """Slice the model into horizontal layers.

    Args:
        triangles: Triangle list as returned by :func:`stl2gcode.parser.load_stl`.
        thickness: Total material thickness in mm.
        layer_depth: Depth per cutting pass in mm.
        tool_dia: Tool diameter in mm (used for path offset).

    Returns:
        A list of ``(z_depth, layers)`` tuples ordered from shallowest to
        deepest, where *layers* is a list of closed 2-D contour point lists.
    """
    z_levels = _compute_z_levels(thickness, layer_depth)
    result = []
    for z in z_levels:
        contours = _slice_at_z(triangles, z, tool_dia)
        result.append((z, contours))
    return result


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _compute_z_levels(thickness: float, layer_depth: float) -> List[float]:
    """Return a list of Z cutting depths from surface down to *thickness*."""
    if layer_depth <= 0:
        raise ValueError("layer_depth must be positive.")
    if thickness <= 0:
        raise ValueError("thickness must be positive.")

    levels: List[float] = []
    z = layer_depth
    while z < thickness:
        levels.append(round(z, 6))
        z += layer_depth
    levels.append(round(thickness, 6))
    return levels


def _slice_at_z(
    triangles: List[Triangle], z: float, tool_dia: float
) -> List[Layer]:
    """Intersect triangles with a horizontal plane at *z* and return contours.

    This is a simplified implementation that collects intersection line
    segments and returns them as individual open polylines.  A production
    implementation would stitch segments into closed contours and apply a
    cutter-radius offset equal to ``tool_dia / 2``.
    """
    segments: List[Tuple[Point2D, Point2D]] = []
    for tri in triangles:
        seg = _intersect_triangle(tri["vertices"], z)
        if seg is not None:
            segments.append(seg)

    if not segments:
        return []

    # Return each segment as a minimal two-point layer.
    return [list(seg) for seg in segments]


def _intersect_triangle(
    vertices: List[Tuple[float, float, float]], z: float
) -> Tuple[Point2D, Point2D] | None:
    """Return the line segment where the triangle intersects z, or None."""
    pts: List[Point2D] = []
    v = vertices
    edges = [(v[0], v[1]), (v[1], v[2]), (v[2], v[0])]
    for a, b in edges:
        za, zb = a[2], b[2]
        if (za <= z <= zb) or (zb <= z <= za):
            if za == zb:
                continue
            t = (z - za) / (zb - za)
            x = a[0] + t * (b[0] - a[0])
            y = a[1] + t * (b[1] - a[1])
            pts.append((x, y))

    if len(pts) == 2:
        return (pts[0], pts[1])
    return None
