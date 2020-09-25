#!/usr/bin/env bash

set -o errexit -o noclobber -o pipefail

function install_rbenv_upgrade_ruby() {
    # Get Homebrew:
    # ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
    brew install rbenv ruby-build
    # Add rbenv to bash so that it loads every time you open a terminal
    echo 'if which rbenv > /dev/null; then eval "$(rbenv init -)"; fi' >> ~/.bash_profile
    source ~/.bash_profile

    rbenv install 2.7.1
    rbenv global 2.7.1
    ruby -v
}
source ~/.bash_profile

rm -rf _cards* _terrain
ruby src/main/ruby/land_cards.rb
ruby src/main/ruby/horde_cards.rb
cd ../printableCardsAppender
./gradlew run --args="../windwalkers-cardgame/_terrain ../windwalkers-cardgame/imagesToPrint/terrain A4 true"
./gradlew run --args="../windwalkers-cardgame/_cards1   ../windwalkers-cardgame/imagesToPrint/cards_v1_ A4 false"
./gradlew run --args="../windwalkers-cardgame/_cards2   ../windwalkers-cardgame/imagesToPrint/cards_v2_ A4 false"
./gradlew run --args="../windwalkers-cardgame/_cards_vs   ../windwalkers-cardgame/imagesToPrint/cards_vs_ A4 false"
