#!/usr/bin/env bash

set -o errexit -o noclobber -o pipefail

rm -rf _cards* _terrain
ruby src/main/ruby/land_cards.rb
ruby src/main/ruby/horde_cards.rb
cd ../printableCardsAppender
./gradlew appendCard --args="../windwalkers-cardgame/_terrain ../windwalkers-cardgame/imagesToPrint/terrain A4 true"
./gradlew appendCard --args="../windwalkers-cardgame/_cards1   ../windwalkers-cardgame/imagesToPrint/cards_v1_ A4 false"
