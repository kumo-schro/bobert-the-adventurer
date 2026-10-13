#!/bin/sh
# Make one seamless texture with Codex's image generation.
#   art/tools/gen-texture.sh <name> "<what it looks like>"
# Saves art/textures/<name>.png (1024x1024, tileable). Shared style rules are added to every prompt.
set -e
NAME="$1"
DESC="$2"
DIR="$(cd "$(dirname "$0")/../textures" && pwd)"
STYLE="Style rules: original stylized game art for a cheerful surreal psychedelic garden world; vibrant, saturated, high contrast; soft painterly hand-painted look with chunky simple shapes (not pixel art, not voxel, not photoreal); flat top-down/orthographic view of the surface, no perspective, no text, no logos, no objects floating; it MUST tile seamlessly on all four edges (fix the edges so left matches right and top matches bottom)."
codex exec --skip-git-repo-check -s workspace-write -C "$DIR" "Use your image generation tool to create ONE seamless tileable square texture (1024x1024) for a video game: ${DESC}. ${STYLE} Save the final PNG in the current directory as ${NAME}.png, verify the edges tile, then reply with just the file path."
