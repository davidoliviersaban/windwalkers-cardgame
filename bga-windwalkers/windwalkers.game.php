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

// Load modular traits
require_once(__DIR__ . '/modules/WW_HexGrid.php');
require_once(__DIR__ . '/modules/WW_Dice.php');
require_once(__DIR__ . '/modules/WW_WindToken.php');
require_once(__DIR__ . '/modules/WW_Validation.php');
require_once(__DIR__ . '/modules/WW_PlayerHelper.php');
require_once(__DIR__ . '/modules/WW_Setup.php');
require_once(__DIR__ . '/modules/WW_Draft.php');
require_once(__DIR__ . '/modules/WW_Movement.php');
require_once(__DIR__ . '/modules/WW_Confrontation.php');

class Windwalkers extends Table
{
    // Include modular traits
    use WW_HexGrid;
    use WW_Dice;
    use WW_WindToken;
    use WW_Validation;
    use WW_PlayerHelper;
    use WW_Setup;
    use WW_Draft;
    use WW_Movement;
    use WW_Confrontation;

    function __construct()
    {
        parent::__construct();
        
        // Load game material
        include_once(__DIR__ . '/material.inc.php');

        // Initialize Deck component for character cards
        $this->cards = $this->deckFactory->createDeck('card');
        $this->cards->init('card');

        // Declare game state labels (IDs must be >= 10)
        $this->initGameStateLabels([
            'current_chapter' => 10,
            'current_round' => 11,
            'selected_tile' => 12,
            'player_to_eliminate' => 13
        ]);
    }

    //////////////////////////////////////////////////////////////////////////////
    //////////// Game Setup
    //////////////////////////////////////////////////////////////////////////////

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

        // Determine starting chapter
        $startingChapter = $this->determineStartingChapter();
        
        // Init global values
        $this->setGameStateInitialValue('current_chapter', $startingChapter);
        $this->setGameStateInitialValue('current_round', 1);
        $this->setGameStateInitialValue('selected_tile', 0);

        // Init game statistics
        $this->initializeStatistics($players);

        // Setup game components
        $this->setupCharacterCards();
        $this->setupWindTokens();
        $this->setupChapterTiles($startingChapter);

        // Initialize player positions
        $this->initializePlayerPositions(array_keys($players), $startingChapter);

        // Activate first player
        $this->activeNextPlayer();

