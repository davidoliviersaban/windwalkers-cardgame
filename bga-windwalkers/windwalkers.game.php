<?php
/**
 *------
 * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
 * Windwalkers implementation : © David Saban davidolivier.saban@gmail.com
 * -----
 *
 * windwalkers.game.php
 *
 * This is the main file for your game logic.
 */

require_once(APP_GAMEMODULE_PATH . 'module/table/table.game.php');

class Windwalkers extends Table
{
    function __construct()
    {
        parent::__construct();

        // Initialize Deck component for character cards
        $this->cards = $this->deckFactory->createDeck('card');
        $this->cards->init('card');
    }

    /*
     * setupNewGame:
     * Called once, when a new game is created.
     */
    protected function setupNewGame($players, $options = [])
    {
        // Set the colors of the players
        $gameinfos = $this->getGameinfos();
        $default_colors = $gameinfos['player_colors'];

        // Create players
        $sql = "INSERT INTO player (player_id, player_color, player_canal, player_name, player_avatar, player_moral) VALUES ";
        $values = [];
        foreach ($players as $player_id => $player) {
            $color = array_shift($default_colors);
            $values[] = "('" . $player_id . "','" . $color . "','" . $player['player_canal'] . "','" . addslashes($player['player_name']) . "','" . addslashes($player['player_avatar']) . "', 9)";
        }
        $sql .= implode(',', $values);
        $this->DbQuery($sql);

        $this->reloadPlayersBasicInfos();

        // Init global values
        $this->setGameStateInitialValue('current_chapter', $this->getGameStateValue('starting_chapter') ?? 1);
        $this->setGameStateInitialValue('current_round', 1);

        // Init game statistics
        $this->initStat('table', 'turns_number', 0);
        $this->initStat('table', 'chapters_completed', 0);
        $this->initStat('table', 'total_wind_faced', 0);
        $this->initStat('table', 'furevents_defeated', 0);

        foreach ($players as $player_id => $player) {
            $this->initStat('player', 'turns_number', 0, $player_id);
            $this->initStat('player', 'tiles_traversed', 0, $player_id);
            $this->initStat('player', 'hordiers_lost', 0, $player_id);
            $this->initStat('player', 'moral_spent', 0, $player_id);
            $this->initStat('player', 'powers_used', 0, $player_id);
            $this->initStat('player', 'surpass_count', 0, $player_id);
            $this->initStat('player', 'surpass_success', 0, $player_id);
            $this->initStat('player', 'rest_count', 0, $player_id);
            $this->initStat('player', 'furevents_defeated', 0, $player_id);
            $this->initStat('player', 'confrontations_won', 0, $player_id);
            $this->initStat('player', 'confrontations_lost', 0, $player_id);
            $this->initStat('player', 'total_score', 0, $player_id);
        }

        // Setup character cards
        $this->setupCharacterCards();

        // Setup wind tokens
        $this->setupWindTokens();

        // Setup chapter tiles
        $chapter = $this->getGameStateValue('current_chapter');
        $this->setupChapterTiles($chapter);

        // Init hordier selection statistics
        foreach ($this->characters as $char_id => $char) {
            $stat_name = 'hordier_' . $char_id . '_selected';
            $this->initStat('table', $stat_name, 0);
        }

        // Activate first player
        $this->activeNextPlayer();

        // Return first state id for the game flow (playerTurn)
        return 10;
    }

    /**
     * Create all character cards
     */
    function setupCharacterCards()
    {
        $cards = [];
        foreach ($this->characters as $char_id => $char) {
            $cards[] = [
                'type' => $char['type'],  // 'fer', 'pack', 'traine'
                'type_arg' => $char_id,
                'nbr' => 1
            ];
        }
        $this->cards->createCards($cards, 'deck');
        $this->cards->shuffle('deck');
        
        // Set is_leader flag for traceurs
        foreach ($this->characters as $char_id => $char) {
            if (isset($char['is_leader']) && $char['is_leader']) {
                $this->DbQuery("UPDATE card SET card_is_leader = 1 WHERE card_type_arg = $char_id");
            }
        }
    }

    /**
     * Create wind tokens according to distribution
     */
    function setupWindTokens()
    {
        $values = [];
        foreach ($this->wind_distribution as $force => $count) {
            for ($i = 0; $i < $count; $i++) {
                $values[] = "($force, 'bag', NULL)";
            }
        }
        $sql = "INSERT INTO wind_token (token_force, token_location, token_tile_id) VALUES " . implode(',', $values);
        $this->DbQuery($sql);
    }

    /**
     * Setup tiles for a specific chapter
     */
    function setupChapterTiles($chapter)
    {
        // Load chapter data from material.inc.php
        if (isset($this->chapters[$chapter]) && !empty($this->chapters[$chapter]['tiles'])) {
            $this->createTilesFromData($this->chapters[$chapter]['tiles'], $chapter);
        } else {
            // Fallback: create basic chapter 1 layout
            $this->createDefaultChapter1();
        }
    }

