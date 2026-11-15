#!/usr/bin/env python3
"""stl_to_gcode.py – Convert an STL file to G-code for CNC machining."""

import argparse
import sys
from pathlib import Path

from stl2gcode.parser import load_stl
from stl2gcode.slicer import slice_model
from stl2gcode.gcode import generate_gcode


def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        description="Convert an STL file to G-code for CNC machining."
    )
    parser.add_argument("stl_file", help="Input STL file path")
    parser.add_argument(
        "output_file",
        nargs="?",
        help="Output G-code file path (default: <stl_file>.gcode)",
    )
    parser.add_argument(
        "--thickness",
        type=float,
        default=6.0,
        metavar="MM",
        help="Material thickness in mm (default: 6.0)",
    )
    parser.add_argument(
        "--layer-depth",
        type=float,
        default=2.0,
        metavar="MM",
        help="Depth of cut per pass in mm (default: 2.0)",
    )
    parser.add_argument(
        "--tool-dia",
        type=float,
        default=3.175,
        metavar="MM",
        help="Tool diameter in mm (default: 3.175)",
    )
    parser.add_argument(
        "--feed",
        type=float,
        default=1000.0,
        metavar="MM_MIN",
        help="Feed rate in mm/min (default: 1000.0)",
    )
    parser.add_argument(
        "--plunge",
        type=float,
        default=300.0,
        metavar="MM_MIN",
        help="Plunge rate in mm/min (default: 300.0)",
    )
    parser.add_argument(
        "--spindle",
        type=float,
        default=24000.0,
        metavar="RPM",
        help="Spindle speed in RPM (default: 24000.0)",
    )
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)

    stl_path = Path(args.stl_file)
    if not stl_path.is_file():
        print(f"Error: STL file not found: {stl_path}", file=sys.stderr)
        return 1

    output_path = Path(args.output_file) if args.output_file else stl_path.with_suffix(".gcode")

    print(f"Loading STL: {stl_path}")
    model = load_stl(stl_path)

    print(f"Slicing model (layer depth={args.layer_depth} mm, thickness={args.thickness} mm) …")
    toolpaths = slice_model(
        model,
        thickness=args.thickness,
        layer_depth=args.layer_depth,
        tool_dia=args.tool_dia,
    )

    print(f"Generating G-code → {output_path}")
    gcode = generate_gcode(
        toolpaths,
        feed=args.feed,
        plunge=args.plunge,
        spindle=args.spindle,
    )

    output_path.write_text(gcode)
    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
