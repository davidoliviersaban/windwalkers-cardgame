require 'squib'

deck1 = Squib.xlsx file: 'src/resources/horde_cards.xlsx'
#deck1 = Squib.csv file: %w(src/resources/horde_cards.csv)
#deck2 = Squib.csv file: %w(src/resources/horde2_cards.csv)
#deck_Vs = Squib.csv file: %w(src/resources/horde_vs_cards.csv)

def drawCards(deck,dirname)
  rect layout: :bleed
  rect layout: :cut, stroke_color: :black
#  rect layout: :inside, stroke_color: "#000000"

  fill_color = Hash.new
  fill_color["Pack"] = "#AAAAFF"
  fill_color["Traine"] = "#AAFFAA"
  fill_color["Fer"] = "#FFAAAA"
  fill_color["Traceur"] = "#DD8888"
  fill_color["Consommable"] = "#FFFFFF"


  rect layout: :inside, fill_color:  deck['Position'].map{|c| fill_color[c]}, stroke_color: :black

  png file: deck["Image"].map{ |img| "src/resources/images/"+img}, layout: "Image"

  rect layout:'TopLayer', fill_color:  deck['Position'].map{|c| fill_color[c]+'66'}
#  rect layout:'BottomLayer', fill_color:  deck['Position'].map{|c| fill_color[c]+'66'}

  %w(Nom Fonction Description Pouvoir_Actif Position).each do |key|
    text str: deck[key], layout: key
  end

  png layout: deck["Position"].map{ |pos| ""+pos.to_s+"Icon"}

  png layout: deck["Tier"].map{ |ext|  "T"+ext.to_s+"Icon"  }

  png file: deck["Extension"].map{ |ext|
    if (ext != nil)
      "src/resources/helpers/"+ext+".png"
    else
      "src/resources/helpers/d6-empty.png"
    end
  }, layout: "ExtensionIcon"

  save_png prefix: deck["Id"].zip(deck["Position"],deck["Nom"],deck["Tier"]).map{|name| "%03d.%s.%s.T%s."%name}, dir: dirname#dir: '_cards'

end

def drawCutlines(deck,dirname)
    rect layout: :bleed
    rect layout: :cut
    save_png prefix: deck["Id"].zip(deck["Position"],deck["Nom"],deck["Tier"]).map{|name| "%03d.%s.%s.T%s."%name}, dir: dirname#dir: '_cards'
  end
  

Squib::Deck.new(cards: deck1["Nom"].size,
                layout: %w(src/resources/Vlayout.yml src/resources/Vcards.yml),
                width: '2.75in', height: '3.75in') do
  drawCards(deck1,'_cards1')
end


Squib::Deck.new(cards: 9,
                layout: %w(src/resources/Vlayout.yml src/resources/Vcards.yml),
                width: '2.75in', height: '3.75in') do
  drawCutlines(deck1, '_cards_cut')
end


# Squib::Deck.new(cards: deck2["Nom"].size,
#                 layout: %w(src/resources/Vlayout.yml src/resources/Vcards.yml),
#                 width: '2.5in', height: '3.5in') do
#   drawCards(deck2,'_cards2')
# end

# Squib::Deck.new(cards: deck_Vs["Nom"].size,
#                 layout: %w(src/resources/Vlayout.yml src/resources/Vcards.yml),
#                 width: '2.5in', height: '3.5in') do
#   drawCards(deck_Vs,'_cards_vs')
# end
