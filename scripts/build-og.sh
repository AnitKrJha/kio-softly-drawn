#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
ART=public/art
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
frame "$ART/vows-in-bloom-761.webp"    236 318 660  56 f1.png
frame "$ART/witch-knight-760.webp"     208 280 920 104 f2.png
frame "$ART/rose-garden-960.webp"      236 150 660 398 f3.png
frame "$ART/candlelit-library-480.webp" 174 174 920 408 f4.png

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
  -font "$NY" -fill '#f3ebe0' -pointsize 148 -kerning -3 -annotate +62+268 'Kio' \
  -fill '#f3ebe0' -draw 'rectangle 282,214 344,218' \
  -font "$NYI" -fill '#e8b86a' -pointsize 84 -kerning -1 -annotate +64+370 'Softly Drawn' \
  -font "$IOWAN" -fill 'rgba(243,235,224,0.72)' -pointsize 25 -kerning 0.2 -annotate +66+448 'Semi-realistic character art · Hand-drawn, no AI' \
  -fill 'rgba(243,235,224,0.14)' -draw 'rectangle 66,500 146,501' \
  -font "$IOWAN" -fill 'rgba(243,235,224,0.5)' -pointsize 19 -annotate +66+540 'Threads @softlydrawn_  ·  Fiverr ethereallogo' \
  og-raw.png

# a whisper of grain so the gradients don't band
magick og-raw.png \( -size ${W}x${H} xc:gray50 -attenuate 0.6 +noise Gaussian -colorspace gray -set colorspace sRGB -type TrueColor \) \
  -compose blend -define compose:args=5 -composite -type TrueColor -strip -sampling-factor 4:2:0 -quality 84 -interlace JPEG og.jpg
