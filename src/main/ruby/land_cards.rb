require 'squib'
require 'yaml'

deck = Squib.csv file: 'src/resources/land_cards.csv'


# Charge le layout YAML pour récupérer les coordonnées des trapèzes
LAYOUT_DATA = YAML.load_file('src/resources/lands-95mm.yml')

def drawChallenge(deck)

  %w(Black White Green).each do |key|
    # Affiche le trapèze
    layoutBackground = "Land#{key}Background"
    svg layout: layoutBackground, file: deck[key].map{ |c|
      if (c == nil)
        "src/resources/helpers/empty.svg"
      else
        "src/resources/card-items/dice-background.svg"
      end
    }
    
    # Dessine l'icône du dé
    layoutDice = "Land#{key}"
    png layout: layoutDice, file: deck[key].map{ |c|
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

def drawWinds(deck)
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

def drawPermanentZone(deck)
  # Affiche le fond si PermanentZone n'est pas vide
  svg layout: deck["Template"].map{ |template|
    ### Dont need to display background if no template
    if (template == nil)
      "Empty"
    else
      "PermanentZoneBackground"
    end
  }
  svg layout: "PermanentZoneForeground", file: deck["Template"].map{ |template|
      if (template == nil)
        "src/resources/empty.svg"
      else
        "src/resources/card-items/#{template}.svg"
      end
    }

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

  drawChallenge(deck)
  # === ZONE PERMANENTE ===
  drawPermanentZone(deck)

  # juste pour la rose des vents
  # drawWinds(deck, dirname)

  # Fond noir semi-transparent sous les descriptions
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

Squib::Deck.new(cards: deck["Chapter"].size,
                layout: %w(src/resources/lands-95mm.yml),
                dpi: 327.8,
                width: "101mm", height: "93mm") do # height = width*sqrt(3)/2

  drawTile(deck, '.terrain_xl')
end
