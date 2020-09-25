require 'squib'

deck1 = Squib.xlsx file: %w(src/resources/horde_cards.xlsx)

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
  fill_color["Pack"] = "#AAAAFF"
  fill_color["Traine"] = "#AAFFAA"
  fill_color["Fer"] = "#FFAAAA"
  fill_color["Traceur"] = "#DD8888"
  fill_color["Consommable"] = "#FFFFFF"


  rect layout: :inside, fill_color:  deck['Position'].map{|c| fill_color[c]}

  png file: deck["Image"].map{ |img| "src/resources/images/"+img}, layout: "Image"

  rect layout:'TopLayer', fill_color:  deck['Position'].map{|c| fill_color[c]+'66'}
#  rect layout:'BottomLayer', fill_color:  deck['Position'].map{|c| fill_color[c]+'66'}

  %w(Nom Fonction Description Pouvoir_Actif Position).each do |key|
    text str: deck[key], layout: key
  end

  png layout: deck["Position"].map{ |pos| pos+"Icon"}

  png file: deck["Extension"].map{ |ext|
    if (ext != nil)
      "src/resources/helpers/"+ext+".png"
    else
      "src/resources/helpers/d6-empty.png"
    end
  }, layout: "ExtensionIcon"

  png layout: deck["Tier"].map{ |tier|
    tier+'Icon'
  }

  save_png prefix: deck["Id"].zip(deck["Position"],deck["Nom"]).map{|name| "%03d.%s.%s"%name}, dir: dirname#dir: '_cards'

end


Squib::Deck.new(cards: deck1["Nom"].size,#cards: deck["Name"].size, # cards: 1,#
                layout: %w(src/resources/Vlayout.yml src/resources/Vcards.yml),
                width: '2.5in', height: '3.5in') do
  drawCards(deck1,'_cards1')
end