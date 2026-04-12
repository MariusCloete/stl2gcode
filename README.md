```bash
python stl_to_gcode.py mypart.stl
# → outputs mypart.gcode
```
```bash
python stl_to_gcode.py mypart.stl output.gcode \
  --thickness 9 \
  --layer-depth 3 \
  --tool-dia 4 \
  --feed 800 \
  --plunge 200 \
  --spindle 20000
```
