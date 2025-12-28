# 🎮 Plan de Migration Windwalkers vers Board Game Arena

## 📋 Vue d'ensemble du projet

**Jeu:** Windwalkers - Un jeu de plateau stratégique inspiré de "La Horde du Contrevent" d'Alain Damasio  
**Joueurs:** 1-3 joueurs  
**Durée estimée:** ~20 min/joueur  
**Complexité:** Expert

---

## 🎯 Caractéristiques du jeu à implémenter

### Éléments de jeu principaux

- **Plateau hexagonal** avec tuiles (villes, villages, terrains)
- **Cartes personnages** (54 Hordiers avec pouvoirs uniques)
- **Système de dés** (bleus, blancs, verts, noirs, violets)
- **Jetons de vent** (F1-F6)
- **Moral de la horde** (0-9 points)
- **4 Chapitres** avec différents layouts

### Mécanique de jeu

1. Constitution de la Horde (8 personnages : 1 Traceur, 2 Fers, 3 Packs, 2 Traînes)
2. Exploration du plateau hexagonal
3. Affrontement des épreuves (dés)
4. Gestion du moral et des pouvoirs
5. Système de surpassement

---

## 📝 Todo List - Migration BGA

```markdown
- [x] **PHASE 0 : Préparation & Licence**

  - [x] Créer un compte développeur BGA Studio
  - [x] Vérifier le statut de licence (jeu original non publié = OK)
  - [ ] Compléter le tutoriel Reversi sur BGA Studio
  - [x] Configurer l'environnement de développement (VSCode + SFTP)
        → Fichier .vscode/sftp.json créé avec config SFTP

- [x] **PHASE 1 : Setup du Projet** ✅ COMPLÉTÉ

  - [x] Créer la structure du projet "windwalkers" (dossier bga-windwalkers/)
  - [ ] Configurer le contrôle de version (GitHub) - À faire après sync BGA
  - [ ] Préparer les assets graphiques (sprites, tuiles, cartes)
        → Voir bga-windwalkers/img/README.md pour la liste
  - [x] Remplir gameinfos.inc.php avec les métadonnées
  - [x] Créer gameoptions.json (options du jeu)
  - [x] Créer stats.json (statistiques)

- [x] **PHASE 2 : Base de Données** ✅ COMPLÉTÉ

  - [x] Définir le schéma DB (dbmodel.sql)
  - [x] Créer la table des cartes (Deck component)
  - [x] Créer la table des tuiles hexagonales
  - [x] Créer la table des jetons vent
  - [x] Créer la table état de jeu (moral, position, etc.)
  - [x] Créer la table des lancers de dés

- [x] **PHASE 3 : Logique Serveur (PHP)** ✅ STRUCTURE COMPLÈTE

  - [x] Implémenter setupNewGame()
  - [x] Définir la machine à états (states.inc.php) - 20 états
  - [x] Définir material.inc.php - 71 personnages, terrains, villes
  - [x] Implémenter la logique des épreuves de vent (base)
  - [x] Implémenter le système de dés (base)
  - [ ] Gérer les pouvoirs des personnages (avancé)
  - [x] Implémenter le calcul du score

- [x] **PHASE 4 : Interface Client (JS/CSS)** ✅ STRUCTURE COMPLÈTE

  - [x] Créer le layout du plateau hexagonal (Scrollmap)
  - [x] Créer windwalkers.js avec structure complète
  - [x] Créer windwalkers.css avec tous les styles
  - [x] Créer windwalkers.action.php (handlers d'action)
  - [x] Créer windwalkers.view.php et template
  - [ ] Afficher les cartes personnages (Stock/bga-cards)
  - [ ] Implémenter l'animation des dés (bga-dice)
  - [ ] Gérer les interactions utilisateur (à compléter)
  - [ ] Créer les notifications et animations (à compléter)

- [ ] **PHASE 5 : Tests & Polish**

  - [ ] Synchroniser avec BGA Studio via SFTP
  - [ ] Tests multi-joueurs
  - [ ] Implémenter le mode zombie (base faite)
  - [ ] Ajouter les traductions (FR/EN)
  - [ ] Optimiser pour mobile
  - [ ] Pre-release checklist

- [ ] **PHASE 6 : Publication**
  - [ ] Demander le statut Alpha
  - [ ] Corriger les bugs remontés
  - [ ] Passer en Beta puis production
```

---

## 🔧 PHASE 0 : Préparation & Licence

### 1. Créer un compte développeur BGA Studio

