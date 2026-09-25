#!/usr/bin/env bash
# Builds responsive WebP variants, a GPU texture and a blur placeholder for every artwork.
# Source PNGs live in ./images — output goes to ./public/art and ./src/data/art-manifest.json
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=public/art
mkdir -p "$OUT"

declare -a PAIRS=(
  "witch-knight|images/Witch Knight of the Glowing Wood.png"
  "vows-in-bloom|images/Vows in Bloom.png"
  "candlelit-library|images/Candlelit Library Reading Nook.png"
  "forest-centaur|images/Forest Nymph Centaur in Sunlit Glade.png"
  "hush|images/Pastel Pink Kawaii Shh Portrait.png"
  "rose-garden|images/Tender Foreheads in a Rose Garden.png"
)

echo "{" > src/data/art-manifest.json
first=1
for pair in "${PAIRS[@]}"; do
  slug="${pair%%|*}"; src="${pair#*|}"
  w=$(magick identify -format "%w" "$src"); h=$(magick identify -format "%h" "$src")
  sizes=()
  for size in 480 960 1600; do
    if (( size < w )); then
      magick "$src" -resize "${size}x" -strip -quality 82 "$OUT/$slug-$size.webp"; sizes+=("$size")
    fi
  done
  magick "$src" -strip -quality 86 "$OUT/$slug-$w.webp"; sizes+=("$w")
  # square-ish power-of-two friendly texture for WebGL
  magick "$src" -resize "1024x1024>" -strip -quality 80 "$OUT/$slug-tex.webp"
  lqip=$(magick "$src" -resize 24x -strip -quality 50 webp:- | base64 | tr -d '\n')
  color=$(magick "$src" -resize 1x1\! -format "#%[hex:u.p{0,0}]" info: | cut -c1-7)
  [[ $first == 1 ]] || echo "," >> src/data/art-manifest.json
  first=0
  printf '  "%s": { "w": %s, "h": %s, "sizes": [%s], "color": "%s", "lqip": "data:image/webp;base64,%s" }' \
    "$slug" "$w" "$h" "$(IFS=,; echo "${sizes[*]}")" "$color" "$lqip" >> src/data/art-manifest.json
  echo "✓ $slug ${w}x${h}"
done
echo -e "\n}" >> src/data/art-manifest.json
