"""G-code generator.

Takes the layered toolpath produced by :mod:`stl2gcode.slicer` and emits
standard RS-274 G-code suitable for a 3-axis CNC router.
"""

from __future__ import annotations

from typing import List, Tuple

Point2D = Tuple[float, float]
Layer = List[Point2D]


# Safe Z height used for rapid moves between contours (mm).
_SAFE_Z = 5.0


def generate_gcode(
    toolpaths: List[Tuple[float, List[Layer]]],
    *,
    feed: float,
    plunge: float,
    spindle: float,
) -> str:
    """Convert toolpaths to a G-code string.

    Args:
        toolpaths: Output of :func:`stl2gcode.slicer.slice_model` –
            a list of ``(z_depth, layers)`` tuples.
        feed: Horizontal feed rate in mm/min.
        plunge: Plunge (vertical) feed rate in mm/min.
        spindle: Spindle speed in RPM.

    Returns:
        G-code as a single string (lines separated by ``\\n``).
    """
    lines: List[str] = []

    # --- Program header ---
    lines += [
        "%",
        "G21        ; units: millimetres",
        "G90        ; absolute positioning",
        "G17        ; XY plane",
        f"S{spindle:.0f} M3  ; spindle on, {spindle:.0f} RPM",
        f"G0 Z{_SAFE_Z:.3f}  ; move to safe height",
        "",
    ]

    for z, layers in toolpaths:
        lines.append(f"; --- Layer Z={z:.3f} mm ---")
        for contour in layers:
            if not contour:
                continue
            x0, y0 = contour[0]
            # Rapid to start of contour at safe height
            lines.append(f"G0 X{x0:.3f} Y{y0:.3f}")
            # Plunge to cutting depth
            lines.append(f"G1 Z{-z:.3f} F{plunge:.0f}")
            # Cut along contour
            for x, y in contour[1:]:
                lines.append(f"G1 X{x:.3f} Y{y:.3f} F{feed:.0f}")
            # Retract to safe height
            lines.append(f"G0 Z{_SAFE_Z:.3f}")
        lines.append("")

    # --- Program footer ---
    lines += [
        f"G0 Z{_SAFE_Z:.3f}  ; retract",
        "M5             ; spindle off",
        "M30            ; end of program",
        "%",
    ]

    return "\n".join(lines) + "\n"
