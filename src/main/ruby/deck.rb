require 'squib'

deck = Squib.csv file: %w(src/resources/data.csv)

Squib::Deck.new(cards: deck["Nom"].size,#cards: deck["Name"].size, # cards: 1,#
                layout: %w(src/resources/Vlayout.yml src/resources/Vcards.yml)) do
  rect layout: :bleed
#  rect layout: 'cut', stroke_color: :black # cut line as defined by TheGameCrafter
  cut_zone radius: 0.0,  stroke_color: :black
#  rect layout: :frame # safe zone as defined by TheGameCrafter
  rect layout: :frame, fill_color: :white
  rect layout: :inside
  safe_zone radius: 0.0, stroke_color: :red

  fillcolor = Hash.new
  fillcolor["Pack"] = "#AAAAFF"
  fillcolor["Traine"] = "#AAFFAA"
  fillcolor["Fer"] = "#FFAAAA"
  fillcolor["Traceur"] = "#FFFFAA"
  fillcolor[""] = "#FFFFFF"

  %w(Position).each do |key|
    rect layout: :inside, fill_color:  deck[key].map{|c| fillcolor[c]}
  end



  png file: deck["Image"].map{ |img| "src/resources/images/"+img}, layout: "Image"

  %w(Nom Fonction Description Pouvoir_Actif Position).each do |key|
    text str: deck[key], layout: key
  end

  

  save_png prefix: deck["Nom"]

end