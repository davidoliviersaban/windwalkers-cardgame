<?php
/**
 *------
 * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
 * Windwalkers implementation : © David Saban davidolivier.saban@gmail.com
 * -----
 * 
 * material.inc.php
 *
 * Windwalkers game material description
 * All static game data: characters, terrains, chapters
 */

if (!defined('CHAR_TRACEUR')) {
    define('CHAR_TRACEUR', 'traceur');
    define('CHAR_FER', 'fer');
    define('CHAR_PACK', 'pack');
    define('CHAR_TRAINE', 'traine');
}

$this->character_types = [
    CHAR_TRACEUR => [
        'name' => clienttranslate('Traceur'),
        'name_plural' => clienttranslate('Traceurs'),
        'color' => 'gold',
        'max_in_horde' => 1,
    ],
    CHAR_FER => [
        'name' => clienttranslate('Fer'),
        'name_plural' => clienttranslate('Fers'),
        'color' => 'red',
        'max_in_horde' => 2,
    ],
    CHAR_PACK => [
        'name' => clienttranslate('Pack'),
        'name_plural' => clienttranslate('Packs'),
        'color' => 'blue',
        'max_in_horde' => 3,
    ],
    CHAR_TRAINE => [
        'name' => clienttranslate('Traîne'),
        'name_plural' => clienttranslate('Traînes'),
        'color' => 'green',
        'max_in_horde' => 2,
    ],
];

/*
 * Characters / Hordiers
 * Each character has:
 * - id: unique identifier
 * - name: display name
 * - type: traceur, fer, pack, traine
 * - tier: power tier (1=best, 3=situational)
 * - power: description of the power
 * - power_code: internal code for power implementation
 */
