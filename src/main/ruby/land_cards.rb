require 'squib'

deck = Squib.csv file: 'src/resources/land_cards.csv'

def drawChallenge(deck, dirname)

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
end

def drawWinds(deck, dirname)
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
end

def drawRestZone(deck, dirname)
  # Affiche le fond si OnRest n'est pas vide
  rect layout: deck["OnRest"].map { |c|
    if (c == nil || c.to_s.empty?)
      "Empty"
    else
      "RestZoneBackground"
    end
  }

  # Affiche l'icône tente
  png layout: deck["OnRest"].map { |c|
    if (c == nil || c.to_s.empty?)
      "Empty"
    else
      "RestTentIcon"
    end
  }

  # Affiche la flèche →
  text str: deck["OnRest"].map { |c|
    if (c == nil || c.to_s.empty?)
      ""
    else
      "▶"
    end
  }, layout: deck["OnRest"].map { |c|
    if (c == nil || c.to_s.empty?)
      "Empty"
    else
      "RestArrow"
    end
  }

  # Affiche les effets du repos (position 1)
  png layout: deck["OnRest"].map { |c|
    if (c == nil || c.to_s.empty?)
      "Empty"
    else
      effects = c.to_s.split("+")
      if effects[0] == "One"
        "RestEffect1Icon"  # flip-card en position 1
      elsif effects[0] == "All"
        "RestAllPos1Icon"  # flip-all-cards en position 1
      elsif effects[0] == "Discard"
        "RestEffect3Icon"  # discard en position 1
      else
        "Empty"
      end
    end
  }, file: deck["OnRest"].map { |c|
    if (c == nil || c.to_s.empty?)
      "src/resources/helpers/d6-empty.png"
    else
      effects = c.to_s.split("+")
      if effects[0] == "One"
        "src/resources/helpers/flip-card.png"
      elsif effects[0] == "All"
        "src/resources/helpers/flip-all-cards2.png"
      elsif effects[0] == "Discard"
        "src/resources/helpers/discard.png"
      else
        "src/resources/helpers/d6-empty.png"
      end
    end
  }

  # Affiche les effets du repos (position 2 si +)
  png layout: deck["OnRest"].map { |c|
    if (c == nil || c.to_s.empty?)
      "Empty"
    else
      effects = c.to_s.split("+")
      if effects.length > 1
        "RestEffect2Icon"
      else
        "Empty"
      end
    end
  }, file: deck["OnRest"].map { |c|
    if (c == nil || c.to_s.empty?)
      "src/resources/helpers/d6-empty.png"
    else
      effects = c.to_s.split("+")
      if effects.length > 1
        if effects[1] == "One"
          "src/resources/helpers/flip-card.png"
        elsif effects[1] == "All"
          "src/resources/helpers/flip-all-cards2.png"
        elsif effects[1] == "Discard"
          "src/resources/helpers/discard.png"
        else
          "src/resources/helpers/d6-empty.png"
        end
      else
        "src/resources/helpers/d6-empty.png"
      end
    end
  }
end

def drawPermanentZone(deck, dirname)
  # Affiche le fond si PermanentZone n'est pas vide
  polygon layout: "LowerHalf"

  # Affichage du Moral avec une seule icône et le nombre (+1 ou -2)
  png layout: deck["Moral"].map { |c| 
    if (c == nil || c.to_s.empty? || c.to_i == 0)
      "Empty"
    else
      "MoralIcon"
    end
  }
  # Affiche la valeur du moral avec son signe (style différent si négatif)
  text str: deck["Moral"].map { |c|
    if (c == nil || c.to_s.empty? || c.to_i == 0)
      ""
    elsif (c.to_i > 0)
      "+#{c.to_i}"
    else
      "#{c.to_i}"
    end
  }, layout: deck["Moral"].map { |c|
    if (c == nil || c.to_s.empty? || c.to_i == 0)
      "Empty"
    # elsif (c.to_i < 0)
    #   "MoralValueNegative"
    else
      "MoralValue"
    end
  }

  # Affichage Recruit (recrutement)
  png layout: deck["Recruit"].map { |c|
    if (c == nil || c.to_s.empty?)
      "Empty"
    elsif (c == "RGB")
      "RecruitIcon"
    else
      c+"RecruitIcon"
    end
  }

  # Affichage FreeRest (flip one gratuit)
  png layout: deck["FreeRest"].map { |c|
    if (c == nil || c.to_s.empty? || c.to_s != 'One')
      "Empty"
    else
      "FreeRestIcon"
    end
  }
end

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

  drawChallenge(deck, dirname)
  # === ZONE PERMANENTE ===
  drawPermanentZone(deck, dirname)
  # === ZONE DE REPOS ===
  drawRestZone(deck, dirname)

  # juste pour la rose des vents
  drawWinds(deck, dirname)

  # Fond noir semi-transparent sous les descriptions
  # rect layout: "DescriptionBackground"

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