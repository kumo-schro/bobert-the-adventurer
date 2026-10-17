#!/bin/sh
# Paint a concept picture of one take on Bobert with Codex's image generation.
#   art/bobert/tools/gen-concept.sh <style-id> "<who this Bobert is, and the art style>"
# Saves art/bobert/concepts/<style-id>.png. Only one image job runs at a time (see lock below),
# because Codex sessions running side by side have mixed up each other's pictures.
set -e
STYLE_ID="$1"
DESC="$2"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/concepts"
mkdir -p "$DIR"
LOCK="$ROOT/logs/.image-job.lock"
until mkdir "$LOCK" 2>/dev/null; do sleep 5; done
trap 'rmdir "$LOCK"' EXIT
codex exec --skip-git-repo-check -s workspace-write -C "$DIR" "Use your image generation tool to create ONE square (1024x1024) character concept image for a kids' adventure video game. The hero is called Bobert. ${DESC} Show the whole character, full body, in a confident pose, three-quarter front view, centered, on a simple background that suits the style. Original character, no text, no logos, no watermark. Use only the image you generate in this run (never copy any other existing image file). Save the final PNG in the current directory as ${STYLE_ID}.png, check it, then reply with just the file path."
