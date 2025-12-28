<?php
/**
 *------
 * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
 * Windwalkers implementation : © David Saban davidolivier.saban@gmail.com
 *
 * This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
 * See http://en.boardgamearena.com/#!doc/Studio for more information.
 * -----
 */

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
    'player_colors' => ['ff0000', '008000', '0000ff'],
    'favorite_colors_support' => true,

    'suggest_player_number' => 2,
    'not_recommend_player_number' => null,
    'disable_player_order_swap_on_rematch' => false,

    'estimated_duration' => 60,
    'fast_additional_time' => 30,
    'medium_additional_time' => 40,
    'slow_additional_time' => 50,

    'tie_breaker_description' => totranslate("Le joueur avec le plus de points de moral gagne"),

    'losers_not_ranked' => false,
    'solo_mode_ranked' => false,

    'is_coop' => 0,
    'is_beta' => 1,

    'language_dependency' => false,

    'complexity' => 3,
    'luck' => 3,
    'strategy' => 4,
    'diplomacy' => 1,

    'tags' => [2, 11, 200],

    'presentation' => [
        totranslate("Guidez votre Horde à travers un monde balayé par des vents mortels."),
        totranslate("Inspiré de La Horde du Contrevent d'Alain Damasio."),
        totranslate("Affrontez les épreuves du vent avec vos dés et les pouvoirs uniques de vos Hordiers.")
    ],

    'custom_buy_button' => [
        'url' => '',
        'label' => ''
    ],

    'db_undo_support' => true,
];
