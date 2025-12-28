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
    'publisher' => 'Self-published',
    'publisher_website' => '',
    // Temporary placeholder BGG id; replace with the real BoardGameGeek id when available.
    'publisher_bgg_id' => 999999, // NOI18N
    'bgg_id' => 999999, // NOI18N

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

    'language_dependency' => false,

    'db_undo_support' => true,
];
