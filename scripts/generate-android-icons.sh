#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Generating Android app icons...${NC}\n"

# Check if ImageMagick is installed.
# ImageMagick 7+ uses `magick`; ImageMagick 6 (Ubuntu/Debian) uses `convert`.
if command -v magick &> /dev/null; then
    MAGICK="magick"
elif command -v convert &> /dev/null; then
    MAGICK="convert"
else
    echo -e "${YELLOW}Warning: ImageMagick not found. Please install it to generate icons.${NC}"
    echo "On Fedora/RHEL: sudo dnf install ImageMagick"
    echo "On Ubuntu/Debian: sudo apt-get install imagemagick"
    exit 1
fi

# Source PNG icon (512x512)
SOURCE_ICON="public/icon-512x512.png"

if [ ! -f "$SOURCE_ICON" ]; then
    echo -e "${YELLOW}Error: Source icon not found at $SOURCE_ICON${NC}"
    exit 1
fi

# Brand colors
BG_COLOR="#299e5e"   # Treasures green

# ── Adaptive icon foreground PNGs (transparent bg, icon, safe-zone padding) ──
# Content at 47% of canvas to fit within Android's adaptive icon safe zone.

echo "Generating adaptive foreground PNGs..."

make_foreground() {
    local size=$1
    local content_size=$(echo "$size * 47 / 100" | bc)
    local dest=$2
    $MAGICK -size "${size}x${size}" "xc:none" \
        \( "$SOURCE_ICON" -resize "${content_size}x${content_size}" \) \
        -gravity center -compose over -composite \
        "$dest"
}

make_foreground 48  android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png
make_foreground 72  android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.png
make_foreground 96  android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.png
make_foreground 144 android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png
make_foreground 192 android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png

# ── Legacy launcher icons (ic_launcher.png and ic_launcher_round.png) ──
# Used on pre-API-26 devices and as fallback on some launchers.

echo "Generating legacy launcher icons..."

make_legacy_square() {
    local size=$1
    local content_size=$(echo "$size * 60 / 100" | bc)
    local dest=$2
    $MAGICK -size "${size}x${size}" "xc:${BG_COLOR}" \
        \( "$SOURCE_ICON" -resize "${content_size}x${content_size}" \) \
        -gravity center -compose over -composite \
        "$dest"
}

make_legacy_round() {
    local size=$1
    local content_size=$(echo "$size * 60 / 100" | bc)
    local dest=$2
    local mask="/tmp/circle_mask_${size}.png"
    # Create a white circle mask
    $MAGICK -size "${size}x${size}" "xc:none" \
        -fill white -draw "circle $((size/2)),$((size/2)) $((size/2)),0" \
        "$mask"
    # Fill green, apply circle mask, composite icon
    $MAGICK -size "${size}x${size}" "xc:${BG_COLOR}" \
        "$mask" -compose dst-in -composite \
        \( "$SOURCE_ICON" -resize "${content_size}x${content_size}" \) \
        -gravity center -compose over -composite \
        "$dest"
    rm -f "$mask"
}

make_legacy_square 48  android/app/src/main/res/mipmap-mdpi/ic_launcher.png
make_legacy_square 72  android/app/src/main/res/mipmap-hdpi/ic_launcher.png
make_legacy_square 96  android/app/src/main/res/mipmap-xhdpi/ic_launcher.png
make_legacy_square 144 android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png
make_legacy_square 192 android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png

make_legacy_round 48  android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png
make_legacy_round 72  android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png
make_legacy_round 96  android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png
make_legacy_round 144 android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png
make_legacy_round 192 android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png

# Update background color
BACKGROUND_COLOR_FILE="android/app/src/main/res/values/ic_launcher_background.xml"
mkdir -p android/app/src/main/res/values
cat > "$BACKGROUND_COLOR_FILE" << 'EOF'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#299e5e</color>
</resources>
EOF

# ── iOS App Icon (1024x1024, icon on green background) ──

echo "Generating iOS app icon..."

IOS_ICON_DIR="ios/App/App/Assets.xcassets/AppIcon.appiconset"

if [ -d "$IOS_ICON_DIR" ]; then
    IOS_ICON="$IOS_ICON_DIR/AppIcon-512@2x.png"
    $MAGICK -size "1024x1024" "xc:${BG_COLOR}" \
        \( "$SOURCE_ICON" -resize "614x614" \) \
        -gravity center -compose over -composite \
        "$IOS_ICON"
    echo -e "  ${GREEN}✓${NC} $IOS_ICON"
else
    echo -e "  ${YELLOW}Skipped: $IOS_ICON_DIR not found${NC}"
fi

echo -e "\n${GREEN}App icons generated successfully!${NC}"
echo -e "Icon: Treasures logo on ${GREEN}${BG_COLOR}${NC} (Treasures green)"
echo -e "Generated:"
echo -e "  Android:"
echo -e "    - ic_launcher_foreground.png (adaptive, all densities)"
echo -e "    - ic_launcher.png (legacy square, all densities)"
echo -e "    - ic_launcher_round.png (legacy round, all densities)"
echo -e "  iOS:"
echo -e "    - AppIcon-512@2x.png (1024x1024)"
