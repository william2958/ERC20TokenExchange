#!/usr/bin/env bash
rsync -r app/ docs/
rsync build/contracts/Exchange.json docs/
rsync build/contracts/FixedSupplyToken.json docs/
git add .
git commit -m "Adding frontend files to Github Pages"
git push
# make sh deployable with > chmod a+x deployfrontend.sh