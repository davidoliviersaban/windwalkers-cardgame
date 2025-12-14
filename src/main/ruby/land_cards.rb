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

  %w(1 2 3 4 5 6).each do |key|
    polygon layout: deck["Wind"+key.to_s].map{ |c| 
    if (c == nil)
      "Empty"
    else
      "Wind"+c.to_s+"Icon"
    end
    } , n: 24, angle: (key.to_i-1)*3.14159/3
  end
  
  %w(1 2 3 4 5 6).each do |key|
    text str: deck["Wind"+key.to_s], layout: "Wind"+key.to_s, angle: -(key.to_i-1)*3.14159/3
  end

  %w(Black White Green).each do |key|
    # Dessine le bandeau sombre derrière le badge si le dé existe
    rect layout: deck[key].map { |c|
      if (c == nil)
        "Empty"
      else
        "Land"+key+"Background"
      end
    }
    # Dessine l'icône du dé
    png layout: "Land"+key, file: deck[key].map{ |c| 
      if (c == nil)
        "src/resources/helpers/d6-empty.png"
      elsif (key == "Red")
          "src/resources/helpers/d6-red.png" 
      elsif (key == "Green")
        "src/resources/helpers/d6-green.png" 
      elsif (key == "White")
        "src/resources/helpers/d6-white.png" 
      elsif (key == "Black")
        "src/resources/helpers/d6-black.png" 
      else
        "src/resources/helpers/d6-empty.png"
      end
      }
    # Dessine le texte à droite du dé
    text str: deck[key], layout: "LandText"+key.to_s
  end

  # Affichage du Moral avec une seule icône et le nombre (+1)
  %w(Moral).each do |key|
    png layout: deck[key].map { |c| 
      if (c == nil || c == 0)
        "Empty"
      else
        key+"Icon"
      end
    }
    # Affiche la valeur du moral (+1) à côté de l'icône
    text str: deck[key].map { |c|
      if (c == nil || c == 0)
        ""
      else
        "+#{c}"
      end
    }, layout: "MoralValue"
  end

  # Affichage de la Tristesse avec une seule icône et le nombre (-1 ou -2)
  # On combine Sadness1 et Sadness2 en une seule icône avec la valeur totale
  sadness_values = deck["Sadness1"].zip(deck["Sadness2"]).map { |s1, s2|
    total = (s1.to_i || 0) + (s2.to_i || 0)
    total > 0 ? total : nil
  }
  
  png layout: sadness_values.map { |c|
    if (c == nil || c == 0)
      "Empty"
    else
      "Sadness1Icon"
    end
  }
  
  text str: sadness_values.map { |c|
    if (c == nil || c == 0)
      ""
    else
      "-#{c}"
    end
  }, layout: "SadnessValue"

  # Icônes RestOne et RestAll
  %w(RestOne RestAll).each do |key|
    png layout: deck[key].map { |c| 
      if (c == nil || c == 0)
        "Empty"
      else
        key+"Icon"
      end
    }
  end

  %w(Horders).each do |key|
    png layout: deck[key].map { |c|
      if (c == nil || c == 0)
        "Empty"
      elsif (c == "RGB")
        "HordersIcon"
      else
        c+key+"Icon"
      end
    }
  end


  # Fond noir semi-transparent sous les descriptions
  rect layout: "DescriptionBackground"

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
                dpi: 327.8,
                width: "64mm", height: "58.15mm") do # height = width*sqrt(3)/2

  drawTile(deck, '.terrain')
end

Squib::Deck.new(cards: 12,
                layout: %w(src/resources/lands-6cm.yml),
                dpi: 327.8,
                width: "64mm", height: "58.15mm") do # height = width*sqrt(3)/2

  drawCutlines(deck, '.terrain_cut')
end