    /**
     * Create tiles from chapter data array
     */
    function createTilesFromData($tiles, $chapter)
    {
        $values = [];
        foreach ($tiles as $tile) {
            $subtype = $tile['subtype'];
            
            // Determine tile type from subtype
            if (isset($this->cities[$subtype])) {
                $type = 'city';
            } elseif (isset($this->village_types[$subtype])) {
                $type = 'village';
            } elseif (in_array($subtype, ['tourfontaine', 'portedhurle'])) {
                $type = 'special';
            } else {
                $type = 'terrain';
            }
            
            $terrain = $this->terrain_types[$subtype] ?? $this->terrain_types['plain'];
            
            $values[] = sprintf(
                "(%d, %d, '%s', '%s', %d, %d, %d, %d, %d)",
                $tile['q'],
                $tile['r'],
                $type,
                $subtype,
                $chapter,
                $terrain['white_dice'] ?? 0,
                $terrain['green_dice'] ?? 0,
                $terrain['black_dice'] ?? 0,
                $terrain['moral_effect'] ?? 0
            );
        }
        
        if (!empty($values)) {
            $sql = "INSERT INTO tile (tile_q, tile_r, tile_type, tile_subtype, tile_chapter, 
                    tile_white_dice, tile_green_dice, tile_black_dice, tile_moral_effect) 
                    VALUES " . implode(',', $values);
            $this->DbQuery($sql);
        }
    }

    /**
     * Fallback: create default chapter 1 layout
     */
    function createDefaultChapter1()
    {
        // Basic linear layout for testing
        $tiles = [
            ['q' => 3, 'r' => 17, 'type' => 'city', 'subtype' => 'aberlaas'],
            ['q' => 3, 'r' => 16, 'type' => 'terrain', 'subtype' => 'mountain'],
            ['q' => 3, 'r' => 15, 'type' => 'terrain', 'subtype' => 'forest'],
            ['q' => 3, 'r' => 14, 'type' => 'village', 'subtype' => 'village_green'],
            ['q' => 3, 'r' => 13, 'type' => 'terrain', 'subtype' => 'plain'],
            ['q' => 3, 'r' => 12, 'type' => 'terrain', 'subtype' => 'hut'],
            ['q' => 3, 'r' => 11, 'type' => 'city', 'subtype' => 'portchoon'],
        ];
        
        $values = [];
        foreach ($tiles as $tile) {
            $terrain = $this->terrain_types[$tile['subtype']] ?? $this->terrain_types['plain'];
            $values[] = sprintf(
                "(%d, %d, '%s', '%s', 1, %d, %d, %d, %d)",
                $tile['q'],
                $tile['r'],
                $tile['type'],
                $tile['subtype'],
                $terrain['white_dice'] ?? 0,
                $terrain['green_dice'] ?? 0,
                $terrain['black_dice'] ?? 0,
                $terrain['moral_effect'] ?? 0
            );
        }
        
        $sql = "INSERT INTO tile (tile_q, tile_r, tile_type, tile_subtype, tile_chapter,
                tile_white_dice, tile_green_dice, tile_black_dice, tile_moral_effect) 
                VALUES " . implode(',', $values);
        $this->DbQuery($sql);
    }

    /*
     * getAllDatas: Gather all informations about current game situation
     */
    protected function getAllDatas()
    {
        $result = [];
        $current_player_id = $this->getCurrentPlayerId();

        // Get players info
        $sql = "SELECT player_id id, player_score score, player_color color, player_moral moral, 
                player_position_q pos_q, player_position_r pos_r, player_chapter chapter,
                player_day day, player_has_moved has_moved, player_surpass_count surpass_count, player_dice_count dice_count
                FROM player";
        $result['players'] = $this->getCollectionFromDb($sql);

        // Get current chapter
        $result['current_chapter'] = $this->getGameStateValue('current_chapter');

        // Get all tiles for current chapter
        $chapter = $result['current_chapter'];
        $result['tiles'] = $this->getCollectionFromDb(
            "SELECT tile_id id, tile_q q, tile_r r, tile_type type, tile_subtype subtype,
             tile_wind_force wind_force, tile_discovered discovered,
             tile_white_dice white_dice, tile_green_dice green_dice, 
             tile_black_dice black_dice, tile_moral_effect moral_effect
             FROM tile WHERE tile_chapter = $chapter"
        );

        // Get player's horde (cards in hand)
        $result['myHorde'] = $this->cards->getCardsInLocation('horde_' . $current_player_id);

        // Get available characters for recruitment (if in city/village)
        $result['recruitPool'] = $this->getRecruitPool($current_player_id);

        // Material data
        $result['characters'] = $this->characters;
        $result['character_types'] = $this->character_types;
        $result['terrain_types'] = $this->terrain_types;

        return $result;
    }

    /**
     * Get characters available for recruitment at current location
     * - Villages recruit only one type (green=pack, red=fer, blue=traine)
     * - Cities recruit all types
     * - Other terrains allow no recruitment
     */
    function getRecruitPool($player_id)
    {
        $player = $this->getObjectFromDB("SELECT * FROM player WHERE player_id = $player_id");
        $chapter = $this->getGameStateValue('current_chapter');
        
        // Get current tile
        $tile = $this->getObjectFromDB(
            "SELECT * FROM tile WHERE tile_q = {$player['player_position_q']} AND tile_r = {$player['player_position_r']} AND tile_chapter = $chapter"
        );
        
        if (!$tile) {
            return [];
        }
        
        $available = [];
        
        // Cities recruit all hordier types
        if ($tile['tile_type'] == 'city') {
            $available = $this->getCollectionFromDb(
                "SELECT * FROM card WHERE card_type IN ('fer', 'pack', 'traine') AND card_location = 'deck' ORDER BY card_type_arg"
            );
        } 
        // Villages recruit based on their subtype
        else if ($tile['tile_type'] == 'village') {
            $subtype = $tile['tile_subtype'];
            
            if ($subtype == 'village_green') {
                // Recruit pack
                $available = $this->getCollectionFromDb(
                    "SELECT * FROM card WHERE card_type = 'pack' AND card_location = 'deck' ORDER BY card_type_arg"
                );
            } else if ($subtype == 'village_red') {
                // Recruit fer (non-traceurs)
                $available = $this->getCollectionFromDb(
                    "SELECT * FROM card WHERE card_type = 'fer' AND card_is_leader = 0 AND card_location = 'deck' ORDER BY card_type_arg"
                );
            } else if ($subtype == 'village_blue') {
                // Recruit traine
                $available = $this->getCollectionFromDb(
                    "SELECT * FROM card WHERE card_type = 'traine' AND card_location = 'deck' ORDER BY card_type_arg"
                );
            }
        }
        
        return $available;
    }

    /*
     * getGameProgression: Compute and return the current game progression.
     */
    function getGameProgression()
    {
        // Progression based on chapters completed and tiles traversed
        $chapter = $this->getGameStateValue('current_chapter');
        $base_progress = ($chapter - 1) * 25; // 25% per chapter
        
        // Add progress within chapter based on player positions
        // Simplified: just return chapter-based progress for now
        return min(100, $base_progress);
    }

    //////////////////////////////////////////////////////////////////////////////
    //////////// Utility functions
    ////////////

    /**
     * Get adjacent tiles for a hex position
     */
    function getAdjacentTiles($q, $r, $chapter)
    {
        // Hex directions (pointy-top)
        $directions = [
            [+1, 0], [+1, -1], [0, -1],
            [-1, 0], [-1, +1], [0, +1]
        ];
        
        $adjacent = [];
        foreach ($directions as $dir) {
            $nq = $q + $dir[0];
            $nr = $r + $dir[1];
            
            $tile = $this->getObjectFromDB(
                "SELECT * FROM tile WHERE tile_q = $nq AND tile_r = $nr AND tile_chapter = $chapter"
            );
            if ($tile) {
                $adjacent[] = $tile;
            }
        }
        return $adjacent;
    }

    /**
     * Draw a wind token from the bag
     */
    function drawWindToken()
    {
        $token = $this->getObjectFromDB(
            "SELECT * FROM wind_token WHERE token_location = 'bag' ORDER BY RAND() LIMIT 1"
        );
        return $token;
    }

    /**
     * Roll dice for confrontation
     */
    function rollDice($count, $type, $owner)
    {
        $results = [];
        for ($i = 0; $i < $count; $i++) {
            $value = bga_rand(1, 6);
            $results[] = [
                'type' => $type,
                'value' => $value,
                'owner' => $owner
            ];
        }
        return $results;
    }

    /**
     * Count occurrences of each face (1-6) in a dice array, with optional filters.
     */
    function countFaceOccurrences($dice_list, $filter_type = null, $filter_owner = null)
    {
        $counts = array_fill(1, 6, 0);
        foreach ($dice_list as $d) {
            if (($filter_type === null || $d['dice_type'] == $filter_type) &&
                ($filter_owner === null || $d['dice_owner'] == $filter_owner)) {
                $v = (int) $d['dice_value'];
                if ($v >= 1 && $v <= 6) {
                    $counts[$v]++;
                }
            }
        }
        return $counts;
    }

    /**
     * Match challenge dice against an available pool of player dice counts, consuming used dice.
     * The $available_counts array (face => count) is mutated to reflect dice spent on this dimension.
     */
    function matchAndConsumeDice($challenge_dice, &$available_counts, $dimension)
    {
        $challenge_counts = $this->countFaceOccurrences($challenge_dice, $dimension, 'challenge');
        $player_before = $available_counts; // snapshot before consumption

        $required = array_sum($challenge_counts);
        $matched = 0;
        $consumed = array_fill(1, 6, 0);

        for ($v = 1; $v <= 6; $v++) {
            $consumed[$v] = min($available_counts[$v], $challenge_counts[$v]);
            $matched += $consumed[$v];
            $available_counts[$v] -= $consumed[$v];
        }

        return [
            'required' => $required,
            'available_before' => array_sum($player_before),
            'available_after' => array_sum($available_counts),
            'matched' => $matched,
            'ok' => ($matched >= $required),
            'remainingPerFaceChallenge' => $challenge_counts,
            'remainingPerFacePlayerBefore' => $player_before,
            'remainingPerFacePlayerAfter' => $available_counts,
            'consumed' => $consumed
        ];
    }

    /**
     * Track hordier selection statistics
     */
    function trackHordierSelection($card_id)
    {
        $card = $this->getObjectFromDB("SELECT * FROM card WHERE card_id = $card_id");
        if (!$card) {
            return;
        }
        
        $char_id = $card['card_type_arg'];
        $char = $this->characters[$char_id] ?? null;
        
        if ($char) {
            $stat_name = 'hordier_' . $char_id . '_selected';
            
            // Initialize stat if it doesn't exist (table stat to track across all games)
            try {
                $this->incStat(1, $stat_name);
            } catch (Exception $e) {
                // Stat might not be initialized, try to init it first
                $this->initStat('table', $stat_name, 0);
                $this->incStat(1, $stat_name);
            }
        }
    }

    //////////////////////////////////////////////////////////////////////////////
    //////////// Player actions
    ////////////

    function actSelectTile($tile_id)
    {
        $this->checkAction('actSelectTile');
        $player_id = $this->getActivePlayerId();
        
        // Validate tile is adjacent
        $player = $this->getObjectFromDB("SELECT * FROM player WHERE player_id = $player_id");
        $chapter = $this->getGameStateValue('current_chapter');
        $adjacent = $this->getAdjacentTiles($player['player_position_q'], $player['player_position_r'], $chapter);
        
        $valid = false;
        foreach ($adjacent as $tile) {
            if ($tile['tile_id'] == $tile_id) {
                $valid = true;
                break;
            }
        }
        
        if (!$valid) {
            throw new BgaUserException($this->_("This tile is not adjacent to your position"));
        }
        
        // Store selected tile
        $this->setGameStateValue('selected_tile', $tile_id);
        
        // Increment movement counter
        $this->DbQuery("UPDATE player SET player_has_moved = player_has_moved + 1 WHERE player_id = $player_id");
        
        $this->gamestate->nextState('moveToTile');
    }

    function actSurpassAndSelectTile($tile_id)
    {
        $this->checkAction('actSurpassAndSelectTile');
        $player_id = $this->getActivePlayerId();
        
        // Check if player has already moved
        $has_moved = $this->getUniqueValueFromDB("SELECT player_has_moved FROM player WHERE player_id = $player_id");
        if ($has_moved == 0) {
            throw new BgaUserException($this->_("You must move first before surpassing"));
        }
        
        // Validate tile is adjacent
        $player = $this->getObjectFromDB("SELECT * FROM player WHERE player_id = $player_id");
        $chapter = $this->getGameStateValue('current_chapter');
        $adjacent = $this->getAdjacentTiles($player['player_position_q'], $player['player_position_r'], $chapter);
        
        $valid = false;
        foreach ($adjacent as $tile) {
            if ($tile['tile_id'] == $tile_id) {
                $valid = true;
                break;
            }
        }
        
        if (!$valid) {
            throw new BgaUserException($this->_("This tile is not adjacent to your position"));
        }
        
        // Store selected tile
        $this->setGameStateValue('selected_tile', $tile_id);
        
        // Increment both: movement counter (for turn state) and surpass counter (for scoring)
        $this->DbQuery("UPDATE player SET player_has_moved = player_has_moved + 1, player_surpass_count = player_surpass_count + 1 WHERE player_id = $player_id");
        $this->incStat(1, 'surpass_count', $player_id);
        
        $this->notify->all('playerSurpasses', clienttranslate('${player_name} surpasses! (-1 die)'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName()
        ]);
        
        $this->gamestate->nextState('moveToTile');
    }

    function actRollDice()
    {
        $this->checkAction('actRollDice');
        $player_id = $this->getActivePlayerId();
        
        // Get player's dice count (base 6, minus any surpass dice)
        $player = $this->getObjectFromDB("SELECT * FROM player WHERE player_id = $player_id");
        $surpass_count = $player['player_surpass_count'];

        $dice_count = $player['player_dice_count'] - $surpass_count;
        
        // Roll horde dice
        $horde_dice = $this->rollDice($dice_count, 'blue', 'player');
        
        // Store in database
        $this->DbQuery("DELETE FROM dice_roll");
        foreach ($horde_dice as $dice) {
            $this->DbQuery("INSERT INTO dice_roll (dice_type, dice_value, dice_owner) 
                           VALUES ('{$dice['type']}', {$dice['value']}, '{$dice['owner']}')");
        }
        
        // Notify players
        $this->notify->all('diceRolled', clienttranslate('${player_name} rolls ${dice_count} dice'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'dice_count' => $dice_count,
            'dice' => $horde_dice
        ]);
        
        $this->gamestate->nextState('rollAgain');
    }

    function actUseMoral($dice_id, $modifier)
    {
        $this->checkAction('actUseMoral');
        $player_id = $this->getActivePlayerId();
        
        // Check player has moral
        $moral = $this->getUniqueValueFromDB("SELECT player_moral FROM player WHERE player_id = $player_id");
        if ($moral <= 1) {
            throw new BgaUserException($this->_("You don't have enough moral"));
        }
        
        // Validate modifier (-1 or +1)
        // TODO: Not necessarily, if we do -2 then moral cost is 2, but for now keep it simple
        if ($modifier != -1 && $modifier != 1) {
            throw new BgaUserException($this->_("Invalid modifier"));
        }
        
        // Update dice value
        $dice = $this->getObjectFromDB("SELECT * FROM dice_roll WHERE dice_id = $dice_id");
        if (!$dice || $dice['dice_owner'] != 'player') {
            throw new BgaUserException($this->_("Invalid dice"));
        }
        
        $new_value = max(1, min(6, $dice['dice_value'] + $modifier));
        $this->DbQuery("UPDATE dice_roll SET dice_value = $new_value WHERE dice_id = $dice_id");
        
        // Reduce moral
        $this->DbQuery("UPDATE player SET player_moral = player_moral - 1 WHERE player_id = $player_id");
        $this->incStat(1, 'moral_spent', $player_id);
        
        // Notify
        $this->notify->all('moralUsed', clienttranslate('${player_name} spends 1 moral to modify a die'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'dice_id' => $dice_id,
            'new_value' => $new_value,
            'new_moral' => $moral - 1
        ]);
    }

    function actConfirmRoll()
    {
        $this->checkAction('actConfirmRoll');
        $this->gamestate->nextState('checkResult');
    }

    function actRest()
    {
        $this->checkAction('actRest');
        $player_id = $this->getActivePlayerId();
        
        // Reset movement counter for next day and reset surpass counter
        $this->DbQuery("UPDATE player SET player_has_moved = 0, player_surpass_count = 0 WHERE player_id = $player_id");
        
        $this->notify->all('playerRests', clienttranslate('${player_name} rests and resets surpass counter'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName()
        ]);
        
        $this->incStat(1, 'rest_count', $player_id);
        $this->gamestate->nextState('rest');
    }

    //////////////////////////////////////////////////////////////////////////////
    //////////// Game state arguments
    ////////////

    function argDraftHorde()
    {
        $player_id = $this->getActivePlayerId();
        
        // Get available characters from deck
        $available = $this->cards->getCardsInLocation('deck');
        
        // Get already selected characters for this horde
        $selected = $this->cards->getCardsInLocation('horde_' . $player_id);
        
        // Count by type
        $counts = [
            'traceur' => 0,  // Fers with is_leader=1
            'fer' => 0,      // Fers without is_leader
            'pack' => 0,
            'traine' => 0
        ];
        foreach ($selected as $card) {
            if ($card['card_is_leader']) {
                $counts['traceur']++;
            } else {
                $counts[$card['card_type']]++;
            }
        }
        
        return [
            'available' => $available,
            'selected' => $selected,
            'counts' => $counts,
            'requirements' => [
                'traceur' => 1,    // 1 fer with is_leader=1
                'fer' => 2,        // 2 fers without is_leader
                'pack' => 3,
                'traine' => 2
            ]
        ];
    }

    function argPlayerTurn()
    {
        $player_id = $this->getActivePlayerId();
        $player = $this->getObjectFromDB("SELECT * FROM player WHERE player_id = $player_id");
        $chapter = $this->getGameStateValue('current_chapter');
        
        return [
            'position' => ['q' => $player['player_position_q'], 'r' => $player['player_position_r']],
            'adjacent' => $this->getAdjacentTiles($player['player_position_q'], $player['player_position_r'], $chapter),
            'moral' => $player['player_moral'],
            'has_moved' => $player['player_has_moved'],
            'can_surpass' => $player['player_has_moved'] > 0
        ];
    }

    function argConfrontation()
    {
        $tile_id = $this->getGameStateValue('selected_tile');
        $tile = $this->getObjectFromDB("SELECT * FROM tile WHERE tile_id = $tile_id");
        
        $horde_dice = $this->getCollectionFromDb("SELECT * FROM dice_roll WHERE dice_owner = 'player'");
        $challenge_dice = $this->getCollectionFromDb("SELECT * FROM dice_roll WHERE dice_owner = 'challenge'");
        
        return [
            'tile' => $tile,
            'wind_force' => $tile['tile_wind_force'],
            'horde_dice' => $horde_dice,
            'challenge_dice' => $challenge_dice
        ];
    }

    //////////////////////////////////////////////////////////////////////////////
    //////////// Game state actions
    ////////////

    function stGameSetup()
    {
        // Game setup is done in setupNewGame
    }

    function stNextDraft()
    {
        $player_id = $this->getActivePlayerId();
        
        // Check if current player has completed their horde
        $horde = $this->cards->getCardsInLocation('horde_' . $player_id);
        if (count($horde) < 8) {
            $this->gamestate->nextState('nextPlayer');
            return;
        }
        
        // Move to next player or start game
        $this->activeNextPlayer();
        $next_player = $this->getActivePlayerId();
        
        // Check if back to first player (all drafted)
        if ($next_player == $this->getPlayerAfter($this->getPlayerBefore($player_id))) {
            $this->gamestate->nextState('allDrafted');
        } else {
            $this->gamestate->nextState('nextPlayer');
        }
    }

    function stRevealWind()
    {
        $tile_id = $this->getGameStateValue('selected_tile');
        $tile = $this->getObjectFromDB("SELECT * FROM tile WHERE tile_id = $tile_id");
        
        // Cities have no wind
        if ($tile['tile_type'] == 'city' || isset($this->terrain_types[$tile['tile_subtype']]['no_wind'])) {
            $this->gamestate->nextState('noWind');
            return;
        }
        
        // Draw wind token if not already revealed
        if ($tile['tile_wind_force'] === null) {
            $token = $this->drawWindToken();
            $force = $token['token_force'];
            
            $this->DbQuery("UPDATE tile SET tile_wind_force = $force, tile_discovered = 1 WHERE tile_id = $tile_id");
            $this->DbQuery("UPDATE wind_token SET token_location = 'tile', token_tile_id = $tile_id WHERE token_id = {$token['token_id']}");
            
            // Roll wind dice (rolled ones)
            $green_dice = $this->rollDice($tile['tile_green_dice'], 'green', 'challenge');
            $white_dice = $this->rollDice($tile['tile_white_dice'], 'white', 'challenge');
            $black_dice = $this->rollDice($tile['tile_black_dice'], 'black', 'challenge');

            // Add missing white dice as fixed 6 (not rolled) to reach wind force
            $missing_white = max(0, $force - (count($white_dice) + count($green_dice)));
            $added_white_dice = [];
            for ($i = 0; $i < $missing_white; $i++) {
                $added_white_dice[] = [
                    'type' => 'white',
                    'value' => 6,
                    'owner' => 'challenge'
                ];
            }

            $white_dice_final = array_merge($white_dice, $added_white_dice);
            $all_challenge_dice = array_merge($white_dice_final, $green_dice, $black_dice);
            
            // Store wind dice
            foreach ($all_challenge_dice as $dice) {
                $this->DbQuery("INSERT INTO dice_roll (dice_type, dice_value, dice_owner) 
                               VALUES ('{$dice['type']}', {$dice['value']}, '{$dice['owner']}')");
            }
            
            $this->notify->all('windRevealed', clienttranslate('Wind force ${force} revealed!'), [
                'tile_id' => $tile_id,
                'force' => $force,
                'white_dice' => $white_dice_final,
                'green_dice' => $green_dice,
                'black_dice' => $black_dice,
                'added_white_dice' => $added_white_dice
            ]);
        }
        
        $this->gamestate->nextState('windRevealed');
    }

    function stResolveConfrontation()
    {
        $player_id = $this->getActivePlayerId();
        
        // Get all dice (player vs challenge)
        $horde_dice = $this->getCollectionFromDb("SELECT * FROM dice_roll WHERE dice_owner = 'player'");
        $wind_dice = $this->getCollectionFromDb("SELECT * FROM dice_roll WHERE dice_owner = 'challenge'");
        
        // Calculate sums
        $horde_sum = array_sum(array_column($horde_dice, 'dice_value'));
        $wind_sum = array_sum(array_column($wind_dice, 'dice_value'));
        
        // Check wind force constraint (matching dice)
        $tile_id = $this->getGameStateValue('selected_tile');
        $tile = $this->getObjectFromDB("SELECT * FROM tile WHERE tile_id = $tile_id");
        $wind_force = $tile['tile_wind_force'] ?? 0;

        // Pre-compute value counts for notifications/debug
        $wind_value_counts = $this->countFaceOccurrences($wind_dice, null, 'challenge');
        $player_value_counts = $this->countFaceOccurrences($horde_dice, null, 'player');

        // Available player dice counts (will be consumed dimension by dimension)
        $available_counts = $player_value_counts;
        
        // Check matching by dimension (terrain first, then wind, then fate)
        // Greens: must ALL be matched, each match reduces wind force requirement for whites
        $green_match = $this->matchAndConsumeDice($wind_dice, $available_counts, 'green');
        $greens_ok = ($green_match['matched'] >= $green_match['required'] || $green_match['matched'] >= $wind_force); // all greens must match
        $wind_force = max(0, $wind_force - $green_match['matched']); // reduce wind force by matched greens

        // Whites: must meet reduced wind force after greens are consumed
        $white_match = $this->matchAndConsumeDice($wind_dice, $available_counts, 'white');
        $whites_ok = ($white_match['matched'] >= $wind_force); // wind force defines the required white pressure

        // Blacks: all black dice must be matched
        $black_match = $this->matchAndConsumeDice($wind_dice, $available_counts, 'black');
        $blacks_ok = ($black_match['matched'] >= $black_match['required']);

        // Success conditions:
        // 1. Horde sum >= Wind sum (global pressure)
        // 2. All green (terrain) dice matched
        // 3. Whites satisfy reduced wind force (greens reduce it)
        // 4. All black (fate) dice matched
        $success = ($horde_sum >= $wind_sum) && $greens_ok && $whites_ok && $blacks_ok;
        
        if ($success) {
            $this->incStat(1, 'confrontations_won', $player_id);
            $this->incStat(1, 'tiles_traversed', $player_id);
            
            if ($wind_force == 6) {
                $this->incStat(1, 'furevents_defeated', $player_id);
                $this->incStat(1, 'furevents_defeated');
            }
            
            // Add surpass count to score
            $surpass_count = $this->getUniqueValueFromDB("SELECT player_surpass_count FROM player WHERE player_id = $player_id");
            $this->DbQuery("UPDATE player SET player_score = player_score + $surpass_count WHERE player_id = $player_id");
            
            $this->notify->all('confrontationSuccess', clienttranslate('${player_name} overcomes the wind! (+${surpass_points} points for surpass)'), [
                'player_id' => $player_id,
                'player_name' => $this->getActivePlayerName(),
                'horde_sum' => $horde_sum,
                'wind_sum' => $wind_sum,
                'surpass_points' => $surpass_count,
                'wind_value_counts' => $wind_value_counts,
                'player_value_counts' => $player_value_counts
            ]);
            
            // Move player to new tile
            $this->DbQuery("UPDATE player SET player_position_q = {$tile['tile_q']}, player_position_r = {$tile['tile_r']} WHERE player_id = $player_id");
            
            $this->gamestate->nextState('success');
        } else {
            $this->incStat(1, 'confrontations_lost', $player_id);
            
            $this->notify->all('confrontationFailure', clienttranslate('${player_name} is pushed back by the wind!'), [
                'player_id' => $player_id,
                'player_name' => $this->getActivePlayerName(),
                'horde_sum' => $horde_sum,
                'wind_sum' => $wind_sum,
                'wind_value_counts' => $wind_value_counts,
                'player_value_counts' => $player_value_counts
            ]);
            
            $this->gamestate->nextState('failure');
        }
    }

    function stApplyTileEffect()
    {
        $player_id = $this->getActivePlayerId();
        $tile_id = $this->getGameStateValue('selected_tile');
        $tile = $this->getObjectFromDB("SELECT * FROM tile WHERE tile_id = $tile_id");
        
        // Apply moral effect
        if ($tile['tile_moral_effect'] != 0) {
            $this->DbQuery("UPDATE player SET player_moral = GREATEST(0, LEAST(9, player_moral + {$tile['tile_moral_effect']})) WHERE player_id = $player_id");
        }
        
        // Check for recruitment (village or city)
        if ($tile['tile_type'] == 'village' || $tile['tile_type'] == 'city') {
            $this->gamestate->nextState('recruit');
            return;
        }
        
        // Check for special tiles (tour fontaine, porte d'hurle, etc.)
        if ($tile['tile_type'] == 'special') {
            $this->gamestate->nextState('special_tile');
            return;
        }
        
        $this->gamestate->nextState('continue');
    }

    function stNextPlayer()
    {
        $player_id = $this->getActivePlayerId();
        $this->incStat(1, 'turns_number', $player_id);
        $this->incStat(1, 'turns_number');
        
        $this->activeNextPlayer();
        $this->gamestate->nextState('nextTurn');
    }

    function stEndChapter()
    {
        $chapter = $this->getGameStateValue('current_chapter');
        $this->incStat(1, 'chapters_completed');
        
        // Award moral for completing chapter
        $players = $this->loadPlayersBasicInfos();
        foreach ($players as $player_id => $player) {
            $this->DbQuery("UPDATE player SET player_moral = LEAST(9, player_moral + 1) WHERE player_id = $player_id");
        }
        
        // Check if game end (chapter 4 complete)
        if ($chapter >= 4) {
            $this->calculateFinalScores();
            $this->gamestate->nextState('nextChapter');
            return;
        }
        
        $this->gamestate->nextState('nextChapter');
    }

    function stSetupNextChapter()
    {
        $chapter = $this->getGameStateValue('current_chapter') + 1;
        $this->setGameStateValue('current_chapter', $chapter);
        
        // Setup new chapter tiles
        $this->setupChapterTiles($chapter);
        
        // Reset wind tokens
        $this->DbQuery("UPDATE wind_token SET token_location = 'bag', token_tile_id = NULL");
        
        // Reset player positions to new starting city
        // (Implementation depends on chapter layout)
        
        $this->gamestate->nextState('chapterReady');
    }

    /**
     * Calculate final scores
     */
    function calculateFinalScores()
    {
        $players = $this->loadPlayersBasicInfos();
        
        foreach ($players as $player_id => $player) {
            $stats = $this->getObjectFromDB("SELECT * FROM player WHERE player_id = $player_id");
            
            $score = 0;
            $score += $this->getStat('tiles_traversed', $player_id); // 1pt per tile
            $score += $stats['player_moral']; // 1pt per remaining moral
            $score += $this->getStat('furevents_defeated', $player_id) * 3; // 3pt per furevent
            
            // Hordiers alive (2pt each)
            $horde_count = count($this->cards->getCardsInLocation('horde_' . $player_id));
            $score += $horde_count * 2;
            
            $this->DbQuery("UPDATE player SET player_score = $score WHERE player_id = $player_id");
            $this->setStat($score, 'total_score', $player_id);
        }
    }

    //////////////////////////////////////////////////////////////////////////////
    //////////// Zombie
    ////////////

    function zombieTurn($state, $active_player)
    {
        $statename = $state['name'];

        if ($state['type'] === "activeplayer") {
            switch ($statename) {
                case 'draftHorde':
                    // Auto-complete horde with random characters
                    $this->zombieCompleteDraft($active_player);
                    break;
                case 'playerTurn':
                    // Rest
                    $this->gamestate->nextState('rest');
                    break;
                case 'confrontation':
                    // Just confirm
                    $this->gamestate->nextState('checkResult');
                    break;
                default:
                    $this->gamestate->nextState('zombiePass');
                    break;
            }
            return;
        }

        throw new BgaVisibleSystemException("Zombie mode error: unexpected state type");
    }

    function zombieCompleteDraft($player_id)
    {
        // Get current horde
        $horde = $this->cards->getCardsInLocation('horde_' . $player_id);
        $counts = ['traceur' => 0, 'fer' => 0, 'pack' => 0, 'traine' => 0];
        foreach ($horde as $card) {
            if ($card['card_type'] == 'fer' && $card['card_is_leader']) {
                $counts['traceur']++;
            } else {
                $counts[$card['card_type']]++;
            }
        }
        
        // Fill missing slots
        $requirements = ['traceur' => 1, 'fer' => 2, 'pack' => 3, 'traine' => 2];
        
        // First, recruit traceur (fer with is_leader)
        if ($counts['traceur'] < $requirements['traceur']) {
            $traceurs = $this->getCollectionFromDb(
                "SELECT * FROM card WHERE card_type = 'fer' AND card_is_leader = 1 AND card_location = 'deck'"
            );
            if (!empty($traceurs)) {
                $card = array_shift($traceurs);
                $this->cards->moveCard($card['card_id'], 'horde_' . $player_id);
                $this->trackHordierSelection($card['card_id']);
                $counts['traceur']++;
            }
        }
        
        // Then recruit other types
        $other_requirements = ['fer' => 2, 'pack' => 3, 'traine' => 2];
        foreach ($other_requirements as $type => $needed) {
            while ($counts[$type] < $needed) {
                // For fer type, get only fers that are NOT leaders
                if ($type == 'fer') {
                    $cards = $this->getCollectionFromDb(
                        "SELECT * FROM card WHERE card_type = 'fer' AND card_is_leader = 0 AND card_location = 'deck' LIMIT 1"
                    );
                } else {
                    $cards = $this->cards->getCardsOfTypeInLocation($type, null, 'deck');
                }
                
                if (!empty($cards)) {
                    $card = array_shift($cards);
                    $this->cards->moveCard($card['card_id'], 'horde_' . $player_id);
                    $this->trackHordierSelection($card['card_id']);
                    $counts[$type]++;
                } else {
                    break;  // Pas assez de cartes
                }
            }
        }
        
        $this->gamestate->nextState('hordeComplete');
    }

    //////////////////////////////////////////////////////////////////////////////
    //////////// Debug
    ////////////

    function debug_setMoral($moral)
    {
        $player_id = $this->getCurrentPlayerId();
        $this->DbQuery("UPDATE player SET player_moral = $moral WHERE player_id = $player_id");
    }
}
