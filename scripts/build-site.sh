#!/bin/sh
# Assemble the static site that GitHub Pages serves into _site/.
# Only runtime files are published: no tests, README or tooling.
set -eu
cd "$(dirname "$0")/.."
rm -rf _site
mkdir -p _site
cp index.html _site/
cp -R css js _site/
echo "Built _site/ ($(find _site -type f | wc -l | tr -d ' ') files)"
