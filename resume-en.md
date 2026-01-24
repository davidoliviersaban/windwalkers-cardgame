# **Windwalkers: Rules Guide**

---

## **1. Introduction**

Welcome to **Windwalkers**, a narrative and strategic game where players lead a Horde across lands swept by powerful winds.

**Your goal:** guide your group from the starting city to the final destination, braving winds and treacherous terrain, while keeping your Hordiers' morale high and making the right strategic choices.

This is both a race against the game — where the elements and challenges stand in your way — and a race against yourself, as you strive to beat your own score and push further each time.

---

## **2. Setup**

### **Required Components**

- **Dice**:
  - 10 blue dice — Horde dice.
  - 9 white dice — wind dice.
  - 6 green dice — terrain dice (tile effects).
  - 6 black and purple dice — special trial dice.
- **Cards**: 54 characters (Hordiers) with unique powers.
- **Pre-built board** for each chapter.
- **Terrain tiles**: Cities, villages, and special terrains.

### **Steps**

1. **Place the board** for chapter 1.  
   ![Chapter 1 Board][plateau]
2. Each player chooses **8 Hordiers**:
   - 1 Tracker, 2 Irons, 3 Packs, 2 Trails.
   - Takes the 6 dice of their Horde.
3. Place your Horde token on **Aberlaas**, the starting point.  
   ![Aberlaas][Aberlaas]

---

## **3. Turn Sequence**

### **Turn Steps**

0. **Continue or rest**: _After the first turn_.

- **Rest**: Apply the optional tile effect. Change day. Recover your 6 dice.
- **Persevere**: Lose 1 die and continue to **counter**.

1.  **Choose a direction**: Place the Horde token toward an adjacent tile, between the 2 tiles.
2.  **Discover the wind strength**: Draw a wind token and place it on the tile.
3.  **Roll the dice**: Roll the Horde dice and the trial dice. 3 constraints:
    - Sum: the sum of the Horde dice ![d6 Horde][d6-blue] must be >= the sum of the trial dice ![d6 Trial][d6-white-green].
    - Wind: the wind strength ![wind][wind-x] indicates the number of Horde dice required to match the trial dice.
    - Terrain: green terrain dice ![d6 Terrain][d6-green] are resolved first.
    - Black fate dice ![d6 Fate][d6-black] are always countered by an equal number of purple dice ![d6 Destiny][d6-violet]. They are in addition to the trial, not influenced by wind. Purple dice can only be modified with morale.