        // Start at draft phase
        return 2;
    }

    /**
     * Determine starting chapter from options
     */
    private function determineStartingChapter(): int
    {
        $startingChapter = 1;
        if (method_exists($this, 'getGameOption')) {
            try {
                $optChapter = (int) $this->getGameOption(101);
                if ($optChapter >= 1 && $optChapter <= 4) {
                    $startingChapter = $optChapter;
                }
            } catch (Exception $e) {
                // Fallback to default
            }
        }
        return $startingChapter;
    }

    /**
     * Initialize all game statistics
     */
    private function initializeStatistics(array $players): void
    {
        // Table stats
        $this->initStat('table', 'turns_number', 0);
        $this->initStat('table', 'chapters_completed', 0);
        $this->initStat('table', 'total_wind_faced', 0);
        $this->initStat('table', 'furevents_defeated', 0);
        $this->initStat('table', 'hordier_selections', 0);

        // Player stats
        foreach ($players as $player_id => $player) {
            $this->initStat('player', 'turns_number', 0, $player_id);
            $this->initStat('player', 'tiles_traversed', 0, $player_id);
            $this->initStat('player', 'hordiers_lost', 0, $player_id);
            $this->initStat('player', 'moral_spent', 0, $player_id);
            $this->initStat('player', 'powers_used', 0, $player_id);
            $this->initStat('player', 'surpass_count', 0, $player_id);
            $this->initStat('player', 'surpass_success', 0, $player_id);
            $this->initStat('player', 'surpass_points', 0, $player_id);
            $this->initStat('player', 'rest_count', 0, $player_id);
            $this->initStat('player', 'furevents_defeated', 0, $player_id);
            $this->initStat('player', 'confrontations_won', 0, $player_id);
            $this->initStat('player', 'confrontations_lost', 0, $player_id);
            $this->initStat('player', 'total_score', 0, $player_id);
        }
    }

    //////////////////////////////////////////////////////////////////////////////
    //////////// getAllDatas
    //////////////////////////////////////////////////////////////////////////////

    protected function getAllDatas()
    {
        $result = [];
        $current_player_id = $this->getCurrentPlayerId();

        // Get chapter from player record
        $chapter = $this->getValidatedPlayerChapter($current_player_id);
        $result['current_chapter'] = $chapter;
        
        // Ensure tiles exist
        $this->ensureTilesExist($chapter);

        // Players info with enriched data
        $result['players'] = $this->loadPlayersBasicInfos();
        $enriched = $this->enrichPlayerInfo(array_keys($result['players']));
        foreach ($result['players'] as $player_id => &$player) {
            if (isset($enriched[$player_id])) {
                $player = array_merge($player, $enriched[$player_id]);
            }
        }
        unset($player);

        // Tiles for current chapter
        $result['tiles'] = $this->getCollectionFromDb(
            "SELECT tile_id id, tile_q q, tile_r r, tile_type type, tile_subtype subtype,
             tile_wind_force wind_force, tile_discovered discovered,
             tile_white_dice white_dice, tile_green_dice green_dice, 
             tile_black_dice black_dice, tile_moral_effect moral_effect
             FROM tile WHERE tile_chapter = $chapter"
        );

        // Player's horde (with power_used status for UI)
        $result['myHorde'] = [];
        try {
            $result['myHorde'] = $this->getHordeWithPowerStatus($current_player_id);
        } catch (Exception $e) {
            // Cards may not be set up yet
        }

        $result['recruitPool'] = [];

        // Material data
        $result['characters'] = $this->characters ?? [];
        $result['character_types'] = $this->character_types ?? [];
        $result['terrain_types'] = $this->terrain_types ?? [];

        // Current dice (for restoring after refresh during confrontation)
        $result['horde_dice'] = $this->getCollectionFromDb("SELECT * FROM dice_roll WHERE dice_owner = 'player'");
        $result['challenge_dice'] = $this->getCollectionFromDb("SELECT * FROM dice_roll WHERE dice_owner = 'challenge'");
        
        // Selected tile (for showing wind force)
        $selected_tile_id = $this->getGameStateValue('selected_tile');
        if ($selected_tile_id > 0) {
            $result['selected_tile'] = $this->getObjectFromDB("SELECT * FROM tile WHERE tile_id = $selected_tile_id");
        }

        return $result;
    }

    //////////////////////////////////////////////////////////////////////////////
    //////////// Game Progression
    //////////////////////////////////////////////////////////////////////////////

    function getGameProgression(): int
    {
        $chapter = $this->getGameStateValue('current_chapter');
        return min(100, ($chapter - 1) * 25);
    }

    //////////////////////////////////////////////////////////////////////////////
    //////////// Recruitment
    //////////////////////////////////////////////////////////////////////////////

    /**
     * Get characters available for recruitment at current location
     * Uses persistent pools that last until chapter end
     */
    function getRecruitPool(int $player_id): array
    {
        $player = $this->getObjectFromDB("SELECT * FROM player WHERE player_id = $player_id");
        $chapter = $this->getGameStateValue('current_chapter');
        
        $tile = $this->getTileAt(
            (int)$player['player_position_q'], 
            (int)$player['player_position_r'], 
            $chapter
        );
        
        if (!$tile) {
            return [];
        }
        
        return $this->getRecruitableCharacters($tile);
    }

    /**
     * Get the location string for a village/city recruit pool
     */
    private function getRecruitLocation(array $tile): string
    {
        $chapter = $this->getGameStateValue('current_chapter');
        return 'recruit_' . $tile['tile_q'] . '_' . $tile['tile_r'] . '_ch' . $chapter;
    }

    /**
     * Get recruitable characters based on tile type
     * Uses persistent pools for both villages and cities
     */
    private function getRecruitableCharacters(array $tile): array
    {
        if ($tile['tile_type'] == 'city') {
            // Cities: 2 of each type (fer, pack, traine)
            return $this->getOrCreateRecruitPool($tile, 2, 2, 2);
        }
        
        if ($tile['tile_type'] == 'village') {
            return $this->getVillageRecruitPool($tile);
        }
        
        return [];
    }

    /**
     * Get recruit pool for a village based on its color/type
     */
    private function getVillageRecruitPool(array $tile): array
    {
        switch ($tile['tile_subtype']) {
            case 'village_green':
                // Village vert: 2 traîne (vert)
                return $this->getOrCreateRecruitPool($tile, 0, 0, 2);
            case 'village_red':
                // Village rouge: 2 fer (rouge)
                return $this->getOrCreateRecruitPool($tile, 2, 0, 0);
            case 'village_blue':
                // Village bleu: 2 pack (bleu)
                return $this->getOrCreateRecruitPool($tile, 0, 2, 0);
            default:
                return [];
        }
    }

    /**
     * Get existing recruit pool or create a new one
     * Pools persist until chapter end
     * 
     * @param array $tile The tile (village or city)
     * @param int $ferCount Number of Fer (red) cards to draw
     * @param int $packCount Number of Pack (blue) cards to draw
     * @param int $traineCount Number of Traîne (green) cards to draw
     * @return array The recruit pool cards
     */
    private function getOrCreateRecruitPool(array $tile, int $ferCount, int $packCount, int $traineCount): array
    {
        $location = $this->getRecruitLocation($tile);
        $poolKey = "pool_init_{$location}";  // location already contains chapter info
        
        // Check if pool was already initialized this chapter (even if now empty)
        $poolInitialized = $this->getUniqueValueFromDB(
            "SELECT var_value FROM global_var WHERE var_name = '$poolKey'"
        );
        
        // Get existing pool
        $existingPool = $this->getCollectionFromDb(
            "SELECT * FROM card WHERE card_location = '$location'"
        );
        
        // If pool was already initialized, return current state (even if empty)
        if ($poolInitialized) {
            return $existingPool;
        }
        
        // First time visiting this location this chapter - create the pool
        $this->DbQuery("INSERT INTO global_var (var_name, var_value) VALUES ('$poolKey', '1') 
                        ON DUPLICATE KEY UPDATE var_value = '1'");
        
        // If there are already cards (from released hordiers), don't add more
        if (!empty($existingPool)) {
            return $existingPool;
        }
        
        // Create new pool - draw cards and assign to this location
        $newCards = $this->drawRecruitCards($ferCount, $packCount, $traineCount);
        
        // Move cards to pool location
        foreach ($newCards as $card) {
            $card_id = $card['card_id'];
            $this->DbQuery("UPDATE card SET card_location = '$location' WHERE card_id = $card_id");
        }
        
        // Return the cards with updated location
        return $this->getCollectionFromDb(
            "SELECT * FROM card WHERE card_location = '$location'"
        );
    }

    /**
     * Draw cards for recruitment based on specified counts
     * 
     * @param int $ferCount Number of Fer (red) cards
     * @param int $packCount Number of Pack (blue) cards
     * @param int $traineCount Number of Traîne (green) cards
     * @return array The drawn cards
     */
    private function drawRecruitCards(int $ferCount, int $packCount, int $traineCount): array
    {
        $cards = [];
        
        if ($ferCount > 0) {
            $fer = $this->getCollectionFromDb(
                "SELECT * FROM card WHERE card_type = 'fer' AND card_is_leader = 0 AND card_location = 'deck' ORDER BY RAND() LIMIT $ferCount"
            );
            $cards = array_merge($cards, $fer);
        }
        
        if ($packCount > 0) {
            $pack = $this->getCollectionFromDb(
                "SELECT * FROM card WHERE card_type = 'pack' AND card_location = 'deck' ORDER BY RAND() LIMIT $packCount"
            );
            $cards = array_merge($cards, $pack);
        }
        
        if ($traineCount > 0) {
            $traine = $this->getCollectionFromDb(
                "SELECT * FROM card WHERE card_type = 'traine' AND card_location = 'deck' ORDER BY RAND() LIMIT $traineCount"
            );
            $cards = array_merge($cards, $traine);
        }
        
        return $cards;
    }

    /**
     * Add a card to a location's recruit pool (when released in that village/city)
     */
    function addCardToRecruitPool(int $card_id, array $tile): void
    {
        if ($tile['tile_type'] != 'village' && $tile['tile_type'] != 'city') {
            // Not a village or city, just discard
            $this->DbQuery("UPDATE card SET card_location = 'discard' WHERE card_id = $card_id");
            return;
        }
        
        $location = $this->getRecruitLocation($tile);
        $this->DbQuery("UPDATE card SET card_location = '$location' WHERE card_id = $card_id");
    }

    /**
     * Clear all recruit pools (villages and cities) for a chapter
     * Called at chapter end - cards go back to deck
     */
    function clearRecruitPoolsForChapter(int $chapter): void
    {
        // Clear cards from recruit pools
        $this->DbQuery(
            "UPDATE card SET card_location = 'deck' WHERE card_location LIKE 'recruit_%_ch$chapter'"
        );
        
        // Clear pool initialization flags for this chapter
        $this->DbQuery(
            "DELETE FROM global_var WHERE var_name LIKE 'pool_init_recruit_%_ch$chapter'"
        );
    }

    //////////////////////////////////////////////////////////////////////////////
    //////////// Game State Actions
    //////////////////////////////////////////////////////////////////////////////

    function stNextDraft(): void
    {
        $player_id = $this->getActivePlayerId();
        
        $horde = $this->cards->getCardsInLocation('horde_' . $player_id);
        if (count($horde) < 8) {
            $this->gamestate->nextState('nextPlayer');
            return;
        }
        
        $this->activeNextPlayer();
        $next_player = $this->getActivePlayerId();
        
        if ($next_player == $this->getPlayerAfter($this->getPlayerBefore($player_id))) {
            $this->gamestate->nextState('allDrafted');
        } else {
            $this->gamestate->nextState('nextPlayer');
        }
    }

    function stRest(): void
    {
        // Reset movement counters for the active player (after failure or manual rest)
        $player_id = $this->getActivePlayerId();
        $this->DbQuery("UPDATE player SET player_has_moved = 0, player_surpass_count = 0 WHERE player_id = $player_id");
        
        // Get current tile to check if in city
        $player = $this->getObjectFromDB("SELECT * FROM player WHERE player_id = $player_id");
        $tile = $this->getTileAt((int)$player['player_position_q'], (int)$player['player_position_r'], (int)$player['player_chapter']);
        
        // In cities: rest ALL Hordiers (reactivate all powers)
        if ($tile && $tile['tile_type'] == 'city') {
            $rested_count = $this->restAllHordiers($player_id);
            if ($rested_count > 0) {
                $this->notifyAllPlayers('allHordiersRested', clienttranslate('${player_name} rests in the city - all Hordiers recover their powers'), [
                    'player_id' => $player_id,
                    'player_name' => $this->getActivePlayerName(),
                    'rested_count' => $rested_count
                ]);
            }
        } else {
            // On regular tiles: rest 1 Hordier
            $rested_card = $this->restOneHordier($player_id);
            if ($rested_card) {
                $char_info = $this->characters[$rested_card['card_type_arg']] ?? ['name' => 'Hordier'];
                $this->notifyAllPlayers('hordierRested', clienttranslate('${player_name} rests ${character_name}'), [
                    'player_id' => $player_id,
                    'player_name' => $this->getActivePlayerName(),
                    'card_id' => $rested_card['card_id'],
                    'character_name' => $char_info['name'],
                    'terrain_name' => $tile ? $tile['tile_subtype'] : ''
                ]);
            }
        }
        
        $this->notifyAllPlayers('playerRests', clienttranslate('${player_name} rests and resets surpass counter'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'dice_count' => (int)$player['player_dice_count'],
            'surpass_count' => 0
        ]);
        
        $this->incStat(1, 'rest_count', $player_id);
        
        $this->gamestate->nextState('restComplete');
    }

    function stApplyTileEffect(): void
    {
        $player_id = $this->getActivePlayerId();
        $tile_id = $this->getGameStateValue('selected_tile');
        $tile = $this->getTileById($tile_id);
        
        // Get terrain/building name
        $terrain_name = $tile['tile_subtype'];
        if (isset($this->terrain_types[$tile['tile_subtype']])) {
            $terrain_name = $this->terrain_types[$tile['tile_subtype']]['name'];
        } elseif (isset($this->village_types[$tile['tile_subtype']])) {
            $terrain_name = $this->village_types[$tile['tile_subtype']]['name'];
        } elseif (isset($this->cities[$tile['tile_subtype']])) {
            $terrain_name = $this->cities[$tile['tile_subtype']]['name'];
        }
        
        // Calculate moral effect
        $moral_effect = (int)$tile['tile_moral_effect'];
        
        // Cities give +1 moral when passing through
        if ($tile['tile_type'] == 'city') {
            $moral_effect = 1;
        }
        
        // Apply moral effect
        if ($moral_effect != 0) {
            $new_moral = $this->modifyPlayerMoral($player_id, $moral_effect);
            
            if ($moral_effect > 0) {
                $this->notifyAllPlayers('moralChanged', clienttranslate('${player_name} gains ${amount} moral from ${terrain_name}'), [
                    'player_id' => $player_id,
                    'player_name' => $this->getActivePlayerName(),
                    'amount' => $moral_effect,
                    'new_moral' => $new_moral,
                    'terrain_name' => $terrain_name
                ]);
            } else {
                $this->notifyAllPlayers('moralChanged', clienttranslate('${player_name} loses ${amount} moral from ${terrain_name}'), [
                    'player_id' => $player_id,
                    'player_name' => $this->getActivePlayerName(),
                    'amount' => abs($moral_effect),
                    'new_moral' => $new_moral,
                    'terrain_name' => $terrain_name
                ]);
            }
        }
        
        // Cities and villages: rest 1 Hordier when passing through
        if ($tile['tile_type'] == 'village' || $tile['tile_type'] == 'city') {
            $rested_card = $this->restOneHordier($player_id);
            if ($rested_card) {
                $char_info = $this->characters[$rested_card['card_type_arg']] ?? ['name' => 'Hordier'];
                $this->notifyAllPlayers('hordierRested', clienttranslate('${player_name} rests ${character_name} at ${terrain_name}'), [
                    'player_id' => $player_id,
                    'player_name' => $this->getActivePlayerName(),
                    'card_id' => $rested_card['card_id'],
                    'character_name' => $char_info['name'],
                    'terrain_name' => $terrain_name
                ]);
            }
        }
        
        // Score is now updated incrementally in WW_Confrontation
        
        // Check if player reached chapter destination
        if ($this->isChapterDestination($tile)) {
            $this->gamestate->nextState('endChapter');
            return;
        }
        
        // Check for recruitment or special
        if ($tile['tile_type'] == 'village' || $tile['tile_type'] == 'city') {
            $this->gamestate->nextState('recruit');
            return;
        }
        
        if ($tile['tile_type'] == 'special') {
            $this->gamestate->nextState('special_tile');
            return;
        }
        
        $this->gamestate->nextState('continue');
    }

    function stNextPlayer(): void
    {
        $player_id = $this->getActivePlayerId();
        $this->incStat(1, 'turns_number', $player_id);
        $this->incStat(1, 'turns_number');
        
        $this->activeNextPlayer();
        $this->gamestate->nextState('nextTurn');
    }

    function stEndRound(): void
    {
        // End of round - all players have taken their turn
        // For now, just start a new round
        $this->gamestate->nextState('newRound');
    }

    function stEndChapter(): void
    {
        $chapter = $this->getGameStateValue('current_chapter');
        $this->incStat(1, 'chapters_completed');
        
        // Clear all recruit pools (villages and cities) for this chapter - cards go back to deck
        $this->clearRecruitPoolsForChapter($chapter);
        
        // Calculate and display final scores for this chapter
        $players = $this->loadPlayersBasicInfos();
        foreach ($players as $player_id => $player) {
            // Award moral for completing chapter
            $this->modifyPlayerMoral($player_id, 1);
            
            // Update score with chapter-end bonuses (moral + hordiers)
            $this->updateChapterEndScore($player_id);
        }
        
        // Notify chapter completion
        $this->notifyAllPlayers('chapterComplete', clienttranslate('Chapter ${chapter_num} complete!'), [
            'chapter_num' => $chapter
        ]);
        
        if ($chapter >= 4) {
            // Game over - calculate final scores
            $this->calculateFinalScores();
            $this->gamestate->nextState('gameEnd');
            return;
        }
        
        $this->gamestate->nextState('nextChapter');
    }

    function argEndChapter(): array
    {
        return [
            'chapter_num' => $this->getGameStateValue('current_chapter')
        ];
    }

    function argRecruitment(): array
    {
        $player_id = $this->getActivePlayerId();
        $horde = $this->getHordeWithPowerStatus($player_id);
        $counts = $this->countHordeByType($horde);
        $requirements = $this->getHordeRequirements();
        
        // Determine which types are "full" (can't recruit more)
        $fullTypes = [];
        foreach ($requirements as $type => $required) {
            if (($counts[$type] ?? 0) >= $required) {
                $fullTypes[] = $type;
            }
        }
        
        return [
            'recruitPool' => $this->getRecruitPool($player_id),
            'horde' => $horde,
            'horde_count' => count($horde),
            'counts' => $counts,
            'requirements' => $requirements,
            'fullTypes' => $fullTypes
        ];
    }

    function argMustReleaseHordier(): array
    {
        $player_id = $this->getActivePlayerId();
        $horde = $this->getHordeWithPowerStatus($player_id);
        return [
            'horde' => $horde,
            'horde_count' => count($horde)
        ];
    }

    function stSetupNextChapter(): void
    {
        $this->transitionToNextChapter();
        
        $chapter = $this->getGameStateValue('current_chapter');
        
        // Get the new tiles
        $tiles = $this->getCollectionFromDb(
            "SELECT tile_id id, tile_q q, tile_r r, tile_type type, tile_subtype subtype,
             tile_wind_force wind_force, tile_discovered discovered,
             tile_white_dice white_dice, tile_green_dice green_dice, 
             tile_black_dice black_dice, tile_moral_effect moral_effect
             FROM tile WHERE tile_chapter = $chapter"
        );
        
        // Get player positions (they are now at start city of new chapter)
        $players = $this->loadPlayersBasicInfos();
        $enriched = $this->enrichPlayerInfo(array_keys($players));
        foreach ($players as $player_id => &$player) {
            if (isset($enriched[$player_id])) {
                $player = array_merge($player, $enriched[$player_id]);
            }
        }
        unset($player);
        
        // Notify all players of new chapter
        $this->notifyAllPlayers('newChapter', clienttranslate('Starting Chapter ${chapter_num}!'), [
            'chapter_num' => $chapter,
            'tiles' => $tiles,
            'players' => $players
        ]);
        
        // Activate first player for the new chapter
        $this->activeNextPlayer();
        
        $this->gamestate->nextState('chapterReady');
    }

    function argSetupNextChapter(): array
    {
        return [
            'chapter_num' => $this->getGameStateValue('current_chapter') + 1
        ];
    }

    //////////////////////////////////////////////////////////////////////////////
    //////////// Final Scoring
    //////////////////////////////////////////////////////////////////////////////

    /**
     * Check if tile is the chapter destination
     */
    private function isChapterDestination(array $tile): bool
    {
        $chapter = $this->getGameStateValue('current_chapter');
        if (!isset($this->chapters[$chapter])) {
            return false;
        }
        
        $end_city = $this->chapters[$chapter]['end_city'];
        return $tile['tile_subtype'] === $end_city;
    }

    /**
     * Update and notify player score during game
     * During gameplay, only show earned points (tiles, surpass, furevents)
     * Moral and hordiers are only counted at end of chapter
     */
    function updatePlayerScore(int $player_id): void
    {
        $score = $this->calculateInGameScore($player_id);
        $this->DbQuery("UPDATE player SET player_score = $score WHERE player_id = $player_id");
        
        // Notify all players of score update
        $this->notifyAllPlayers('scoreUpdate', '', [
            'player_id' => $player_id,
            'score' => $score,
            'breakdown' => $this->getInGameScoreBreakdown($player_id)
        ]);
    }

    /**
     * Calculate in-game score (points earned during play)
     * Does NOT include moral/hordiers as those are end-of-chapter bonuses
     */
    private function calculateInGameScore(int $player_id): int
    {
        $score = 0;
        
        // Tiles traversed (1 point each)
        $tiles = $this->getStat('tiles_traversed', $player_id);
        $score += $tiles;
        
        // Surpass points
        $surpass_total = $this->getStat('surpass_points', $player_id) ?? 0;
        $score += $surpass_total;
        
        // Furevents defeated (3 points each)
        $furevents = $this->getStat('furevents_defeated', $player_id);
        $score += $furevents * 3;
        
        return $score;
    }
    
    /**
     * Get in-game score breakdown (without end-of-chapter bonuses)
     */
    private function getInGameScoreBreakdown(int $player_id): array
    {
        $tiles = $this->getStat('tiles_traversed', $player_id);
        $surpass = $this->getStat('surpass_points', $player_id) ?? 0;
        $furevents = $this->getStat('furevents_defeated', $player_id);
        
        return [
            'tiles' => $tiles,
            'surpass' => $surpass,
            'furevents' => $furevents,
            'furevents_points' => $furevents * 3
        ];
    }
    
    /**
     * Update score at end of chapter - ADD moral and hordiers bonuses to current score
     */
    function updateChapterEndScore(int $player_id): void
    {
        // Get current score
        $currentScore = $this->getUniqueValueFromDb("SELECT player_score FROM player WHERE player_id = $player_id");
        
        // Calculate chapter-end bonuses
        $moral = $this->getPlayerMoral($player_id);
        $hordiers = count($this->cards->getCardsInLocation('horde_' . $player_id));
        $chapterBonus = $moral + ($hordiers * 2);
        
        // Add bonus to score
        $newScore = $currentScore + $chapterBonus;
        $this->DbQuery("UPDATE player SET player_score = $newScore WHERE player_id = $player_id");
        
        // Notify all players of chapter end bonus
        $this->notifyAllPlayers('chapterEndScore', clienttranslate('${player_name} earns ${bonus} bonus points (${moral} moral + ${hordiers_points} for ${hordiers} hordiers)'), [
            'player_id' => $player_id,
            'player_name' => $this->getPlayerNameById($player_id),
            'score' => $newScore,
            'bonus' => $chapterBonus,
            'moral' => $moral,
            'hordiers' => $hordiers,
            'hordiers_points' => $hordiers * 2
        ]);
    }

    function calculateFinalScores(): void
    {
        $players = $this->loadPlayersBasicInfos();
        
        foreach ($players as $player_id => $player) {
            // Skip eliminated players (their score is already set to 0)
            if (isset($player['player_eliminated']) && $player['player_eliminated']) {
                continue;
            }
            
            $score = $this->calculatePlayerScore($player_id);
            $this->DbQuery("UPDATE player SET player_score = $score WHERE player_id = $player_id");
            $this->setStat($score, 'total_score', $player_id);
            
            // Notify final score with breakdown
            $this->notifyAllPlayers('finalScore', clienttranslate('${player_name} scores ${score} points'), [
                'player_id' => $player_id,
                'player_name' => $player['player_name'],
                'score' => $score,
                'breakdown' => $this->getScoreBreakdown($player_id)
            ]);
        }
    }

    /**
     * Calculate player FINAL score according to rules:
     * - 1 point per tile traversed
     * - Surpass points (cumulative: 0+1+2+3+4+5...)
     * - 1 point per moral remaining
     * - 2 points per Hordier in horde
     * - 3 points per Furevent defeated
     * - Chapter bonus (e.g., Porte d'Hurle: 5 points)
     */
    private function calculatePlayerScore(int $player_id): int
    {
        $score = 0;
        
        // Tiles traversed (1 point each)
        $tiles = $this->getStat('tiles_traversed', $player_id);
        $score += $tiles;
        
        // Surpass points are already added during game (cumulative)
        // They are stored in player_score incrementally, so we don't add them here
        // Actually we recalculate from scratch, so we need surpass_total stat
        $surpass_total = $this->getStat('surpass_points', $player_id) ?? 0;
        $score += $surpass_total;
        
        // Moral remaining (1 point each)
        $moral = $this->getPlayerMoral($player_id);
        $score += $moral;
        
        // Hordiers remaining (2 points each)
        $hordiers = count($this->cards->getCardsInLocation('horde_' . $player_id));
        $score += $hordiers * 2;
        
        // Furevents defeated (3 points each)
        $furevents = $this->getStat('furevents_defeated', $player_id);
        $score += $furevents * 3;
        
        return $score;
    }

    /**
     * Get detailed score breakdown for display
     */
    private function getScoreBreakdown(int $player_id): array
    {
        $tiles = $this->getStat('tiles_traversed', $player_id);
        $surpass = $this->getStat('surpass_points', $player_id) ?? 0;
        $moral = $this->getPlayerMoral($player_id);
        $hordiers = count($this->cards->getCardsInLocation('horde_' . $player_id));
        $furevents = $this->getStat('furevents_defeated', $player_id);
        
        return [
            'tiles' => $tiles,
            'surpass' => $surpass,
            'moral' => $moral,
            'hordiers' => $hordiers,
            'hordiers_points' => $hordiers * 2,
            'furevents' => $furevents,
            'furevents_points' => $furevents * 3
        ];
    }

    //////////////////////////////////////////////////////////////////////////////
    //////////// Zombie Mode
    //////////////////////////////////////////////////////////////////////////////

    function zombieTurn(array $state, int $active_player): void
    {
        $statename = $state['name'];

        if ($state['type'] === "activeplayer") {
            switch ($statename) {
                case 'draftHorde':
                    $this->zombieCompleteDraft($active_player);
                    break;
                case 'playerTurn':
                    $this->gamestate->nextState('rest');
                    break;
                case 'confrontation':
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

    //////////////////////////////////////////////////////////////////////////////
    //////////// Debug
    //////////////////////////////////////////////////////////////////////////////

    function debug_setMoral(int $moral): void
    {
        $player_id = $this->getCurrentPlayerId();
        $this->DbQuery("UPDATE player SET player_moral = $moral WHERE player_id = $player_id");
    }
}
