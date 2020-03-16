#!/usr/bin/env bash
rm -rf _cards _terrain
ruby src/main/ruby/land_cards.rb
ruby src/main/ruby/horde_cards.rb
cd ../printableCardsAppender
./gradlew run --args="../windwalkers-cardgame/_terrain ../windwalkers-cardgame/imagesToPrint/terrain A4 true"
./gradlew run --args="../windwalkers-cardgame/_cards   ../windwalkers-cardgame/imagesToPrint/cards A4 false"