$this->characters = [
    // ============ TRACEURS ============
    1 => [
        'name' => clienttranslate('Uther'),
        'type' => CHAR_TRACEUR,
        'is_leader' => true,
        'tier' => 1,
        'power' => clienttranslate('Abandonnez un hordier. Avancez automatiquement sur la prochaine tuile.'),
        'power_code' => 'abandon_advance',
    ],
    2 => [
        'name' => clienttranslate('Rokka'),
        'type' => CHAR_TRACEUR,
        'is_leader' => true,
        'tier' => 2,
        'power' => clienttranslate('Modifiez la force du vent de +1 ou -1.'),
        'power_code' => 'wind_control',
    ],
    3 => [
        'name' => clienttranslate('Ryage le Joueur'),
        'type' => CHAR_TRACEUR,
        'is_leader' => true,
        'tier' => 3,
        'power' => clienttranslate('Lancez 1 dé. Si sa valeur est >= à la force du vent, ignorez tous les dés du vent.'),
        'power_code' => 'gamble_wind',
    ],
    4 => [
        'name' => clienttranslate('Oranne'),
        'type' => CHAR_TRACEUR,
        'is_leader' => true,
        'tier' => 2,
        'power' => clienttranslate('Ignorez les dés verts de terrain.'),
        'power_code' => 'ignore_terrain',
    ],
    5 => [
        'name' => clienttranslate('Viciar'),
        'type' => CHAR_TRACEUR,
        'is_leader' => true,
        'tier' => 2,
        'power' => clienttranslate('Placez 2 de vos dés bleus sur la face de votre choix.'),
        'power_code' => 'set_two_dice',
    ],
    6 => [
        'name' => clienttranslate('Alpha'),
        'type' => CHAR_TRACEUR,
        'is_leader' => true,
        'tier' => 2,
        'power' => clienttranslate('Conservez un dé bleu pour le prochain lancer.'),
        'power_code' => 'save_die',
    ],
    7 => [
        'name' => clienttranslate('Usmos'),
        'type' => CHAR_TRACEUR,
        'is_leader' => true,
        'tier' => 2,
        'power' => clienttranslate('Les Traînes peuvent utiliser leur pouvoir sans être abandonnés.'),
        'power_code' => 'traine_safe',
    ],
    8 => [
        'name' => clienttranslate('Estrella'),
        'type' => CHAR_TRACEUR,
        'is_leader' => true,
        'tier' => 3,
        'power' => clienttranslate('Modifiez un dé noir de +1 ou -1.'),
        'power_code' => 'black_dice_control',
    ],
    9 => [
        'name' => clienttranslate('Lyara'),
        'type' => CHAR_TRACEUR,
        'is_leader' => true,
        'tier' => 2,
        'power' => clienttranslate('Posez un village sur une tuile adjacente vide.'),
        'power_code' => 'place_village',
    ],
    10 => [
        'name' => clienttranslate('I.E.L'),
        'type' => CHAR_TRACEUR,
        'is_leader' => true,
        'tier' => 2,
        'power' => clienttranslate('Déplacez-vous sur une tuile de bordure adjacente sans affronter le vent.'),
        'power_code' => 'border_move',
    ],
    11 => [
        'name' => clienttranslate('Giltarr'),
        'type' => CHAR_TRACEUR,
        'is_leader' => true,
        'tier' => 3,
        'power' => clienttranslate('Déplacez votre horde sur la tuile d\'un autre joueur.'),
        'power_code' => 'teleport_player',
    ],
    12 => [
        'name' => clienttranslate('Ambroise'),
        'type' => CHAR_TRACEUR,
        'is_leader' => true,
        'tier' => 2,
        'power' => clienttranslate('Restaurez le pouvoir d\'un hordier déjà utilisé.'),
        'power_code' => 'restore_power',
    ],

    // ============ FERS ============
    20 => [
        'name' => clienttranslate('Blanchette de Gaude'),
        'type' => CHAR_FER,
        'tier' => 3,
        'power' => clienttranslate('Faites ±1 sur vos dés bleus autant de fois que la force du vent.'),
        'power_code' => 'modify_by_wind',
    ],
    21 => [
        'name' => clienttranslate('Waldo'),
        'type' => CHAR_FER,
        'tier' => 2,
        'power' => clienttranslate('Si un hordier est abandonné ce tour, +2 à tous vos dés.'),
        'power_code' => 'abandon_bonus',
    ],
    22 => [
        'name' => clienttranslate('Thomassin'),
        'type' => CHAR_FER,
        'tier' => 2,
        'power' => clienttranslate('Faites ±1 sur chacun de vos dés bleus.'),
        'power_code' => 'modify_all_dice',
    ],
    23 => [
        'name' => clienttranslate('Anika'),
        'type' => CHAR_FER,
        'tier' => 2,
        'power' => clienttranslate('Ignorez 2 dés blancs du vent.'),
        'power_code' => 'ignore_two_wind',
    ],
    24 => [
        'name' => clienttranslate('Ukkiba'),
        'type' => CHAR_FER,
        'tier' => 2,
        'power' => clienttranslate('Échangez un dé bleu avec un dé blanc.'),
        'power_code' => 'swap_dice',
    ],
    25 => [
        'name' => clienttranslate('Kon'),
        'type' => CHAR_FER,
        'tier' => 2,
        'power' => clienttranslate('Relancez jusqu\'à 3 dés bleus.'),
        'power_code' => 'reroll_three',
    ],
    26 => [
        'name' => clienttranslate('Athonios'),
        'type' => CHAR_FER,
        'tier' => 3,
        'power' => clienttranslate('Relancez tous les dés (bleus et vent).'),
        'power_code' => 'reroll_all',
    ],
    27 => [
        'name' => clienttranslate('Filibert'),
        'type' => CHAR_FER,
        'tier' => 2,
        'power' => clienttranslate('Doublez l\'effet d\'un terrain (bonus ou malus).'),
        'power_code' => 'double_terrain',
    ],
    28 => [
        'name' => clienttranslate('Ragnard'),
        'type' => CHAR_FER,
        'tier' => 2,
        'power' => clienttranslate('Transformez un dé noir en dé vert.'),
        'power_code' => 'black_to_green',
    ],
    29 => [
        'name' => clienttranslate('Ed'),
        'type' => CHAR_FER,
        'tier' => 2,
        'power' => clienttranslate('Gagnez +1 dé bleu permanent pour ce chapitre.'),
        'power_code' => 'extra_die_permanent',
    ],
    30 => [
        'name' => clienttranslate('Justin'),
        'type' => CHAR_FER,
        'tier' => 3,
        'power' => clienttranslate('Accumulez 1 dé bleu supplémentaire (max 3 accumulés).'),
        'power_code' => 'accumulate_dice',
    ],

    // ============ PACKS ============
    40 => [
        'name' => clienttranslate('Oshora'),
        'type' => CHAR_PACK,
        'tier' => 2,
        'power' => clienttranslate('Si vous êtes seul sur la tuile, +1 à tous vos dés.'),
        'power_code' => 'solo_bonus',
    ],
    41 => [
        'name' => clienttranslate('Saphira'),
        'type' => CHAR_PACK,
        'tier' => 2,
        'power' => clienttranslate('Ignorez 1 dé blanc si vous avez abandonné un hordier ce chapitre.'),
        'power_code' => 'abandon_ignore',
    ],
    42 => [
        'name' => clienttranslate('Wanda'),
        'type' => CHAR_PACK,
        'tier' => 2,
        'power' => clienttranslate('Ignorez 1 dé blanc du vent.'),
        'power_code' => 'ignore_one_wind',
    ],
    43 => [
        'name' => clienttranslate('Baramas'),
        'type' => CHAR_PACK,
        'tier' => 2,
        'power' => clienttranslate('Réduisez la force du vent de 1 (min 1).'),
        'power_code' => 'reduce_wind',
    ],
    44 => [
        'name' => clienttranslate('Ernest'),
        'type' => CHAR_PACK,
        'tier' => 2,
        'power' => clienttranslate('Le vent ne peut pas dépasser force 4 pour cette épreuve.'),
        'power_code' => 'cap_wind',
    ],
    45 => [
        'name' => clienttranslate('Galas'),
        'type' => CHAR_PACK,
        'tier' => 3,
        'power' => clienttranslate('Augmentez la force du vent de 1. Gagnez 2 points de moral.'),
        'power_code' => 'increase_wind_moral',
    ],
    46 => [
        'name' => clienttranslate('Rochelle'),
        'type' => CHAR_PACK,
        'tier' => 2,
        'power' => clienttranslate('Relancez 1 dé blanc du vent.'),
        'power_code' => 'reroll_wind',
    ],
    47 => [
        'name' => clienttranslate('Le Daron'),
        'type' => CHAR_PACK,
        'tier' => 3,
        'power' => clienttranslate('Si vous échouez, ne perdez pas de hordier (une fois par chapitre).'),
        'power_code' => 'save_hordier',
    ],
    48 => [
        'name' => clienttranslate('Vera'),
        'type' => CHAR_PACK,
        'tier' => 2,
        'power' => clienttranslate('Soignez 1 point de moral.'),
        'power_code' => 'heal_moral',
    ],
    49 => [
        'name' => clienttranslate('Bert'),
        'type' => CHAR_PACK,
        'tier' => 2,
        'power' => clienttranslate('Les dés verts comptent comme des dés bleus.'),
        'power_code' => 'green_as_blue',
    ],
    50 => [
        'name' => clienttranslate('Lethune'),
        'type' => CHAR_PACK,
        'tier' => 3,
        'power' => clienttranslate('Échangez 2 tuiles adjacentes.'),
        'power_code' => 'swap_tiles',
    ],
    51 => [
        'name' => clienttranslate('Josmina'),
        'type' => CHAR_PACK,
        'tier' => 2,
        'power' => clienttranslate('Les tuiles avec des dés noirs donnent +1 moral au lieu de -1.'),
        'power_code' => 'black_moral_flip',
    ],
    52 => [
        'name' => clienttranslate('Ashley'),
        'type' => CHAR_PACK,
        'tier' => 2,
        'power' => clienttranslate('Reposez tous vos hordiers. Perdez 1 point de moral par hordier reposé.'),
        'power_code' => 'mass_rest',
    ],

    // ============ TRAÎNES ============
    60 => [
        'name' => clienttranslate('Topilzin'),
        'type' => CHAR_TRAINE,
        'tier' => 1,
        'power' => clienttranslate('Abandonnez-moi. Ignorez tous les dés du vent pour cette épreuve.'),
        'power_code' => 'sacrifice_ignore_wind',
    ],
    61 => [
        'name' => clienttranslate('Osuros'),
        'type' => CHAR_TRAINE,
        'tier' => 1,
        'power' => clienttranslate('Abandonnez-moi. Réussissez automatiquement l\'épreuve en cours.'),
        'power_code' => 'sacrifice_auto_win',
    ],
    62 => [
        'name' => clienttranslate('Mère'),
        'type' => CHAR_TRAINE,
        'tier' => 2,
        'power' => clienttranslate('Abandonnez-moi. Gagnez 3 points de moral.'),
        'power_code' => 'sacrifice_moral_3',
    ],
    63 => [
        'name' => clienttranslate('Père'),
        'type' => CHAR_TRAINE,
        'tier' => 2,
        'power' => clienttranslate('Abandonnez-moi. Gagnez 2 points de moral et reposez la horde.'),
        'power_code' => 'sacrifice_moral_rest',
    ],
    64 => [
        'name' => clienttranslate('Yeng'),
        'type' => CHAR_TRAINE,
        'tier' => 2,
        'power' => clienttranslate('Abandonnez-moi. Ignorez les dés verts de cette tuile et des 2 prochaines.'),
        'power_code' => 'sacrifice_ignore_terrain_3',
    ],
    65 => [
        'name' => clienttranslate('Tala'),
        'type' => CHAR_TRAINE,
        'tier' => 2,
        'power' => clienttranslate('Abandonnez-moi. Remplacez la tuile actuelle par une tuile plaine.'),
        'power_code' => 'sacrifice_change_tile',
    ],
    66 => [
        'name' => clienttranslate('Zhalinka'),
        'type' => CHAR_TRAINE,
        'tier' => 3,
        'power' => clienttranslate('Abandonnez-moi. +1 à tous les dés par hordier déjà abandonné ce chapitre.'),
        'power_code' => 'sacrifice_bonus_abandoned',
    ],
    67 => [
        'name' => clienttranslate('Bellune'),
        'type' => CHAR_TRAINE,
        'tier' => 3,
        'power' => clienttranslate('Abandonnez-moi. Récupérez un hordier abandonné ce chapitre.'),
        'power_code' => 'sacrifice_recover',
    ],
    68 => [
        'name' => clienttranslate('Barakiel'),
        'type' => CHAR_TRAINE,
        'tier' => 2,
        'power' => clienttranslate('Abandonnez-moi. Transformez tous les dés noirs en dés violets.'),
        'power_code' => 'sacrifice_black_to_violet',
    ],
    69 => [
        'name' => clienttranslate('Charlize'),
        'type' => CHAR_TRAINE,
        'tier' => 2,
        'power' => clienttranslate('Abandonnez-moi. Doublez votre moral actuel (max 9).'),
        'power_code' => 'sacrifice_double_moral',
    ],
    70 => [
        'name' => clienttranslate('Abriyen'),
        'type' => CHAR_TRAINE,
        'tier' => 3,
        'power' => clienttranslate('Abandonnez-moi. Le prochain joueur perd 2 points de moral.'),
        'power_code' => 'sacrifice_hurt_next',
    ],
    71 => [
        'name' => clienttranslate('Comtesse'),
        'type' => CHAR_TRAINE,
        'tier' => 2,
        'power' => clienttranslate('Abandonnez-moi. Recrutez immédiatement 1 hordier de votre choix.'),
        'power_code' => 'sacrifice_recruit',
    ],
];

