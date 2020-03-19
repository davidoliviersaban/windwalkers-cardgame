require 'squib'

deck = Squib.csv file: %w(src/resources/gliders_cards.csv)
#deck = Squib.csv file: %w(src/resources/data.csv)

def drawCards(deck,dirname)
#  rect layout: :bleed
#  rect layout: 'cut', stroke_color: :black # cut line as defined by TheGameCrafter
#  cut_zone radius: 0.0,  stroke_color: :black
#  rect layout: :frame # safe zone as defined by TheGameCrafter
#  rect layout: :frame, fill_color: :white
#  rect layout: :inside
#  safe_zone radius: 0.0, stroke_color: :red
  rect layout: :bleed
  rect layout: :cut

  fill_color = Hash.new
  fill_color["Denree"] = "#AAAAFF"
  fill_color["Consommable"] = "#FFFFFF"
  fill_color["Equipement"] = "#FFAAAA"
  fill_color["Capitaine"] = "#DD8888"
  fill_color["Mission"] = "#AA88AA"

  rect layout: :inside, fill_color:  deck['Fonction'].map{|c| fill_color[c]}

  png file: deck["Image"].map{ |img| "src/resources/images/gliders/"+img}, layout: "Image"

  rect layout:'TopLayer', fill_color:  deck['Fonction'].map{|c| fill_color[c]+'66'}
#  rect layout:'BottomLayer', fill_color:  deck['Position'].map{|c| fill_color[c]+'66'}

  %w(Nom Description Pouvoir_Actif Pouvoir_Passif Fonction).each do |key|
    text str: deck[key], layout: key
  end

  png layout: deck["Tier"].map{ |tier|
    if (tier)
      tier+'Icon'
    else
      'Empty'
    end
  }

  save_png prefix: deck["Nom"], dir: dirname#dir: '_cards'

end


Squib::Deck.new(cards: deck["Nom"].size,#cards: deck["Name"].size, # cards: 1,#
                layout: %w(src/resources/Vlayout.yml src/resources/Vcards.yml),
                width: '2.5in', height: '3.5in') do
  drawCards(deck,'_cardsG1')
end