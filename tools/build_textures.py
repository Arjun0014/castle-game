"""Convert the Poly Haven material library (assets/extracted/materials) into runtime textures.

Output: public/assets/textures/<key>_{diff,nor,arm}.jpg
  diff: 1024 JPEG q82 (sRGB base color)
  nor : 1024 JPEG q90 (OpenGL tangent-space normal, as shipped *_nor_gl)
  arm : 512  JPEG q85 (R=AO, G=roughness, B=metalness — glTF/three.js ORM layout)
Also writes src/data/textureLibrary.json (key -> files, source set) for the runtime material library.
Run: python tools/build_textures.py
"""
import json
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "extracted", "materials")
OUT = os.path.join(ROOT, "public", "assets", "textures")
LIB = os.path.join(ROOT, "src", "data", "textureLibrary.json")

# runtime key -> (category folder, poly haven set name)
SETS = {
    "stone_wall": ("stone", "stone_wall_04_1k", "stone_wall_04"),
    "stone_block": ("stone", "japanese_stone_wall_1k", "japanese_stone_wall"),
    "marble": ("stone", "marble_01_1k", "marble_01"),
    "rock": ("stone", "dark_rock_02_1k", "dark_rock_02"),
    "terrain": ("stone", "rocky_terrain_03_1k", "rocky_terrain_03"),
    "wood_fine": ("wood", "coated_pine_02_1k", "coated_pine_02"),
    "wood_rough": ("wood", "rough_wood_1k", "rough_wood"),
    "wood_planks": ("wood", "wood_planks_dirt_1k", "wood_planks_dirt"),
    "wood_moss": ("wood", "moss_wood_1k", "moss_wood"),
    "wood_door": ("wood", "wood_shutter_1k", "wood_shutter"),
    "iron": ("metal", "metal_plate_02_1k", "metal_plate_02"),
    "rust": ("metal", "rust_coarse_01_1k", "rust_coarse_01"),
    "rust_plate": ("metal", "rusty_metal_04_1k", "rusty_metal_04"),
    "fabric_royal": ("fabric", "quatrefoil_jacquard_fabric_1k", "quatrefoil_jacquard_fabric"),
    "fabric_gold": ("fabric", "crepe_satin_1k", "crepe_satin"),
    "fabric_linen": ("fabric", "rough_linen_1k", "rough_linen"),
}


def convert(src, dst, size, quality):
    im = Image.open(src)
    if im.mode not in ("RGB", "L"):
        im = im.convert("RGB")
    if im.mode == "L":
        im = im.convert("RGB")
    if im.size != (size, size):
        im = im.resize((size, size), Image.LANCZOS)
    im.save(dst, "JPEG", quality=quality, optimize=True, progressive=True)
    return os.path.getsize(dst)


def main():
    os.makedirs(OUT, exist_ok=True)
    lib = {}
    total = 0
    for key, (cat, folder, stem) in SETS.items():
        tex = os.path.join(SRC, cat, folder, "textures")
        files = {}
        for kind, suffix, size, q in (("diff", "_diff_1k.jpg", 1024, 82),
                                      ("nor", "_nor_gl_1k.png", 1024, 90),
                                      ("arm", "_arm_1k.png", 512, 85)):
            src = os.path.join(tex, stem + suffix)
            if not os.path.exists(src):
                raise FileNotFoundError(src)
            name = "%s_%s.jpg" % (key, kind)
            total += convert(src, os.path.join(OUT, name), size, q)
            files[kind] = "assets/textures/" + name
        lib[key] = {"source": "assets/materials/%s/%s.zip" % (cat, folder), **files}
        print("converted", key)
    os.makedirs(os.path.dirname(LIB), exist_ok=True)
    json.dump(lib, open(LIB, "w"), indent=1)
    print("total bytes", total)


if __name__ == "__main__":
    main()
