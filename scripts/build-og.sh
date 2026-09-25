#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ART="$ROOT/public/art"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cd "$WORK"
NY=/System/Library/Fonts/NewYork.ttf
NYI=/System/Library/Fonts/NewYorkItalic.ttf
IOWAN="/System/Library/Fonts/Supplemental/Iowan Old Style.ttc"
W=1200; H=630
# frame <src> <w> <h> <x> <y> <out>
frame() {
  magick "$1" -resize "${2}x${3}^" -gravity center -extent "${2}x${3}" \
    \( -size "${2}x${3}" xc:none -fill white -draw "roundrectangle 0,0,$(( $2 - 1 )),$(( $3 - 1 )),10,10" \) \
    -compose DstIn -composite -repage "+$4+$5" "$6"
}
frame "$ART/autumn-beanie-960.webp"    236 318 660  56 f1.png
frame "$ART/vows-in-bloom-950.webp"     208 280 920 104 f2.png
frame "$ART/rose-garden-960.webp"      236 150 660 398 f3.png
frame "$ART/celestial-sentinel-480.webp" 174 174 920 408 f4.png

# background: ink, a low candle glow behind the wall, a faint rose bloom top-left
magick -size ${W}x${H} xc:'#0e0b09' \
  \( -size 1100x1100 radial-gradient:'rgba(232,184,106,0.13)-rgba(232,184,106,0)' -geometry +330-235 \) -compose over -composite \
  \( -size 900x900 radial-gradient:'rgba(231,154,166,0.06)-rgba(231,154,166,0)' -geometry -450-450 \) -compose over -composite \
  bg.png

layers=()
for f in f1 f2 f3 f4; do
  magick "$f.png" \( +clone -background black -shadow 70x16+0+16 \) +swap -background none -layers merge "$f-s.png"
done

magick bg.png \
  f1-s.png f2-s.png f3-s.png f4-s.png -background none -layers flatten \
  -font "$NY" -fill '#f3ebe0' -pointsize 132 -kerning -3 -annotate +58+214 'Softly' \
  -font "$NYI" -fill '#e8b86a' -pointsize 132 -kerning -3 -annotate +62+338 'Drawn' \
  -font "$IOWAN" -fill 'rgba(243,235,224,0.86)' -pointsize 30 -kerning 0.4 -annotate +66+402 'by Kio' \
  -font "$IOWAN" -fill 'rgba(243,235,224,0.72)' -pointsize 24 -kerning 0.2 -annotate +66+466 'Character art · OCs · Book covers · PFP icons' \
  -fill 'rgba(243,235,224,0.14)' -draw 'rectangle 66,500 146,501' \
  -font "$IOWAN" -fill 'rgba(243,235,224,0.5)' -pointsize 19 -annotate +66+540 'Hand-drawn, no AI  ·  Threads @softlydrawn_' \
  og-raw.png

# a whisper of grain so the gradients don't band
magick og-raw.png \( -size ${W}x${H} xc:gray50 -attenuate 0.6 +noise Gaussian -colorspace gray -set colorspace sRGB -type TrueColor \) \
  -compose blend -define compose:args=5 -composite -type TrueColor -strip -sampling-factor 4:2:0 -quality 84 -interlace JPEG "$ROOT/public/og.jpg"
