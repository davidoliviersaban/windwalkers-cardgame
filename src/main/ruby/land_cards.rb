require 'squib'

deck = Squib.csv file: 'src/resources/land_cards.csv'


def drawTile(deck, dirname)
  png file: deck["Image"].map { |img| 
    if (img == nil) 
      "src/resources/terrain/city/_aberlaas.png" 
    else 
      "src/resources/terrain/"+img
    end
  }, layout: "Image"
  
  # Position of corner to lasercut the tiles
  line layout: :corner1
  line layout: :corner2
 
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

  %w(RGI1 RGI2 RGI3 T1 T2 T3).each do |key|
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

  %w(Moral Abandon).each do |key|
    text str: deck[key], layout: deck[key].map { |c| 
      if (c == nil || c == 0)
        "Empty"
      elsif (c == "Special")
        "AbandonTourFontaineText"
      else
        key+"Text"
      end
    }
    
    png layout: deck[key].map { |c| 
      if (c == nil || c == 0)
        "Empty"
      elsif (c == "Special")
        "AbandonTourFontaineIcon"
      else
        key+"Icon"
      end
    }
  end

  %w(Description).each do |key|
    text str: deck[key], layout: key
  end

  polygon layout: deck["Type"]
#  polygon layout: :cut

  save_png prefix: deck["Chapter"].map{|str| str+"."}, dir: dirname
end


def drawCutlines(deck, dirname)  
  polygon layout: :cut, stroke_color: :red
  line layout: :corner1
  line layout: :corner2
  save_png prefix: deck["Chapter"].map{|str| str+"."}, dir: dirname
end


Squib::Deck.new(cards: deck["Chapter"].size,
                layout: %w(src/resources/lands-6cm.yml),
                width: "72mm", height: "62.3mm") do # height = width*sqrt(3)/2

  drawTile(deck, '_terrain')
end

Squib::Deck.new(cards: 12,
                layout: %w(src/resources/lands-6cm.yml),
                width: "72mm", height: "62.3mm") do # height = width*sqrt(3)/2

  drawCutlines(deck, '_terrain_cut')
end