/*
 * Terrain types
 */
$this->terrain_types = [
    'plain' => [
        'name' => clienttranslate('Plaine'),
        'white_dice' => 1,
        'green_dice' => 2,
        'black_dice' => 0,
        'moral_effect' => 0,
        'can_rest' => false,
        'can_recruit' => false,
    ],
    'mountain' => [
        'name' => clienttranslate('Montagne'),
        'white_dice' => 2,
        'green_dice' => 2,
        'black_dice' => 0,
        'moral_effect' => 0,
        'can_rest' => false,
        'can_recruit' => false,
    ],
    'forest' => [
        'name' => clienttranslate('Forêt'),
        'white_dice' => 1,
        'green_dice' => 3,
        'black_dice' => 0,
        'moral_effect' => 0,
        'can_rest' => false,
        'can_recruit' => false,
    ],
    'hut' => [
        'name' => clienttranslate('Hutte'),
        'white_dice' => 1,
        'green_dice' => 1,
        'black_dice' => 0,
        'moral_effect' => 0,
        'can_rest' => true,
        'can_recruit' => false,
    ],
    'water' => [
        'name' => clienttranslate('Eau'),
        'white_dice' => 2,
        'green_dice' => 3,
        'black_dice' => 0,
        'moral_effect' => -1,
        'can_rest' => false,
        'can_recruit' => false,
    ],
    'desert' => [
        'name' => clienttranslate('Désert'),
        'white_dice' => 3,
        'green_dice' => 1,
        'black_dice' => 0,
        'moral_effect' => -1,
        'can_rest' => false,
        'can_recruit' => false,
    ],
    'marsh' => [
        'name' => clienttranslate('Marais'),
        'white_dice' => 2,
        'green_dice' => 2,
        'black_dice' => 1,
        'moral_effect' => -1,
        'can_rest' => false,
        'can_recruit' => false,
    ],
    'tourfontaine' => [
        'name' => clienttranslate('Tour Fontaine'),
        'white_dice' => 0,
        'green_dice' => 0,
        'black_dice' => 1,
        'moral_effect' => 0,
        'can_rest' => true,
        'can_recruit' => false,
        'special' => 'tourfontaine',
    ],
    'portedhurle' => [
        'name' => clienttranslate('Porte d\'Hurle'),
        'white_dice' => 0,
        'green_dice' => 0,
        'black_dice' => 6,
        'moral_effect' => 0,
        'can_rest' => false,
        'can_recruit' => false,
        'special' => 'portedhurle',
        'no_wind' => true,
    ],
];

