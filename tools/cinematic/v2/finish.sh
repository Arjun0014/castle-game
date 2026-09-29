#!/bin/bash
# Film v2 finishing: back up v1, encode the game copies and the share masters from the Remotion masters.
#   bash tools/cinematic/v2/finish.sh
# Inputs:  tools/cinematic/remotion/out/final/opening_v2_{clean,share}_master.mp4 (npx remotion render Opening|OpeningShare)
#          build/cinematic/audio/mix.wav (the soundtrack master)
# Outputs: public/cinematic/opening_{1080,720}.mp4 (the game loads these), build/cinematic/out/the_castle_remembers_v2_{portrait,wide}.mp4
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
M="$ROOT/tools/cinematic/remotion/out/final"
B="$ROOT/build/cinematic/v1_backup"
# which masters to finish and how to name the share copies (defaults: pure v2)
CLEAN="${CLEAN:-$M/opening_v2_clean_master.mp4}"
SHARE="${SHARE:-$M/opening_v2_share_master.mp4}"
NAME="${NAME:-v2}"
mkdir -p "$B" "$ROOT/build/cinematic/out" "$ROOT/public/cinematic"
# keep v1 (first run only: never overwrite the backup with v2)
for f in "$ROOT/public/cinematic/opening_1080.mp4" "$ROOT/public/cinematic/opening_720.mp4" \
         "$ROOT/build/cinematic/out/the_castle_remembers_portrait.mp4" "$ROOT/build/cinematic/out/the_castle_remembers_wide.mp4"; do
  [ -f "$f" ] && [ ! -f "$B/$(basename "$f")" ] && cp "$f" "$B/" && echo "backed up $(basename "$f")"
done
X264="-c:v libx264 -profile:v high -pix_fmt yuv420p -preset slow"
AAC="-c:a aac -b:a 192k -ar 48000 -ac 2"
# audio straight from the soundtrack master: Remotion's own AAC track arrives ~43 ms late (one frame off the beats)
MIX="$ROOT/build/cinematic/audio/mix.wav"
ffmpeg -v error -y -i "$CLEAN" -i "$MIX" -map 0:v:0 -map 1:a:0 -t 66 \
  $X264 -crf 24 $AAC -movflags +faststart "$ROOT/public/cinematic/opening_1080.mp4"
ffmpeg -v error -y -i "$CLEAN" -i "$MIX" -map 0:v:0 -map 1:a:0 -t 66 -vf "scale=720:1280:flags=lanczos" \
  $X264 -crf 23 $AAC -movflags +faststart "$ROOT/public/cinematic/opening_720.mp4"
ffmpeg -v error -y -i "$SHARE" -i "$MIX" -map 0:v:0 -map 1:a:0 -t 66 \
  $X264 -crf 19 -c:a aac -b:a 256k -ar 48000 -movflags +faststart "$ROOT/build/cinematic/out/the_castle_remembers_${NAME}_portrait.mp4"
# widescreen: the portrait film standing in a dim, blurred wash of its own light
ffmpeg -v error -y -i "$SHARE" -i "$MIX" -t 66 -filter_complex \
  "[0:v]split[a][b];[a]scale=1920:3414,crop=1920:1080,gblur=sigma=38,eq=brightness=-0.18:saturation=0.8[bg];[b]scale=608:1080:flags=lanczos[fg];[bg][fg]overlay=(W-w)/2:0,format=yuv420p[v]" \
  -map "[v]" -map 1:a:0 $X264 -crf 19 -c:a aac -b:a 256k -ar 48000 -movflags +faststart "$ROOT/build/cinematic/out/the_castle_remembers_${NAME}_wide.mp4"
for f in "$ROOT/public/cinematic/opening_1080.mp4" "$ROOT/public/cinematic/opening_720.mp4" \
         "$ROOT/build/cinematic/out/the_castle_remembers_${NAME}_portrait.mp4" "$ROOT/build/cinematic/out/the_castle_remembers_${NAME}_wide.mp4"; do
  echo "$(basename "$f") $(du -h "$f" | cut -f1) $(ffprobe -v error -show_entries format=duration:stream=width,height,nb_frames -of csv=p=0 "$f" | tr '\n' ' ')"
done
