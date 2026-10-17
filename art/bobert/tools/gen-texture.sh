#!/bin/sh
# Make one seamless texture for a Bobert style with Codex's image generation.
#   art/bobert/tools/gen-texture.sh <style-id> <name> "<what it looks like>"
# Saves art/bobert/textures/<style-id>/<name>.png (1024x1024, tileable).
set -e
STYLE_ID="$1"
NAME="$2"
DESC="$3"
DIR="$(cd "$(dirname "$0")/.." && pwd)/textures/$STYLE_ID"
mkdir -p "$DIR"
LOCK="$(cd "$(dirname "$0")/.." && pwd)/logs/.image-job.lock"  # one image job at a time (see gen-concept.sh)
until mkdir "$LOCK" 2>/dev/null; do sleep 5; done
trap 'rmdir "$LOCK"' EXIT
RULES="Rules: original stylized art for a cheerful kids' adventure game; a flat, evenly lit, straight-on view of the surface material only (no perspective, no objects, no shadows from outside, no text, no logos); it MUST tile seamlessly on all four edges (fix the edges so left matches right and top matches bottom)."
codex exec --skip-git-repo-check -s workspace-write -C "$DIR" "Use your image generation tool to create ONE seamless tileable square texture (1024x1024) for a 3D character material: ${DESC}. ${RULES} Use only the image you generate in this run (never copy any other existing image file). Save the final PNG in the current directory as ${NAME}.png, verify it is 1024x1024 and that the edges tile, then reply with just the file path."
