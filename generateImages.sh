#!/usr/bin/env bash
ruby src/main/ruby/hexagons.rb 
ruby src/main/ruby/deck.rb 
cd ../printableCardsAppender
./gradlew run --args="../windwalkers-cardgame/_terrain ../windwalkers-cardgame/imagesToPrint/terrain A4 true" 
./gradlew run --args="../windwalkers-cardgame/_cards   ../windwalkers-cardgame/imagesToPrint/cards A4 true" 