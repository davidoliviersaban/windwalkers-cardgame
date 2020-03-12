require 'squib'

deck = Squib.csv file: %w(src/resources/horde_cards.csv)
#deck = Squib.csv file: %w(src/resources/data.csv)

Squib::Deck.new(cards: deck["Nom"].size,#cards: deck["Name"].size, # cards: 1,#
                layout: %w(src/resources/Vlayout.yml src/resources/Vcards.yml),
                width: '2.5in', height: '3.5in') do
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
  fill_color[""] = "#FFFFFF"

  %w(Position).each do |key|
    rect layout: :inside, fill_color:  deck[key].map{|c| fill_color[c]}
  end

  png file: deck["Image"].map{ |img| "src/resources/images/"+img}, layout: "Image"

  %w(Nom Fonction Description Pouvoir_Actif Position).each do |key|
    text str: deck[key], layout: key
  end

  png layout: deck["Position"].map{ |pos|
    if (pos == "Traine")
      "AbandonIcon"
    else
      "Empty"
    end
  }

  save_png prefix: deck["Nom"], dir: '_cards'

end