/*
 * Village types (can recruit specific character types)
 */
$this->village_types = [
    'village_green' => [
        'name' => clienttranslate('Village Vert'),
        'recruit_type' => CHAR_PACK,
        'recruit_count' => 2,
    ],
    'village_red' => [
        'name' => clienttranslate('Village Rouge'),
        'recruit_type' => CHAR_FER,
        'recruit_count' => 2,
    ],
    'village_blue' => [
        'name' => clienttranslate('Village Bleu'),
        'recruit_type' => CHAR_TRAINE,
        'recruit_count' => 2,
    ],
];

/*
 * City (chapter start/end)
 */
$this->cities = [
    'aberlaas' => [
        'name' => clienttranslate('Aberlaas'),
        'chapter' => 1,
        'is_start' => true,
    ],
    'portchoon' => [
        'name' => clienttranslate('Port-Choon'),
        'chapter' => 1,
        'is_start' => false,
    ],
    'chawondasee' => [
        'name' => clienttranslate('Chawondasee'),
        'chapter' => 2,
        'is_start' => false,
    ],
    'alticcio' => [
        'name' => clienttranslate('Alticcio'),
        'chapter' => 3,
        'is_start' => false,
    ],
    'campboban' => [
        'name' => clienttranslate('Camp Bòban'),
        'chapter' => 4,
        'is_start' => false,
    ],
];

