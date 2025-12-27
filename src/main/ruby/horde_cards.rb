require 'squib'

deck1 = Squib.xlsx file: 'src/resources/horde_cards.xlsx'

# Nettoyer les balises <html></html> ajoutées par la gem roo
deck1['Pouvoir_Actif'] = deck1['Pouvoir_Actif'].map { |s| s.to_s.gsub(/<\/?html>/, '') }

#deck1 = Squib.csv file: %w(src/resources/horde_cards.csv)
#deck2 = Squib.csv file: %w(src/resources/horde2_cards.csv)
#deck_Vs = Squib.csv file: %w(src/resources/horde_vs_cards.csv)

now = DateTime.now.to_s

# Helper function to wrap text with letter_spacing in Pango markup
def wrap_with_letter_spacing(text, letter_spacing_value = '-5120')
  if text.is_a?(Array)
    text.map { |t| "<span letter_spacing='#{letter_spacing_value}'>#{t}</span>" }
  else
    "<span letter_spacing='#{letter_spacing_value}'>#{text}</span>"
  end
end

def drawCards(deck, dirname, now)
  rect layout: :bleed

  # Couleur du bord intérieur (dorée pour traceurs, blanc pour les autres)
  rect layout: :cut, fill_color: deck['Position'].map{|c| 
    if c == "Traceur"
      "#AC9156"
    else
      :white
    end
  }

  # Couleur de fond pour la carte entière selon la position
  card_bg_color = Hash.new("#FFFFFF")
  card_bg_color["Traceur"] = "#B83002"  # Terracotta pour traceurs
  card_bg_color["Fer"] = "#B83002"      # Terracotta pour fer
  card_bg_color["Pack"] = "#026FB8"     # Bleu pour pack
  card_bg_color["Traine"] = "#5DB834"   # Vert pour traine
  card_bg_color["Croc"] = "#5DB834"     # Vert pour croc (même que traine)

  # # Contour de la carte avec la couleur de position
  rect layout:'BottomLayer', fill_color: deck['Position'].map{|c| card_bg_color[c]}

  png file: deck["Image"].map{ |img| "src/resources/images/"+img}, layout: "Image"


  # SVG de position (contient les bandeaux nom + position/fonction)
  svg file: deck['Position'].map { |pos|
    # Normaliser le nom pour correspondre aux fichiers SVG
    svg_name = pos.upcase
    "src/resources/card-items/Position=#{svg_name}.svg"
  }, layout: 'PositionSVG'


  text str: wrap_with_letter_spacing(deck['Nom']), layout: 'Nom', markup: true
  text str: wrap_with_letter_spacing(deck['Fonction']), layout: 'Fonction', markup: true
  # Pouvoir avec icônes PNG inline via embed
  # width and height of png must be specified to avoid layout shifting
  text str: deck['Pouvoir_Actif'], layout: 'Pouvoir_Actif' do |embed|
    embed.png key: ':tap:',          file: 'src/resources/helpers/tap-card.png',             width: 60, height: 60, dy: -50
    embed.svg key: ':card:',         file: 'src/resources/helpers/card.svg',                 width: 40, height: 50, dy: -43
    embed.svg key: ':discard:',      file: 'src/resources/helpers/discard.svg',              width: 35, height: 50, dy: -43
    embed.svg key: ':missing:',      file: 'src/resources/helpers/missing.svg',              width: 40, height: 50, dy: -43
    embed.png key: ':terrain:',      file: 'src/resources/helpers/d6-green.png',             width: 60, height: 60, dy: -45
    embed.png key: ':fatalite:',     file: 'src/resources/helpers/d6-black.png',             width: 60, height: 60, dy: -45
    embed.png key: ':tous-des:',     file: 'src/resources/helpers/d6-black-white-green.png', width: 60, height: 60, dy: -45
    embed.png key: ':tous-mes-des:', file: 'src/resources/helpers/d6-blue-violet.png',       width: 60, height: 60, dy: -45
    embed.png key: ':mes-des:',      file: 'src/resources/helpers/d6-blue.png',              width: 60, height: 60, dy: -45
    embed.png key: ':epreuve:',      file: 'src/resources/helpers/d6-white-green.png',       width: 60, height: 60, dy: -45
    embed.png key: ':vent:',         file: 'src/resources/helpers/d6-white.png',             width: 60, height: 60, dy: -45
    embed.png key: ':violet:',       file: 'src/resources/helpers/d6-violet.png',            width: 60, height: 60, dy: -45
    embed.svg key: ':tuile:',        file: 'src/resources/helpers/hex-tile.svg',             width: 45, height: 50, dy: -38
    embed.png key: ':moral:',        file: 'src/resources/helpers/moral.png',                width: 35, height: 45, dy: -40
    embed.png key: ':force-1:',      file: 'src/resources/helpers/wind-force-1.png',         width: 50, height: 50, dy: -38
    embed.png key: ':force-2:',      file: 'src/resources/helpers/wind-force-2.png',         width: 50, height: 50, dy: -38
    embed.png key: ':force-3:',      file: 'src/resources/helpers/wind-force-3.png',         width: 50, height: 50, dy: -38
    embed.png key: ':force-4:',      file: 'src/resources/helpers/wind-force-4.png',         width: 50, height: 50, dy: -38
    embed.png key: ':force-5:',      file: 'src/resources/helpers/wind-force-5.png',         width: 50, height: 50, dy: -38
    embed.png key: ':force-6:',      file: 'src/resources/helpers/wind-force-6.png',         width: 50, height: 50, dy: -38
    embed.svg key: ':force-x:',      file: 'src/resources/helpers/wind-x.svg',               width: 45, height: 50, dy: -40
    embed.svg key: ':force:',        file: 'src/resources/helpers/wind.svg',                 width: 45, height: 50, dy: -38
    # embed.png key: ':no-vent:',      file: 'src/resources/helpers/cancel-wind.png',          width: 50, height: 50, dy: -38  # TODO: missing file
    embed.png key: ':rest:',         file: 'src/resources/helpers/untap-card.png',           width: 57, height: 57, dy: -45
    embed.png key: ':rest-all:',     file: 'src/resources/helpers/untap-all-card.png',       width: 57, height: 57, dy: -45
  end

  # Position est maintenant hardcodée dans le SVG, plus besoin de l'afficher
  # text str: deck["Position"]..., layout: "Position"

  # Ligne de séparation et texte historique (Flavour Text)
  rect layout: deck["Description"].map { |h|
    if (h == nil || h.to_s.empty?)
      "Empty"
    else
      "FlavourSeparator"
    end
  }
  text str: deck["Description"], layout: deck["Description"].map { |h|
    if (h == nil || h.to_s.empty?)
      "Empty"
    else
      "FlavourText"
    end
  }

  svg layout: deck["Tier"].map{ |ext|  "T"+ext.to_s+"Icon"  }

  png file: deck["Extension"].map{ |ext|
    if (ext != nil)
      "src/resources/helpers/"+ext+".png"
    else
      "src/resources/helpers/d6-empty.png"
    end
  }, layout: "ExtensionIcon"

  text str: now, layout: :date
  text str: deck["Id"], layout: :id_card
  text str: deck["Retravailler"], layout: :date, x: 500
  save_png prefix: deck["Id"].zip(deck["Position"],deck["Nom"],deck["Tier"]).map{|name| "%03d.%s.%s.T%s."%name}, dir: dirname#dir: '_cards'

