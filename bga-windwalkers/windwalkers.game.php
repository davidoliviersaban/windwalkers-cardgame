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
            'selected_tile' => 12
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

        // Player's horde
        $result['myHorde'] = [];
        try {
            $result['myHorde'] = $this->cards->getCardsInLocation('horde_' . $current_player_id);
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
     * Get recruitable characters based on tile type
     */
    private function getRecruitableCharacters(array $tile): array
    {
        if ($tile['tile_type'] == 'city') {
            // Cities: 2 characters from each type
            $fer = $this->getCollectionFromDb(
                "SELECT * FROM card WHERE card_type = 'fer' AND card_location = 'deck' ORDER BY RAND() LIMIT 2"
            );
            $pack = $this->getCollectionFromDb(
                "SELECT * FROM card WHERE card_type = 'pack' AND card_location = 'deck' ORDER BY RAND() LIMIT 2"
            );
            $traine = $this->getCollectionFromDb(
                "SELECT * FROM card WHERE card_type = 'traine' AND card_location = 'deck' ORDER BY RAND() LIMIT 2"
            );
            return array_merge($fer, $pack, $traine);
        }
        
        if ($tile['tile_type'] == 'village') {
            return $this->getVillageRecruits($tile['tile_subtype']);
        }
        
        return [];
    }

    /**
     * Get village-specific recruits (limited to 2 random characters)
     */
    private function getVillageRecruits(string $subtype): array
    {
        switch ($subtype) {
            case 'village_green':
                return $this->getCollectionFromDb(
                    "SELECT * FROM card WHERE card_type = 'pack' AND card_location = 'deck' ORDER BY RAND() LIMIT 2"
                );
            case 'village_red':
                return $this->getCollectionFromDb(
                    "SELECT * FROM card WHERE card_type = 'fer' AND card_is_leader = 0 AND card_location = 'deck' ORDER BY RAND() LIMIT 2"
                );
            case 'village_blue':
                return $this->getCollectionFromDb(
                    "SELECT * FROM card WHERE card_type = 'traine' AND card_location = 'deck' ORDER BY RAND() LIMIT 2"
                );
            default:
                return [];
        }
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
        
        // Get updated player data for notification
        $player = $this->getObjectFromDB("SELECT * FROM player WHERE player_id = $player_id");
        
        $this->notifyAllPlayers('playerRests', clienttranslate('${player_name} rests and resets surpass counter'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'dice_count' => (int)$player['player_dice_count'],
            'surpass_count' => 0
        ]);
        
        $this->gamestate->nextState('restComplete');
    }

    function stApplyTileEffect(): void
    {
        $player_id = $this->getActivePlayerId();
        $tile_id = $this->getGameStateValue('selected_tile');
        $tile = $this->getTileById($tile_id);
        
        // Apply moral effect
        if ($tile['tile_moral_effect'] != 0) {
            $this->modifyPlayerMoral($player_id, $tile['tile_moral_effect']);
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
        
        // Award moral for completing chapter
        $players = $this->loadPlayersBasicInfos();
        foreach ($players as $player_id => $player) {
            $this->modifyPlayerMoral($player_id, 1);
        }
        
        if ($chapter >= 4) {
            $this->calculateFinalScores();
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
        return [
            'recruitPool' => $this->getRecruitPool($player_id),
            'horde' => $this->cards->getCardsInLocation('horde_' . $player_id),
            'horde_count' => count($this->cards->getCardsInLocation('horde_' . $player_id))
        ];
    }

    function stSetupNextChapter(): void
    {
        $this->transitionToNextChapter();
        $this->gamestate->nextState('chapterReady');
    }

    //////////////////////////////////////////////////////////////////////////////
    //////////// Final Scoring
    //////////////////////////////////////////////////////////////////////////////

    function calculateFinalScores(): void
    {
        $players = $this->loadPlayersBasicInfos();
        
        foreach ($players as $player_id => $player) {
            $score = $this->calculatePlayerScore($player_id);
            $this->DbQuery("UPDATE player SET player_score = $score WHERE player_id = $player_id");
            $this->setStat($score, 'total_score', $player_id);
        }
    }

    private function calculatePlayerScore(int $player_id): int
    {
        $score = 0;
        $score += $this->getStat('tiles_traversed', $player_id);
        $score += $this->getPlayerMoral($player_id);
        $score += $this->getStat('furevents_defeated', $player_id) * 3;
        $score += count($this->cards->getCardsInLocation('horde_' . $player_id)) * 2;
        
        return $score;
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
