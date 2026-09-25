#!/usr/bin/env bash
# Builds responsive WebP variants, a GPU texture, a blur placeholder and a colour
# palette for every artwork. Sources are Kio's untouched originals in ./images/Originals
# (plus lossless crops of them in ./images/prepared). Never upscales.
# Output: ./public/art/* and ./src/data/art-manifest.json
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=public/art
O=images/Originals
mkdir -p "$OUT" images/prepared

# ── crops (framing only — pixels are untouched) ──
# the reading-nook girl was exported inside a 720×1280 phone-story frame
magick "$O/WhatsApp Image 2026-03-08 at 22.19.33.jpeg" -crop 714x716+0+281 +repage -quality 95 images/prepared/sketchbook-nook.jpg

declare -a PAIRS=(
  "autumn-beanie|$O/WhatsApp Image 2026-09-26 at 01.32.07 (2).jpeg"
  "vows-in-bloom|$O/whatsapp.png"
  "moonlit-pond|$O/WhatsApp Image 2026-09-26 at 01.32.06.jpeg"
  "celestial-sentinel|$O/WhatsApp Image 2026-03-08 at 22.19.32 (2).jpeg"
  "tulip|$O/WhatsApp Image 2026-09-26 at 01.32.07.jpeg"
  "candlelit-library|$O/WhatsApp Image 2026-03-08 at 22.19.33 (1).jpeg"
  "sketchbook-nook|images/prepared/sketchbook-nook.jpg"
  "rose-garden|$O/WhatsApp Image 2026-03-08 at 22.19.33 (2).jpeg"
  "beneath-the-minarets|$O/WhatsApp Image 2026-03-08 at 22.19.32 (1).jpeg"
  "school-sweethearts|$O/WhatsApp Image 2026-03-08 at 22.19.32.jpeg"
  "starclip|$O/WhatsApp Image 2026-03-08 at 22.19.34.jpeg"
  "strawberry-sweet|$O/WhatsApp Image 2026-09-26 at 01.32.07 (1).jpeg"
)

rm -f "$OUT"/*.webp
echo "{" > src/data/art-manifest.json
first=1
for pair in "${PAIRS[@]}"; do
  slug="${pair%%|*}"; src="${pair#*|}"
  w=$(magick identify -format "%w" "$src"); h=$(magick identify -format "%h" "$src")
  sizes=()
  for size in 480 960 1600; do
    if (( size < w )); then
      magick "$src" -resize "${size}x" -strip -quality 84 "$OUT/$slug-$size.webp"; sizes+=("$size")
    fi
  done
  magick "$src" -strip -quality 88 "$OUT/$slug-$w.webp"; sizes+=("$w")
  magick "$src" -resize "1024x1024>" -strip -quality 82 "$OUT/$slug-tex.webp"
  lqip=$(magick "$src" -resize 24x -strip -quality 50 webp:- | base64 | tr -d '\n')
  color=$(magick "$src" -resize 1x1\! -format "#%[hex:u.p{0,0}]" info: | cut -c1-7)
  # four dominant colours, skipping the paper-white backgrounds
  palette=$(magick "$src" -resize 160x -kmeans 7 -format %c histogram:info:- 2>/dev/null | sort -rn |
    grep -oE '#[0-9A-F]{6}' | grep -viE '#(F[A-F0-9]){3}' | head -4 | sed 's/.*/"&"/' | paste -sd, -)
  [[ $first == 1 ]] || echo "," >> src/data/art-manifest.json
  first=0
  printf '  "%s": { "w": %s, "h": %s, "sizes": [%s], "color": "%s", "palette": [%s], "lqip": "data:image/webp;base64,%s" }' \
    "$slug" "$w" "$h" "$(IFS=,; echo "${sizes[*]}")" "$color" "$palette" "$lqip" >> src/data/art-manifest.json
  echo "✓ $slug ${w}x${h}"
done
echo -e "\n}" >> src/data/art-manifest.json