end

def drawCutlines(deck,dirname)
    rect layout: :bleed
    rect layout: :cut
    save_png prefix: deck["Id"].zip(deck["Position"],deck["Nom"],deck["Tier"]).map{|name| "%03d.%s.%s.T%s."%name}, dir: dirname#dir: '_cards'
end

def drawBack(deck, dirname)
    rect layout: :bleed
    rect layout: :cut, stroke_color: :black
    png file: deck["Position"].map{ |img| "src/resources/images/cover_"+img.downcase+".png"}, layout: :inside
    save_png prefix: deck["Id"].zip(deck["Position"],deck["Nom"],deck["Tier"]).map{|name| "%03d.%s.%s.T%s."%name}, dir: dirname#dir: '_cards'
end

Squib::Deck.new(cards: deck1["Nom"].size,
                layout: %w(src/resources/Vlayout.yml src/resources/Vcards.yml),
                width: '2.75in', height: '3.75in') do
  drawCards(deck1,'.cards1', now)
end


Squib::Deck.new(cards: 9,
                layout: %w(src/resources/Vlayout.yml src/resources/Vcards.yml),
                width: '2.75in', height: '3.75in') do
  drawCutlines(deck1, '.cards_cut')
end


Squib::Deck.new(cards: deck1["Nom"].size,
                layout: %w(src/resources/Vlayout.yml src/resources/Vcards.yml),
                width: '2.75in', height: '3.75in') do
  drawBack(deck1, '.cards_back')
end


# Squib::Deck.new(cards: deck2["Nom"].size,
#                 layout: %w(src/resources/Vlayout.yml src/resources/Vcards.yml),
#                 width: '2.5in', height: '3.5in') do
#   drawCards(deck2,'.cards2')
# end

# Squib::Deck.new(cards: deck_Vs["Nom"].size,
#                 layout: %w(src/resources/Vlayout.yml src/resources/Vcards.yml),
#                 width: '2.5in', height: '3.5in') do
#   drawCards(deck_Vs,'.cards_vs')
# end