```
URL: https://studio.boardgamearena.com/
```

- Remplir le formulaire d'inscription
- Accepter les CGU développeurs
- Tu recevras par email :
  - Login/password SFTP
  - Credentials base de données
  - 10 comptes de test (username0 à username9)

### 2. Question de la licence

⚠️ **Point important** : Windwalkers est un jeu **original non publié**. Selon la documentation BGA :

- Tu peux développer ton prototype sur BGA Studio
- Le jeu ne pourra **pas être publié publiquement** tant qu'il n'est pas commercialisé
- Il restera en **alpha privée** (jouable uniquement avec tes amis)

**Options :**

1. Garder le jeu en alpha privée pour le playtesting
2. Le publier (auto-édition, crowdfunding, etc.) pour débloquer la publication BGA
3. Contacter un éditeur pour publication

### 3. Compléter le tutoriel

Obligatoire avant de commencer :

- [Tutorial Reversi](https://en.doc.boardgamearena.com/Tutorial_reversi) (recommandé)
- Ou [Tutorial Hearts](https://en.doc.boardgamearena.com/Tutorial_hearts) pour les jeux de cartes

### 4. Configurer l'environnement

```bash
# Installation recommandée
- VSCode avec extension SFTP
- PHP 8.4 (pour les tests locaux)
- Git pour le versioning
```

Voir : [Setting up BGA Development environment using VSCode](https://en.doc.boardgamearena.com/Setting_up_BGA_Development_environment_using_VSCode)

---

## 🏗️ PHASE 1 : Setup du Projet

### Structure des fichiers BGA

```
windwalkers/
├── dbmodel.sql              # Schéma base de données
├── gameinfos.inc.php        # Métadonnées du jeu
├── gameoptions.json         # Options et préférences
├── material.inc.php         # Données statiques (cartes, tuiles)
├── stats.json               # Statistiques du jeu
├── states.inc.php           # Machine à états
├── windwalkers.action.php   # Actions joueurs
├── windwalkers.css          # Styles
├── windwalkers.game.php     # Logique principale
├── windwalkers.js           # Interface client
├── windwalkers.view.php     # Layout dynamique
├── windwalkers_windwalkers.tpl  # Template HTML
├── img/                     # Assets graphiques
│   ├── board.jpg
│   ├── cards.png           # Sprite des cartes
│   ├── tiles.png           # Sprite des tuiles hex
│   ├── dice.png            # Sprite des dés
│   └── tokens.png          # Jetons vent
└── modules/                 # Code additionnel
```

### gameinfos.inc.php

```php
$gameinfos = [
    'game_name' => 'Windwalkers',
    'designer' => 'David Saban',
    'artist' => 'David Saban',
    'year' => 2025,
    'publisher' => 'Self-published',
    'publisher_website' => '',
    'publisher_bgg_id' => 0,
    'bgg_id' => 0,

    'players' => [1, 2, 3],
    'player_colors' => ['ff0000', '00ff00', '0000ff'],
    'favorite_colors_support' => true,

    'suggest_player_number' => 2,
    'not_recommend_player_number' => null,

    'estimated_duration' => 60,
    'fast_additional_time' => 30,
    'medium_additional_time' => 40,
    'slow_additional_time' => 50,

    'tie_breaker_description' => totranslate("Le joueur avec le plus de points de moral gagne"),

    'losers_not_ranked' => false,
    'solo_mode_ranked' => false,

    'is_coop' => 0,

    'language_dependency' => false,

    'complexity' => 3,  // 1-5 (Expert = 3-4)
    'luck' => 3,        // 1-5
    'strategy' => 4,    // 1-5
    'diplomacy' => 1,   // 1-5

    'tags' => [2, 11, 200], // Dice, Cards, Fantasy theme

    'presentation' => [
        totranslate("Guide votre Horde à travers un monde balayé par des vents mortels."),
        totranslate("Inspiré de La Horde du Contrevent d'Alain Damasio.")
    ]
];
```

---

## 💾 PHASE 2 : Base de Données

### dbmodel.sql

```sql
-- Table des joueurs (étendue)
ALTER TABLE `player` ADD `player_moral` INT NOT NULL DEFAULT '9';
ALTER TABLE `player` ADD `player_position_q` INT NOT NULL DEFAULT '3';
ALTER TABLE `player` ADD `player_position_r` INT NOT NULL DEFAULT '17';
ALTER TABLE `player` ADD `player_chapter` INT NOT NULL DEFAULT '1';
ALTER TABLE `player` ADD `player_day` INT NOT NULL DEFAULT '0';
ALTER TABLE `player` ADD `player_surpass_count` INT NOT NULL DEFAULT '0';

-- Table des cartes personnages (utilise Deck component)
CREATE TABLE IF NOT EXISTS `card` (
    `card_id` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
    `card_type` VARCHAR(32) NOT NULL,      -- 'traceur', 'fer', 'pack', 'traine'
    `card_type_arg` INT(11) NOT NULL,       -- ID unique du personnage
    `card_location` VARCHAR(32) NOT NULL,   -- 'deck', 'hand_PLAYER', 'horde_PLAYER', 'discard'
    `card_location_arg` INT(11) NOT NULL,
    `card_power_used` TINYINT(1) NOT NULL DEFAULT '0',
    PRIMARY KEY (`card_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 AUTO_INCREMENT=1;

-- Table des tuiles hexagonales
CREATE TABLE IF NOT EXISTS `tile` (
    `tile_id` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
    `tile_q` INT NOT NULL,                  -- Coordonnée q (hex)
    `tile_r` INT NOT NULL,                  -- Coordonnée r (hex)
    `tile_type` VARCHAR(32) NOT NULL,       -- 'city', 'village', 'terrain'
    `tile_name` VARCHAR(64) NOT NULL,       -- 'Aberlaas', 'mountain', etc.
    `tile_chapter` INT NOT NULL DEFAULT '1',
    `tile_wind_force` INT DEFAULT NULL,     -- Force du vent révélé (1-6)
    `tile_discovered` TINYINT(1) NOT NULL DEFAULT '0',
    PRIMARY KEY (`tile_id`),
    UNIQUE KEY `coords` (`tile_q`, `tile_r`, `tile_chapter`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 AUTO_INCREMENT=1;

-- Table des jetons vent disponibles
CREATE TABLE IF NOT EXISTS `wind_token` (
    `token_id` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
    `token_force` INT NOT NULL,             -- 1-6
    `token_used` TINYINT(1) NOT NULL DEFAULT '0',
    PRIMARY KEY (`token_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 AUTO_INCREMENT=1;

-- Table des dés en jeu (pour animation/résolution)
CREATE TABLE IF NOT EXISTS `dice` (
    `dice_id` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
    `dice_type` VARCHAR(16) NOT NULL,       -- 'blue', 'white', 'green', 'black', 'violet'
    `dice_value` INT DEFAULT NULL,
    `dice_context` VARCHAR(32) NOT NULL,    -- 'horde', 'wind', 'terrain', 'fate'
    PRIMARY KEY (`dice_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 AUTO_INCREMENT=1;
```

---

## ⚙️ PHASE 3 : Logique Serveur (PHP)

### Machine à états (states.inc.php)

```php
$machinestates = [
    // État initial
    1 => [
        "name" => "gameSetup",
        "description" => "",
        "type" => "manager",
        "action" => "stGameSetup",
        "transitions" => ["" => 2]
    ],

    // Draft de la Horde
    2 => [
        "name" => "draftHorde",
        "description" => clienttranslate('${actplayer} must choose their Horde'),
        "descriptionmyturn" => clienttranslate('${you} must select 8 characters for your Horde'),
        "type" => "activeplayer",
        "possibleactions" => ["selectCharacter", "confirmHorde"],
        "transitions" => ["hordeComplete" => 10, "selectMore" => 2]
    ],

    // Tour de jeu principal
    10 => [
        "name" => "playerTurn",
        "description" => clienttranslate('${actplayer} must choose: move or rest'),
        "descriptionmyturn" => clienttranslate('${you} must choose to move to an adjacent tile or rest'),
        "type" => "activeplayer",
        "possibleactions" => ["selectTile", "rest"],
        "transitions" => ["moveToTile" => 20, "rest" => 30, "endGame" => 99]
    ],

    // Révéler le vent
    20 => [
        "name" => "revealWind",
        "description" => clienttranslate('Revealing wind force...'),
        "type" => "game",
        "action" => "stRevealWind",
        "transitions" => ["windRevealed" => 25]
    ],

    // Confrontation
    25 => [
        "name" => "confrontation",
        "description" => clienttranslate('${actplayer} faces the wind challenge'),
        "descriptionmyturn" => clienttranslate('${you} must roll dice and defeat the wind'),
        "type" => "activeplayer",
        "possibleactions" => ["rollDice", "usePower", "useMoral", "rerollAll"],
        "transitions" => ["success" => 40, "failure" => 45, "rollAgain" => 25]
    ],

    // Repos
    30 => [
        "name" => "rest",
        "description" => clienttranslate('${actplayer} is resting'),
        "type" => "game",
        "action" => "stRest",
        "transitions" => ["restComplete" => 10]
    ],

    // Succès - Appliquer effets de tuile
    40 => [
        "name" => "applyTileEffect",
        "description" => clienttranslate('Applying tile effects...'),
        "type" => "game",
        "action" => "stApplyTileEffect",
        "transitions" => ["continue" => 50, "recruit" => 55, "endChapter" => 60]
    ],

    // Échec - Perdre un hordier
    45 => [
        "name" => "loseHordier",
        "description" => clienttranslate('${actplayer} must abandon a Hordier'),
        "descriptionmyturn" => clienttranslate('${you} must choose a Hordier to abandon'),
        "type" => "activeplayer",
        "possibleactions" => ["abandonHordier"],
        "transitions" => ["hordierLost" => 50, "gameOver" => 99]
    ],

    // Continuer ou se surpasser
    50 => [
        "name" => "continueOrSurpass",
        "description" => clienttranslate('${actplayer} may continue or end turn'),
        "descriptionmyturn" => clienttranslate('${you} may surpass (continue with -1 die) or end your turn'),
        "type" => "activeplayer",
        "possibleactions" => ["surpass", "endTurn"],
        "transitions" => ["surpass" => 10, "endTurn" => 70]
    ],

    // Recrutement (ville/village)
    55 => [
        "name" => "recruitment",
        "description" => clienttranslate('${actplayer} may recruit new Hordiers'),
        "descriptionmyturn" => clienttranslate('${you} may recruit new characters'),
        "type" => "activeplayer",
        "possibleactions" => ["recruit", "skipRecruitment"],
        "transitions" => ["recruited" => 50, "skip" => 50]
    ],

    // Fin de chapitre
    60 => [
        "name" => "endChapter",
        "description" => clienttranslate('Chapter complete!'),
        "type" => "game",
        "action" => "stEndChapter",
        "transitions" => ["nextChapter" => 2, "gameEnd" => 99]
    ],

    // Prochain joueur
    70 => [
        "name" => "nextPlayer",
        "description" => "",
        "type" => "game",
        "action" => "stNextPlayer",
        "transitions" => ["nextTurn" => 10, "endGame" => 99]
    ],

    // Fin de partie
    99 => [
        "name" => "gameEnd",
        "description" => clienttranslate("End of game"),
        "type" => "manager",
        "action" => "stGameEnd",
        "args" => "argGameEnd"
    ]
];
```

### material.inc.php - Exemple de données personnages

```php
$this->characters = [
    // TRACEURS (type = 'traceur')
    1 => [
        'name' => clienttranslate('Uther'),
        'type' => 'traceur',
        'tier' => 1,
        'power' => clienttranslate('Abandonnez un hordier. Avancez automatiquement sur la prochaine tuile.'),
        'power_type' => 'abandon_advance'
    ],
    2 => [
        'name' => clienttranslate('Rokka'),
        'type' => 'traceur',
        'tier' => 2,
        'power' => clienttranslate('Contrôlez la force du vent +/-1'),
        'power_type' => 'wind_control'
    ],
    // ... autres personnages

    // FERS (type = 'fer')
    10 => [
        'name' => clienttranslate('Blanchette de Gaude'),
        'type' => 'fer',
        'tier' => 3,
        'power' => clienttranslate('Faites ±1 sur vos dés bleus autant de fois que la force du vent.'),
        'power_type' => 'dice_modify_wind'
    ],
    // ... etc
];

$this->terrains = [
    'plain' => [
        'name' => clienttranslate('Plaine'),
        'white_dice' => 1,
        'green_dice' => 2,
        'black_dice' => 0,
        'moral_effect' => 0
    ],
    'mountain' => [
        'name' => clienttranslate('Montagne'),
        'white_dice' => 2,
        'green_dice' => 2,
        'black_dice' => 0,
        'moral_effect' => 0
    ],
    'forest' => [
        'name' => clienttranslate('Forêt'),
        'white_dice' => 1,
        'green_dice' => 3,
        'black_dice' => 0,
        'moral_effect' => 0
    ],
    // ... autres terrains
];
```

---

## 🎨 PHASE 4 : Interface Client (JS/CSS)

### Composants BGA à utiliser

| Composant          | Usage dans Windwalkers                |
| ------------------ | ------------------------------------- |
| **Scrollmap**      | Plateau hexagonal scrollable/zoomable |
| **Deck** (PHP)     | Gestion des cartes personnages        |
| **bga-cards** (JS) | Affichage/animation des cartes        |
| **bga-dice** (JS)  | Animation des lancers de dés          |
| **Counter** (JS)   | Affichage moral, score, dés restants  |
| **Stock** (JS)     | Main du joueur, recrutement           |
| **Zone** (JS)      | Zones du plateau (horde, tuiles)      |

### Template HTML de base

```html
<!-- windwalkers_windwalkers.tpl -->
<div id="windwalkers_wrap">
  <!-- Zone principale avec scrollmap pour le plateau hex -->
  <div id="map_container">
    <div id="map_scrollable"></div>
    <div id="map_surface"></div>
    <div id="map_scrollable_oversurface"></div>

    <div class="movetop"></div>
    <div class="movedown"></div>
    <div class="moveleft"></div>
    <div class="moveright"></div>
  </div>

  <!-- Zone de la Horde du joueur actif -->
  <div id="horde_zone" class="whiteblock">
    <h3>{MY_HORDE}</h3>
    <div id="horde_cards"></div>
  </div>

  <!-- Zone des dés -->
  <div id="dice_zone" class="whiteblock">
    <h3>{DICE_CHALLENGE}</h3>
    <div id="horde_dice"></div>
    <div id="wind_dice"></div>
  </div>

  <!-- Indicateurs -->
  <div id="indicators">
    <div id="moral_indicator">
      <span class="label">{MORAL}:</span>
      <span id="moral_value">9</span>/9
    </div>
    <div id="wind_indicator">
      <span class="label">{WIND_FORCE}:</span>
      <span id="wind_value">?</span>
    </div>
  </div>
</div>
```

### JavaScript - Structure de base

```javascript
// windwalkers.js
define([
  "dojo",
  "dojo/_base/declare",
  "ebg/core/gamegui",
  "ebg/counter",
  "ebg/scrollmap",
], function (dojo, declare) {
  return declare("bgagame.windwalkers", ebg.core.gamegui, {
    constructor: function () {
      this.scrollmap = null;
      this.moralCounter = new ebg.counter();
      this.windCounter = new ebg.counter();
    },

    setup: function (gamedatas) {
      console.log("Starting Windwalkers setup");

      // Setup scrollmap pour le plateau hex
      this.scrollmap = new ebg.scrollmap();
      this.scrollmap.create(
        $("map_container"),
        $("map_scrollable"),
        $("map_surface"),
        $("map_scrollable_oversurface")
      );
      this.scrollmap.setupOnScreenArrows(150);

      // Créer les tuiles hexagonales
      for (var tileId in gamedatas.tiles) {
        this.createHexTile(gamedatas.tiles[tileId]);
      }

      // Afficher la Horde du joueur
      this.displayHorde(gamedatas.myHorde);

      // Setup des compteurs
      this.moralCounter.create("moral_value");
      this.moralCounter.setValue(gamedatas.players[this.player_id].moral);

      // Setup des notifications
      this.setupNotifications();
    },

    createHexTile: function (tile) {
      var tileHtml = this.format_block("jstpl_hex_tile", {
        tile_id: tile.id,
        q: tile.q,
        r: tile.r,
        type: tile.type,
        name: tile.name,
        x: this.hexToPixelX(tile.q, tile.r),
        y: this.hexToPixelY(tile.q, tile.r),
      });
      dojo.place(tileHtml, "map_scrollable_oversurface");

      // Connect click handler
      this.connect($("tile_" + tile.id), "onclick", "onTileClick");
    },

    // Conversion coordonnées hex -> pixels (pointy-top)
    hexToPixelX: function (q, r) {
      var size = 50; // Taille de l'hexagone
      return size * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r);
    },

    hexToPixelY: function (q, r) {
      var size = 50;
      return size * ((3 / 2) * r);
    },

    // Actions
    onTileClick: function (evt) {
      dojo.stopEvent(evt);
      var tileId = evt.currentTarget.id.split("_")[1];

      if (this.checkAction("selectTile")) {
        this.bgaPerformAction("actSelectTile", { tile_id: tileId });
      }
    },

    onRollDice: function () {
      if (this.checkAction("rollDice")) {
        this.bgaPerformAction("actRollDice");
      }
    },

    // Notifications
    setupNotifications: function () {
      dojo.subscribe("windRevealed", this, "notif_windRevealed");
      dojo.subscribe("diceRolled", this, "notif_diceRolled");
      dojo.subscribe("playerMoved", this, "notif_playerMoved");
      dojo.subscribe("moralChanged", this, "notif_moralChanged");
      dojo.subscribe("hordierLost", this, "notif_hordierLost");
    },

    notif_windRevealed: function (notif) {
      this.windCounter.setValue(notif.args.wind_force);
      // Animation de révélation du vent
    },

    notif_diceRolled: function (notif) {
      // Animation des dés avec bga-dice
    },

    notif_moralChanged: function (notif) {
      this.moralCounter.toValue(notif.args.new_moral);
    },
  });
});
```

---

## 📊 Comparaison des assets existants vs requis

### Assets que tu as déjà

| Asset                 | Format actuel        | Adaptation BGA        |
| --------------------- | -------------------- | --------------------- |
| Cartes personnages    | Images individuelles | → Créer sprite unique |
| Tuiles terrain        | Images PNG           | → Créer sprite hex    |
| Données des chapitres | JSON                 | → Adapter en PHP      |
| Icônes (moral, vent)  | PNG                  | → Intégrer au sprite  |

### Assets à créer

| Asset              | Description                 |
| ------------------ | --------------------------- |
| game_box.png       | Image de boîte 3D (150x150) |
| game_banner.png    | Bannière (1920x1080)        |
| dice_sprites.png   | Sprite des 5 types de dés   |
| tokens_sprite.png  | Jetons vent F1-F6           |
| player_markers.png | Pions des joueurs           |

---

## 📅 Planning estimé

| Phase                 | Durée estimée | Difficulté |
| --------------------- | ------------- | ---------- |
| Phase 0 (Préparation) | 1-2 jours     | ⭐         |
| Phase 1 (Setup)       | 2-3 jours     | ⭐⭐       |
| Phase 2 (Database)    | 2-3 jours     | ⭐⭐       |
| Phase 3 (PHP Backend) | 2-3 semaines  | ⭐⭐⭐⭐   |
| Phase 4 (Frontend)    | 2-3 semaines  | ⭐⭐⭐⭐   |
| Phase 5 (Tests)       | 1-2 semaines  | ⭐⭐⭐     |
| Phase 6 (Publication) | Variable      | ⭐⭐       |

**Total estimé : 6-10 semaines** (à temps partiel)

---

## 🔗 Ressources utiles

### Documentation officielle

- [BGA Studio Documentation](https://en.doc.boardgamearena.com/Studio)
- [Tutorial Reversi](https://en.doc.boardgamearena.com/Tutorial_reversi)
- [Deck Component](https://en.doc.boardgamearena.com/Deck)
- [Scrollmap Component](https://en.doc.boardgamearena.com/Scrollmap)
- [bga-dice Component](https://en.doc.boardgamearena.com/BgaDice)
- [bga-cards Component](https://en.doc.boardgamearena.com/BgaCards)

### Communauté

- [Forum développeurs BGA](https://forum.boardgamearena.com/viewforum.php?f=12)
- [Discord BGA Developers](https://discord.gg/YxEUacY)

### Exemples de jeux similaires à étudier

- **Carcassonne** : Système de tuiles (scrollmap)
- **Taluva** : Tuiles hexagonales
- **Seasons** : Cartes avec pouvoirs + dés

---

## ⚠️ Points d'attention spécifiques à Windwalkers

### Complexité du système de dés

Le système d'épreuves est complexe :

- 3 contraintes simultanées (somme, vent, terrain)
- Dés noirs avec règles spéciales
- Pouvoirs qui modifient les dés

**Recommandation** : Commencer par une version simplifiée (Chapitre 1, sans dés noirs)

### Grille hexagonale

BGA n'a pas de composant hexagonal natif. Options :

1. Utiliser Scrollmap avec positionnement CSS custom
2. Adapter le code d'un jeu existant (Takenoko, Taluva)

### Mode solo

BGA supporte le solo mais avec des limitations. À implémenter après les modes multijoueurs.

---

## 🚀 Prochaines étapes immédiates

1. **Aujourd'hui** : Créer ton compte sur https://studio.boardgamearena.com
2. **Cette semaine** : Compléter le tutoriel Reversi
3. **Semaine prochaine** : Créer le projet Windwalkers et commencer les sprites

Bonne chance pour le portage ! 🎲🌪️
