#!/usr/bin/env bash

set -o errexit -o noclobber -o pipefail

RUBY_VERSION=3.0.3

if ! command -v rbenv &> /dev/null; then
    brew install rbenv ruby-build gobject-introspection gdk-pixbuf
else
    echo "rbenv already installed"
fi

if ! ruby -v | grep $RUBY_VERSION; then
    if ! rbenv versions | grep $RUBY_VERSION; then
        rbenv install $RUBY_VERSION && echo "ruby $RUBY_VERSION installed"
    fi
    rbenv global $RUBY_VERSION
else
    echo "ruby $RUBY_VERSION already installed"
fi

eval "$(rbenv init - zsh)"
gem env

local_install_printableCardAppender() {
    cd ..
    git clone https://github.com/davidoliviersaban/printableCardsAppender.git
    ./gradlew build
}

rbenv global $RUBY_VERSION
gem list | grep pkg-config || gem install pkg-config && echo "pkg-config installed"
gem list | grep squib || gem install squib && echo "squib installed" || local_install_squib
gem update --system

rm -rf .cards* .terrain*
ruby src/main/ruby/land_cards.rb
ruby src/main/ruby/horde_cards.rb

if [ ! -d "../printableCardsAppender" ]; then
    local_install_printableCardAppender
fi

cd ../printableCardsAppender
./gradlew appendCard --args="../windwalkers-cardgame/.terrain ../windwalkers-cardgame/printable/terrain   A4 true"
# ./gradlew appendCard --args="../windwalkers-cardgame/.terrain_cut ../windwalkers-cardgame/printable/.terrain_cut   A4 true"
# ./gradlew appendCard --args="../windwalkers-cardgame/.cards1  ../windwalkers-cardgame/printable/cards_v1_ A4 false"
# ./gradlew appendCard --args="../windwalkers-cardgame/.cards_cut  ../windwalkers-cardgame/printable/cards_cut_ A4 false"
# ./gradlew appendCard --args="../windwalkers-cardgame/.cards_back  ../windwalkers-cardgame/printable/cards_back_ A4 false"
