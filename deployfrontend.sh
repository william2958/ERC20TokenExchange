#!/usr/bin/env bash
rsync -r build/ docs/
git add .
git commit -m "Adding frontend files to Github Pages"
git push
# make sh deployable with > chmod a+x deployfrontend.sh