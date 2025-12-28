# Image Assets for BGA Windwalkers

This folder should contain the following sprite sheets and images for the BGA implementation:

## Required Images

### 1. characters.png

- Sprite sheet with all 71 character cards
- Recommended size: 80x120 pixels per card
- Arrange in a grid (e.g., 10 columns x 8 rows)
- Order should match character IDs in material.inc.php

### 2. dice.png

- Sprite sheet with all dice faces
- 5 dice types x 6 faces each = 30 sprites
- Recommended size: 50x50 pixels per face
- Colors: Blue, White, Green, Black, Violet

### 3. terrain.png

- Sprite sheet with terrain hex tiles
- Types: plain, forest, mountain, hut, cemetery, lake, swamp, cliff
- Recommended size: 100x86 pixels per hex (pointy-top)

### 4. cities.png

- Sprite sheet with city hex tiles
- Cities: Aberlaas, Port-Choon, Carthago, Ker-Hoent, Barahinn
- Recommended size: 100x86 pixels per hex

### 5. villages.png

- Sprite sheet with village hex tiles
- 3 village types (green, blue, brown)
- Recommended size: 100x86 pixels per hex

### 6. wind_tokens.png

- Sprite sheet with wind force tokens
- 6 force levels (1-5 and F for Furevent)
- Recommended size: 40x40 pixels per token

### 7. game_icon.png

- Game icon for BGA interface
- Size: 50x50 pixels

### 8. game_box.png

- Game box image for BGA interface
- Size: 180x150 pixels

## Image Generation

You can use the existing assets from:

- /src/resources/card-items/
- /windwalker-web/public/terrain/
- /src/resources/terrain/

Or generate new sprites using the generateImages.sh script.