/*
 * Wind token distribution (30 tokens total)
 */
$this->wind_distribution = [
    1 => 3,  // 10%
    2 => 4,  // 13%
    3 => 6,  // 20%
    4 => 7,  // 23%
    5 => 6,  // 20%
    6 => 4,  // 13% (Furevent!)
];

/*
 * Chapter definitions
 * Each chapter contains a list of tiles with their hex coordinates and terrain types
 */
$this->chapters = [
    1 => [
        'name' => clienttranslate('Chapter 1: The Journey Begins'),
        'tiles' => [
            ['q' => 3, 'r' => 17, 'subtype' => 'aberlaas'],
            ['q' => 3, 'r' => 16, 'subtype' => 'mountain'],
            ['q' => 3, 'r' => 15, 'subtype' => 'forest'],
            ['q' => 3, 'r' => 14, 'subtype' => 'village_green'],
            ['q' => 3, 'r' => 13, 'subtype' => 'plain'],
            ['q' => 3, 'r' => 12, 'subtype' => 'hut'],
            ['q' => 3, 'r' => 11, 'subtype' => 'portchoon'],
        ]
    ],
    2 => [
        'name' => clienttranslate('Chapter 2'),
        'tiles' => [
            // Chapter 2 tiles would be defined here
        ]
    ],
    3 => [
        'name' => clienttranslate('Chapter 3'),
        'tiles' => [
            // Chapter 3 tiles would be defined here
        ]
    ],
    4 => [
        'name' => clienttranslate('Chapter 4'),
        'tiles' => [
            // Chapter 4 tiles would be defined here
        ]
    ],
];