> - **Exceptions**:
>   - Board edge: If a tile is not completely surrounded by other tiles, it loses 1 white die.
>   - The Stormwind (Strength 6) always has 6 dice. If the board edge rule would apply, place a white die on face 6. (you don't mess with a Stormwind)

4.  **Challenge resolution**:
    - **Success**: Move the Horde and apply the tile effects.
    - **Failure**: Stay in place and lose 1 Hordier.

**Terrain example:**  
![Terrain Tile 1][steppe]

---

## **4. Morale and Powers**

### **Morale**

- **Usage:**
  - Modify a die: ±1 for each morale point ![Morale][moral] spent.
  - Reroll all Horde dice.
  - Arrive on a tile with bonus or penalty.

### **Hordier Powers**

Each Hordier has a unique power usable once per rest. These powers can influence dice, morale, or terrain conditions.  
Examples:

- **Ryage the Gambler (Tracker)**:  
  _"Roll 1 die. If its value is greater than or equal to the wind strength, ignore all dice."_

  ![Ryage Card][traceur]

- **Blanchette de Gaude (Iron)**:  
  _"Apply ±1 to your blue dice as many times as the wind strength."_

  ![Blanchette Card][fer]

---

## **5. Terrain Types**

Once the tile is reached, terrains have 2 effect zones, one mandatory and one optional if resting.

### **Terrain**

- Passage: Gain or lose morale.
- Rest: Rest 1 Hordier.

### **Cities**

- Passage: You gain +1 morale point, rest 1 Hordier and recruit up to 2 Irons, 2 Packs and 2 Trails.
- Rest: All Hordiers recover their power.

### **Villages**

- Passage: Rest 1 Hordier and recruit up to 2 Irons or 2 Packs or 2 Trails
- Rest: All Hordiers recover their power.
  **Example:**
  ![Green Village][village]

### **Special Terrains**

- Bring additional challenges with black/purple dice or unique effects.
  **Example:**  
  ![Fountain Tower][tourfontaine]

---

## **6. Scoring**

At the end of each chapter, calculate your score as follows:

- **Progression points**: 1 point per tile crossed.
- **Perseverance points**: score (1,2,3,4,5,6) additional points by persevering.
- **Remaining morale**: 1 point per morale point.
- **Remaining Hordiers**: 2 points per Hordier in the Horde.
- **Stormwinds**: 3 points per Stormwinds (wind strength 6) defeated.
- **Chapter Bonus**:
  - Gate of Hurle: 5 additional points.

**Example tile with bonus:**  
![Bonus Tile][windmill]

## PAR for a chapter and for a game

Each chapter has its PAR. It is therefore possible to finish it with a BIRDIE(-1), EAGLE(-2) or BOGEY(+1)...

Chapter PARs:

- Chapter 1: 2 days
- Chapter 2: 4 days
- Chapter 3: 3 days
- Chapter 4: 4 days

---

## **7. Gameplay Examples**

### Turn Example

- You choose a mountain tile. You roll your Horde dice (blue) and try to counter the trial (turbulence/terrain — white/green dice).
- You use **Ashley (Pack)**'s power:  
  _"Rest all your hordiers. Lose 1 morale point per rested Hordier."_

  ![Ashley Card][pack]

### Scoring Example

- You have crossed 5 tiles of chapter 1 without stopping, have 7 morale, and 3 living Hordiers.
- Calculation:
  - Progression: 5 points.
  - Morale: 7 points.
  - Hordiers: 6 points (2 per Hordier).
  - Perseverance: 0+1+2+3+4 = 10 points.
  - Stormwinds: 0 points.
  - Special: 0 points.
  - Total: **28 points**.
  - PAR: BIRDIE(-1).

## Building a Chapter

Follow the chapter shapes if possible.
Respect the distance between cities.

To increase the challenge:

- Place green villages in hard-to-reach areas
- Remove green villages from the game
- Replace some tiles with those from later chapters
- Create your own chapters

---

Icon tip: find the visual icon reference in `lexicon.md`.

[scenario1]: src/resources/readme/chapter1.md
[Aberlaas]: src/resources/readme/tile.aberlaas.png
[village]: src/resources/readme/tile.village.png
[portedhurle]: src/resources/readme/tile.portedhurle.png
[steppe]: src/resources/readme/tile.steppe.png
[mountain]: src/resources/readme/tile.mountain.png
[forest]: src/resources/readme/tile.forest.png
[windmill]: src/resources/readme/tile.windmill.png
[moral]: src/resources/readme/moral.png
[traceur]: src/resources/readme/004.Traceur.Ryage.png
[fer]: src/resources/readme/012.Fer.Blanchette.png
[pack]: src/resources/readme/022.Pack.Ashley.png
[croc]: src/resources/readme/050.Traine.Osuros.png
[plateau]: src/resources/readme/chapitre1.webp
[chapitre1]: src/resources/readme/chapitre1.png
[chapitre2]: src/resources/readme/chapitre2.png
[chapitre3]: src/resources/readme/chapitre3.png
[chapitre4]: src/resources/readme/chapitre4.png
[tourfontaine]: src/resources/readme/tile.tourfontaine.png
[d6-white-green]: src/resources/readme/d6-white-green.png
[d6-blue]: src/resources/readme/d6-blue.png
[d6-white]: src/resources/readme/d6-white.png
[d6-green]: src/resources/readme/d6-green.png
[d6-black]: src/resources/readme/d6-black.png
[d6-violet]: src/resources/readme/d6-violet.png
[wind-x]: src/resources/readme/wind-x.png
