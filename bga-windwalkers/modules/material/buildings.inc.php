<?php
/**
 * Windwalkers - Buildings (Villages & Cities)
 */

/*
 * Village types (can recruit specific character types)
 * All villages have: White=6, Green=0, Black=0, Moral=0
 * Colors match character types: Pack=blue, Fer=red, Traîne=green
 */
$this->village_types = [
    'village_green' => [
        'name' => clienttranslate('Village Vert'),
        'white_dice' => 6,
        'green_dice' => 0,
        'black_dice' => 0,
        'moral_effect' => 0,
        'recruit_type' => CHAR_TRAINE,
        'recruit_count' => 2,
    ],
    'village_red' => [
        'name' => clienttranslate('Village Rouge'),
        'white_dice' => 6,
        'green_dice' => 0,
        'black_dice' => 0,
        'moral_effect' => 0,
        'recruit_type' => CHAR_FER,
        'recruit_count' => 2,
    ],
    'village_blue' => [
        'name' => clienttranslate('Village Bleu'),
        'white_dice' => 6,
        'green_dice' => 0,
        'black_dice' => 0,
        'moral_effect' => 0,
        'recruit_type' => CHAR_PACK,
        'recruit_count' => 2,
    ],
];

/*
 * City (each city is the end of one chapter and start of the next)
 * All cities can recruit any type (RGB), no wind in cities
 */
$this->cities = [
    'aberlaas' => [
        'name' => clienttranslate('Aberlaas'),
        'start_chapter' => 1,
        'end_chapter' => null,
        'no_wind' => true,
    ],
    'portchoon' => [
        'name' => clienttranslate('Port-Choon'),
        'start_chapter' => 2,
        'end_chapter' => 1,
        'no_wind' => true,
    ],
    'chawondasee' => [
        'name' => clienttranslate('Chawondasee'),
        'start_chapter' => 3,
        'end_chapter' => 2,
        'no_wind' => true,
    ],
    'alticcio' => [
        'name' => clienttranslate('Alticcio'),
        'start_chapter' => 4,
        'end_chapter' => 3,
        'no_wind' => true,
    ],
    'campboban' => [
        'name' => clienttranslate('Camp Bòban'),
        'start_chapter' => null,
        'end_chapter' => 4,
        'no_wind' => true,
    ],
];
