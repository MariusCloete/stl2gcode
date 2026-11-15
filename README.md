# STL to G-code

This repository contains an experimental browser-based CNC workspace and the original Python CLI. The web app processes STL files and generates toolpaths locally in the browser; it has no backend.

**Safety: Always verify G-code in a simulator and run an air cut before machining real material.** The app does not check collisions with the model, tool holder, clamps, machine limits, or remaining stock. It is not a substitute for an established CAM workflow.

## Web app setup

Requires Node.js 20 or newer and pnpm. With Corepack enabled:

```sh
corepack pnpm install
corepack pnpm dev
```

Open the URL printed by Vite. Build and run the unit tests with:

```sh
corepack pnpm build
corepack pnpm test
```

### Docker

Build and run the static web app:

```sh
docker build -t stl2gcode-web .
docker run --rm -p 8080:8080 stl2gcode-web
```

Open `http://localhost:8080`. STL processing stays in the browser; the container only serves the built files.

### Debugging the web app

Run `corepack pnpm dev` and use the URL printed by Vite (typically `http://localhost:5173`). The development server serves the source modules for debugging; the Docker image serves a production build instead.

In a browser, open Developer Tools (F12), check the Console for errors, and use the Sources/Debugger tab to set breakpoints in `src/ui/App.tsx` or `src/ui/GcodePanel.tsx`. Toolpath generation runs in a separate worker: inspect `src/workers/toolpath.worker.ts` and `src/core/toolpath/profile.ts` in the worker's debugger context. Reload the page if the worker sources are not yet visible.

For JetBrains IDE debugging, start the Vite development server, then create a **JavaScript Debug** run configuration pointing to the Vite URL. Start that configuration in Debug mode and reproduce the issue in the browser it opens. The JavaScript debugger must be available in the IDE; otherwise use browser Developer Tools.

To investigate an empty G-code panel, import the sample cube, click **Generate toolpath**, and check for errors in the settings sidebar and above the G-code text area. If generation succeeds, inspect the worker response in `App.tsx` and the `segments` and `result` values in `GcodePanel.tsx`. Changing model, settings, or operations clears the generated path, so generate it again after making changes.

## Usage

1. Import an ASCII or binary STL by dropping it onto the model box or using the file picker. Sample STL files are linked in the app and stored in `public/samples/`.
2. Select STL and working units, set stock dimensions, model scale and orientation, and configure the flat end mill. The model is centered in XY and its top is placed at the specified Z relative to stock top. Changing working units **reinterprets**, rather than converts, existing numeric inputs.
3. Add and order profile or concentric pocket operations. For a zero-thickness horizontal STL, the outline is the union of its filled triangles; the slice height is not used. For other models, slice Z is measured from stock top and must cross the mesh strictly between its vertices. Total depth is measured down from stock top. The positioned model must fit within the stock. For the 20 mm cube sample with default 400 × 400 mm stock and tool settings, outside profile, slice Z -1, depth 5 and stepdown 2 generate contours at X/Y 187 and 213 in stock coordinates, at depths -2, -4 and -5.
4. Generate the toolpath in the worker. Orange lines are cutting moves; blue lines are rapids. The slider and play button show a simplified, segment-based tool animation, not a time-accurate or material-removal simulation.
5. Choose a post-processor and copy or download the output. Bounds are reported in stock coordinates (corner XY, stock-top Z), regardless of the selected output origin. The time estimate covers programmed cutting moves only, excluding rapids, acceleration and spindle changes.

Non-manifold meshes are allowed, but slices of 3D meshes must form closed contours. Degenerate triangles are ignored with a warning; verify that no intended geometry is missing. The generator rejects open slices, invalid dimensions, paths outside stock XY, depths beyond stock thickness or flute length, and stepdowns above the tool maximum. XY rapids are preceded by a retract above stock; the initial machine location and machine-specific safe movement remain the operator's responsibility. The pocket stepover is limited to 50% of tool diameter. Local storage contains the last settings, operations, theme and tool presets; STL data is not persisted. Saved stock settings take precedence over defaults. Presets can only be loaded with matching working units.

## Post-processors

- **GRBL**, **Mach3** and **LinuxCNC** output metric or inch units, G90, G17, G0/G1, M3/M5 and M30.
- **Marlin** outputs the same linear moves and spindle commands, followed by M400 and M5. It requires firmware configured for CNC/spindle and G17 support; controller configurations differ.

All dialects currently emit linear moves only. Check the output against the actual controller configuration before use.

## Known limitations

- Profile and pocket paths are generated from a **single horizontal mesh slice** or, for exactly zero-thickness horizontal models, the union of filled triangles; neither is a full 3D collision model. Triangle overlaps are merged and holes must be represented by unfilled regions. Verify the outline and the entire tool and holder against the mesh, stock and fixtures independently. Slices through a vertex or face are rejected; choose another height.
- Pocket clearing is concentric only. Small features may be omitted by offsets; inspect and verify remaining material independently.
- Only flat end mills are supported. Ball-nose and V-bit tools, 3D surfacing/drop-cutter, raster pockets, tabs, leads and arc output are not implemented.
- Toolpath preview does not show stock removal or collision detection. Simulation runs at a fixed segment-based speed rather than actual machining speed.
- The preview renders all triangles and toolpath segments. Import and generation run in workers, but GPU upload/rendering and large path previews may still affect responsiveness; 500,000-triangle performance has not been verified.
- Marlin support depends on firmware options. Controller-specific tool changes, coolant, homing and probing are not emitted.

## Python CLI

The original command-line interface remains available separately:

```sh
python stl_to_gcode.py mypart.stl
python stl_to_gcode.py mypart.stl output.gcode \
  --thickness 9 --layer-depth 3 --tool-dia 4 \
  --feed 800 --plunge 200 --spindle 20000
```
