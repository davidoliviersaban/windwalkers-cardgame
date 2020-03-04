require 'squib'

deck = Squib.csv file: %w(src/resources/land_cards.csv)

Squib::Deck.new(cards: deck["Chapitre"].size(),
                layout: %w(src/resources/hexa.yml),
                width: "2.5in", height: "2.2in") do 
#                width: "2.8in", height: "2.5in") do 

  png file: deck["Image"].map { |img| 
    if (img == nil) 
      "src/resources/terrain/Terrain Contre.png" 
    else 
      "src/resources/terrain/"+img
    end
  }, layout: "Image", height: :scale
  
  polygon layout: :bleed
  polygon layout: :cut
#  polygon layout: :outline
 
  %w(1 4).each do |key|
    polygon layout: "Vent"+key+"Icone", n: 20, angle: (key.to_i-1)*3.14159/3
  end
  %w(2 5).each do |key|
    polygon layout: "Vent"+key+"Icone", n: 3, angle: (key.to_i-1)*3.14159/3
  end
  %w(3 6).each do |key|
    polygon layout: "Vent"+key+"Icone", n: 4, angle: (key.to_i-1)*3.14159/3
  end

  %w(1 2 3 4 5 6).each do |key|
    text str: key, layout: "Vent"+key, angle: -(key.to_i-1)*3.14159/3
  end

  %w(Incolor Red Green Trick).each do |key|
#    rect layout: "Terrain"+key, radius: 0, stroke_color: '#00000000'
#    text str: deck[key], layout: "Terrain"+key
  end

  %w(RGI1 RGI2 RGI3 T1 T2 T3 T4).each do |key|
    png file: deck[key].map{ |c| 
    if (c == nil)
      "src/resources/helpers/d6-empty.png"
    elsif (c == "R")
      "src/resources/helpers/d6-red.png" 
    elsif (c == "G")
      "src/resources/helpers/d6-green.png" 
    elsif (c == "I")
      "src/resources/helpers/d6-white.png" 
    elsif (c == "T")
      "src/resources/helpers/d6-black.png" 
    else
       "src/resources/helpers/d6-empty.png"
    end
    },
  layout: "Terrain"+key
  end


  %w(Description).each do |key|
    text str: deck[key], layout: key
  end


  save_png prefix: deck["Chapitre"].map{|str| str+"."}, dir: '_terrain'
end
