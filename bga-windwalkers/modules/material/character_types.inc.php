<?php
/**
 * Windwalkers - Character Types
 * Definition of the 4 character types: Traceur, Fer, Pack, Traîne
 */

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
