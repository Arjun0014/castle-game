"""Extract the immutable source zips under assets/ into assets/extracted/.

Source zips are never modified. Output mirrors the source layout:
  assets/materials/stone/stone_wall_04_1k.zip -> assets/extracted/materials/stone/stone_wall_04_1k/...
  assets/characters/hero/Sword and Shield Pack.zip -> assets/extracted/characters/hero/Sword and Shield Pack/...

Idempotent: files that already exist with the same size are skipped.
Run: python tools/extract_assets.py
"""
import os
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
OUT = os.path.join(ASSETS, "extracted")


def main():
    count = 0
    for dirpath, _dirs, files in os.walk(ASSETS):
        if os.path.abspath(dirpath).startswith(os.path.abspath(OUT)):
            continue
        for f in files:
            if not f.lower().endswith(".zip"):
                continue
            src = os.path.join(dirpath, f)
            rel_dir = os.path.relpath(dirpath, ASSETS)
            # "dark_rock_02_1k (1).zip" -> "dark_rock_02_1k"
            stem = os.path.splitext(f)[0].replace(" (1)", "")
            dst = os.path.join(OUT, rel_dir, stem)
            with zipfile.ZipFile(src) as zf:
                for info in zf.infolist():
                    if info.is_dir():
                        continue
                    target = os.path.join(dst, info.filename)
                    if os.path.exists(target) and os.path.getsize(target) == info.file_size:
                        continue
                    os.makedirs(os.path.dirname(target), exist_ok=True)
                    with zf.open(info) as s, open(target, "wb") as d:
                        d.write(s.read())
                    count += 1
            print("extracted", os.path.relpath(src, ROOT), "->", os.path.relpath(dst, ROOT))
    print("files written:", count)


if __name__ == "__main__":
    sys.exit(main())
