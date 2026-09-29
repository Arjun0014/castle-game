"""Shot registry: id -> {'build': fn(pass_name, n, fps, shot, pct), 'passes': [...], 'per_frame': fn?}."""
import importlib

REGISTRY = {}
for mod in ('shot_establishing', 'shot_heart', 'shot_rise', 'shot_interiors', 'shot_gate'):
    m = importlib.import_module(mod)
    REGISTRY.update(m.REG)
