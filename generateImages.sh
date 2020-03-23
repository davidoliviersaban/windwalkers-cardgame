#!/usr/bin/env bash
rm -rf _cards* _terrain
ruby src/main/ruby/land_cards.rb
ruby src/main/ruby/horde_cards.rb
ruby src/main/ruby/gliders_cards.rb
cd ../printableCardsAppender
./gradlew run --args="../windwalkers-cardgame/_terrain ../windwalkers-cardgame/imagesToPrint/terrain A4 true"
./gradlew run --args="../windwalkers-cardgame/_cards1   ../windwalkers-cardgame/imagesToPrint/cards_v1_ A4 false"
#./gradlew run --args="../windwalkers-cardgame/_cards2   ../windwalkers-cardgame/imagesToPrint/cards_v2_ A4 false"
./gradlew run --args="../windwalkers-cardgame/_cardsG1   ../windwalkers-cardgame/imagesToPrint/cards_g1_ A4 false"
