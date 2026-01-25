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

    const LAST_CHAPTER = 4;
    const FUREVENT_SCORE_MULTIPLIER = 3;
    const PORTEDHURLE_SCORE_MULTIPLIER = 6;
    const HORDE_SCORE_MULTIPLIER = 2;

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
            'current_round' => 11,       // Total days since game start (for scoring)
            'selected_tile' => 12,
            'player_to_eliminate' => 13,
            'first_player' => 14,
            'chapter_round' => 15,       // Days in current chapter (resets each chapter)
            'rest_next_state' => 16      // Where to go after choosing hordier to rest (0=nextPlayer, 1=recruit)
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

        // Determine starting values from options first (needed for player creation)
        $startingChapter = $this->determineStartingChapter($options);
        $startingDice = $this->determineStartingDice($options);
        $startingMoral = $this->determineStartingMoral($options);

        // Create players with starting moral based on difficulty
        $sql = "INSERT INTO player (player_id, player_color, player_canal, player_name, player_avatar, player_moral, player_score) VALUES ";
        $values = [];
        foreach ($players as $player_id => $player) {
            $color = array_shift($default_colors);
            $values[] = "('" . $player_id . "','" . $color . "','" . $player['player_canal'] . "','" . addslashes($player['player_name']) . "','" . addslashes($player['player_avatar']) . "', $startingMoral, 0)";
        }
        $sql .= implode(',', $values);
        $this->DbQuery($sql);

        $this->reloadPlayersBasicInfos();

        // Apply starting dice count to all players
        $this->DbQuery("UPDATE player SET player_dice_count = $startingDice");

        // Init global values
        $this->setGameStateInitialValue('current_chapter', $startingChapter);
        $this->setGameStateInitialValue('current_round', 1);      // Total days
        $this->setGameStateInitialValue('chapter_round', 1);     // Days in chapter
        $this->setGameStateInitialValue('selected_tile', 0);
        $this->setGameStateInitialValue('first_player', 0);
        $this->setGameStateInitialValue('rest_next_state', 0);   // 0=nextPlayer, 1=recruit

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

        // Store first player for round tracking
        $firstPlayer = $this->getActivePlayerId();
        $this->setGameStateValue('first_player', $firstPlayer);

        // Start at draft phase
        return 2;
    }

    private function determineStartingChapter(array $options = []): int
    {
        $value = $options[101] ?? $options['101'] ?? 1;
        $startingChapter = (int) $value;
        return ($startingChapter >= 1 && $startingChapter <= self::LAST_CHAPTER) ? $startingChapter : 1;
    }

    private function determineStartingDice(array $options = []): int
    {
        $value = $options[102] ?? $options['102'] ?? 2;
        $difficulty = (int) $value;

        // Easy=7, Normal=6, Hard=6, Extreme=5
        switch ($difficulty) {
            case 1:
                return 7;  // Easy
            case 2:
                return 6;  // Normal
            case 3:
                return 6;  // Hard (same dice as Normal, but less moral)
            case 4:
                return 5;  // Extreme
            default:
                return 6; // Normal by default
        }
    }

    private function determineStartingMoral(array $options = []): int
    {
        $value = $options[102] ?? $options['102'] ?? 2;
        $difficulty = (int) $value;

        // Easy=9, Normal=9, Hard=3, Extreme=5
        switch ($difficulty) {
            case 1:
                return self::MAX_MORAL;  // Easy
            case 2:
                return self::MAX_MORAL;  // Normal
            case 3:
                return 3;  // Hard
            case 4:
                return 5;  // Extreme
            default:
                return self::MAX_MORAL; // Normal by default
        }
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
            // Chapter days and PAR
            $this->initStat('player', 'chapter_1_days', 0, $player_id);
            $this->initStat('player', 'chapter_2_days', 0, $player_id);
            $this->initStat('player', 'chapter_3_days', 0, $player_id);
            $this->initStat('player', 'chapter_4_days', 0, $player_id);
            $this->initStat('player', 'total_par_difference', 0, $player_id);
            // PAR bonuses (golf scoring: Albatross +30, Eagle +15, Birdie +5)
            $this->initStat('player', 'chapter_1_par_bonus', 0, $player_id);
            $this->initStat('player', 'chapter_2_par_bonus', 0, $player_id);
            $this->initStat('player', 'chapter_3_par_bonus', 0, $player_id);
            $this->initStat('player', 'chapter_4_par_bonus', 0, $player_id);
            $this->initStat('player', 'total_par_bonus', 0, $player_id);
            $this->initStat('player', 'total_days', 0, $player_id);
            // Character preferences
            $this->initStat('player', 'favorite_character_id', 0, $player_id);
            $this->initStat('player', 'favorite_character_picks', 0, $player_id);
            $this->initStat('player', 'most_played_character_id', 0, $player_id);
            $this->initStat('player', 'most_played_character_uses', 0, $player_id);
            $this->initStat('player', 'most_ignored_character_id', 0, $player_id);
            $this->initStat('player', 'most_ignored_character_seen', 0, $player_id);
            $this->initStat('player', 'most_benched_character_id', 0, $player_id);
            $this->initStat('player', 'most_benched_character_picks', 0, $player_id);
            $this->initStat('player', 'unique_characters_picked', 0, $player_id);
            $this->initStat('player', 'unique_powers_used', 0, $player_id);
            $this->initStat('player', 'traceur_id', 0, $player_id);
            $this->initStat('player', 'final_team_size', 0, $player_id);
        }
    }

    //////////////////////////////////////////////////////////////////////////////
    //////////// Global Variables Helper
    //////////////////////////////////////////////////////////////////////////////

    protected function setGlobalVariable(string $name, $value): void
    {
        $name = $this->escapeStringForDB($name);
        if ($value === null) {
            $this->DbQuery("DELETE FROM global_var WHERE var_name = '$name'");
        } else {
            $value = $this->escapeStringForDB($value);
            $this->DbQuery("INSERT INTO global_var (var_name, var_value) VALUES ('$name', '$value') 
                           ON DUPLICATE KEY UPDATE var_value = '$value'");
        }
    }

    protected function getGlobalVariable(string $name)
    {
        $name = $this->escapeStringForDB($name);
        return $this->getUniqueValueFromDB("SELECT var_value FROM global_var WHERE var_name = '$name'");
    }

    /**
     * Calculate PAR bonus points (golf-style scoring)
     * @param int $parDiff Days minus PAR (negative = under par)
     * @return array ['bonus' => points, 'name' => golf term]
     */
    private function calculateParBonus(int $parDiff): array
    {
        if ($parDiff <= -3) {
            return ['bonus' => 30, 'name' => 'Albatross'];
        } elseif ($parDiff == -2) {
            return ['bonus' => 15, 'name' => 'Eagle'];
        } elseif ($parDiff == -1) {
            return ['bonus' => 5, 'name' => 'Birdie'];
        } else {
            // PAR (0) or Bogey (+1 or more) = no bonus, no malus
            return ['bonus' => 0, 'name' => $parDiff == 0 ? 'PAR' : 'Bogey'];
        }
    }

    //////////////////////////////////////////////////////////////////////////////
    //////////// Character Statistics Tracking (Per-Player)
    //////////////////////////////////////////////////////////////////////////////

    /**
     * Get character stats for a player (proposed, selected, power_used counts)
     */
    protected function getPlayerCharacterStats(int $player_id): array
    {
        $json = $this->getGlobalVariable('character_stats_' . $player_id);
        return $json ? json_decode($json, true) : [];
    }

    /**
     * Save character stats for a player
     */
    protected function savePlayerCharacterStats(int $player_id, array $stats): void
    {
        $this->setGlobalVariable('character_stats_' . $player_id, json_encode($stats));
    }

    /**
     * Get global character stats (for table-wide tracking)
     */
    protected function getCharacterStats(): array
    {
        $json = $this->getGlobalVariable('character_stats');
        return $json ? json_decode($json, true) : [];
    }

    /**
     * Save global character stats
     */
    protected function saveCharacterStats(array $stats): void
    {
        $this->setGlobalVariable('character_stats', json_encode($stats));
    }

    /**
     * Increment a character stat (global + per-player)
     * @param int $typeArg The character type_arg (ID)
     * @param string $statType One of: 'proposed', 'selected', 'power_used'
     * @param int|null $player_id Optional player ID for per-player tracking
     */
    protected function incCharacterStat(int $typeArg, string $statType, ?int $player_id = null): void
    {
        // Update global stats
        $stats = $this->getCharacterStats();
        if (!isset($stats[$typeArg])) {
            $stats[$typeArg] = ['proposed' => 0, 'selected' => 0, 'power_used' => 0];
        }
        if (isset($stats[$typeArg][$statType])) {
            $stats[$typeArg][$statType]++;
        }
        $this->saveCharacterStats($stats);

        // Update per-player stats if player_id provided
        if ($player_id !== null) {
            $playerStats = $this->getPlayerCharacterStats($player_id);
            if (!isset($playerStats[$typeArg])) {
                $playerStats[$typeArg] = ['proposed' => 0, 'selected' => 0, 'power_used' => 0];
            }
            if (isset($playerStats[$typeArg][$statType])) {
                $playerStats[$typeArg][$statType]++;
            }
            $this->savePlayerCharacterStats($player_id, $playerStats);
        }
    }

    /**
     * Track multiple characters as proposed (batch) - for all players in current draft
     * @param array $typeArgs Array of character type_args
     * @param array|null $playerIds Array of player IDs (null = all players)
     */
    protected function trackCharactersProposed(array $typeArgs, ?array $playerIds = null): void
    {
        if ($playerIds === null) {
            $playerIds = array_keys($this->loadPlayersBasicInfos());
        }

        // Update global stats
        $stats = $this->getCharacterStats();
        foreach ($typeArgs as $typeArg) {
            $typeArg = (int) $typeArg;
            if (!isset($stats[$typeArg])) {
                $stats[$typeArg] = ['proposed' => 0, 'selected' => 0, 'power_used' => 0];
            }
            $stats[$typeArg]['proposed']++;
        }
        $this->saveCharacterStats($stats);

        // Update per-player stats
        foreach ($playerIds as $player_id) {
            $playerStats = $this->getPlayerCharacterStats($player_id);
            foreach ($typeArgs as $typeArg) {
                $typeArg = (int) $typeArg;
                if (!isset($playerStats[$typeArg])) {
                    $playerStats[$typeArg] = ['proposed' => 0, 'selected' => 0, 'power_used' => 0];
                }
                $playerStats[$typeArg]['proposed']++;
            }
            $this->savePlayerCharacterStats($player_id, $playerStats);
        }
    }

    /**
     * Calculate character preference stats for a player at end of game
     * Returns: favorite (most picked), most_played (power used most), most_ignored (seen but never picked), most_benched (picked but never used)
     */
    protected function calculateCharacterPreferences(int $player_id): array
    {
        $stats = $this->getPlayerCharacterStats($player_id);

        $favorite = ['id' => 0, 'count' => 0];
        $mostPlayed = ['id' => 0, 'count' => 0];
        $mostIgnored = ['id' => 0, 'count' => 0];
        $mostBenched = ['id' => 0, 'count' => 0];
        $uniquePicked = 0;
        $uniquePowerUsed = 0;

        foreach ($stats as $charId => $charStats) {
            $proposed = $charStats['proposed'] ?? 0;
            $selected = $charStats['selected'] ?? 0;
            $powerUsed = $charStats['power_used'] ?? 0;

            // Favorite = most selected
            if ($selected > $favorite['count']) {
                $favorite = ['id' => (int) $charId, 'count' => $selected];
            }

            // Most played = most power used
            if ($powerUsed > $mostPlayed['count']) {
                $mostPlayed = ['id' => (int) $charId, 'count' => $powerUsed];
            }

            // Most ignored = proposed but never selected (highest proposed with selected=0)
            if ($selected == 0 && $proposed > $mostIgnored['count']) {
                $mostIgnored = ['id' => (int) $charId, 'count' => $proposed];
            }

            // Most benched = selected but never used power (highest selected with power_used=0)
            if ($selected > 0 && $powerUsed == 0 && $selected > $mostBenched['count']) {
                $mostBenched = ['id' => (int) $charId, 'count' => $selected];
            }

            // Count unique characters
            if ($selected > 0)
                $uniquePicked++;
            if ($powerUsed > 0)
                $uniquePowerUsed++;
        }

        return [
            'favorite' => $favorite,
            'most_played' => $mostPlayed,
            'most_ignored' => $mostIgnored,
            'most_benched' => $mostBenched,
            'unique_picked' => $uniquePicked,
            'unique_power_used' => $uniquePowerUsed
        ];
    }

    //////////////////////////////////////////////////////////////////////////////
    //////////// getAllDatas
    //////////////////////////////////////////////////////////////////////////////

    protected function getAllDatas()
    {
        $result = [];
        $current_player_id = $this->getCurrentPlayerId();

        // Get chapter from game state
        $chapter = $this->getValidatedChapter();
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
            // Guard missing score in some contexts (e.g., abandonment before score computation)
            if (!isset($player['player_score'])) {
                $player['player_score'] = 0;
            }
            // BGA client often reads `score`; mirror the value
            $player['score'] = (int) $player['player_score'];
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

        $result['myHorde'] = [];
        try {
            $result['myHorde'] = $this->getHordeWithPowerStatus($current_player_id);
        } catch (Exception $e) {
        }

        $result['recruitPool'] = [];

        // Material data - only include available characters
        $result['characters'] = array_filter($this->characters ?? [], function ($char) {
            return !empty($char['is_available']);
        });
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

        // Game state info - two day counters
        $totalDays = $this->getGameStateValue('current_round');
        $chapterDay = $this->getGameStateValue('chapter_round');
        $result['current_round'] = $totalDays ?: 1;
        $result['chapter_round'] = $chapterDay ?: 1;
        $result['chapter_par'] = $this->chapters[$chapter]['par'] ?? 10;

        $result['scores'] = [];
        foreach ($result['players'] as $player_id => $player) {
            $result['scores'][$player_id] = (int) ($player['player_score'] ?? 0);
        }

        // Add character statistics (proposed, selected, power_used counts)
        $result['character_stats'] = $this->getCharacterStats();

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
            (int) $player['player_position_q'],
            (int) $player['player_position_r'],
            $chapter
        );

        if (!$tile) {
            return [];
        }

        return $this->getRecruitableCharacters($tile);
    }

    private function formatTileLocationString(int $q, int $r, int $chapter): string
    {
        return 'tile_' . $q . '_' . $r . '_ch' . $chapter;
    }

    /**
     * Get the location string for a village/city recruit pool
     */
    private function getRecruitLocation(array $tile): string
    {
        $chapter = $this->getGameStateValue('current_chapter');
        return $this->formatTileLocationString($tile['tile_q'], $tile['tile_r'], $chapter);
    }

    /**
     * Get the tile location string for a player's current position
     * Format: tile_Q_R_chC (e.g., tile_2_3_ch1)
     * Used for placing abandoned/discarded cards on the player's current tile
     */
    function getPlayerTileLocation(int $player_id): string
    {
        $chapter = $this->getGameStateValue('current_chapter');
        $player = $this->getObjectFromDB(
            "SELECT player_position_q, player_position_r FROM player WHERE player_id = $player_id"
        );
        return $this->formatTileLocationString($player['player_position_q'], $player['player_position_r'], $chapter);
    }

    /**
     * Get the current tile for power resolution:
     * - If selected_tile is set (during confrontation), use that
     * - Otherwise, use the player's current position
     * @return array|null The tile data or null if not found
     */
    function getCurrentTileForPower(int $player_id): ?array
    {
        $tile_id = $this->getGameStateValue('selected_tile');

        if ($tile_id) {
            $tile = $this->getObjectFromDB("SELECT * FROM tile WHERE tile_id = $tile_id");
            if ($tile) {
                return $tile;
            }
        }

        // Fallback to player's current position
        $chapter = $this->getGameStateValue('current_chapter');
        $player = $this->getObjectFromDB(
            "SELECT player_position_q, player_position_r FROM player WHERE player_id = $player_id"
        );
        if (!$player) {
            return null;
        }

        return $this->getTileAt(
            (int) $player['player_position_q'],
            (int) $player['player_position_r'],
            $chapter
        );
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
            // Check if Lyara's power is active - village treated as city
            $lyara_data = json_decode($this->getGlobalVariable('lyara_village_as_city') ?? '{}', true);
            if (!empty($lyara_data['active']) && (int) $lyara_data['tile_id'] === (int) $tile['tile_id']) {
                // Lyara makes this village act like a city: 2 of each type
                return $this->getOrCreateRecruitPool($tile, 2, 2, 2);
            }
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
     * Shuffle an array using bga_rand (works in BGA Studio unlike MySQL RAND())
     */
    private function bgaShuffle(array $array): array
    {
        $array = array_values($array);
        $count = count($array);
        for ($i = $count - 1; $i > 0; $i--) {
            $j = bga_rand(0, $i);
            $temp = $array[$i];
            $array[$i] = $array[$j];
            $array[$j] = $temp;
        }
        return $array;
    }

    /**
     * Draw cards for recruitment based on specified counts
     * Uses bga_rand for shuffling instead of MySQL RAND() (which can be deterministic in BGA Studio)
     * 
     * @param int $ferCount Number of Fer (red) cards
     * @param int $packCount Number of Pack (blue) cards
     * @param int $traineCount Number of Traîne (green) cards
     * @return array The drawn cards
     */
    private function drawRecruitCards(int $ferCount, int $packCount, int $traineCount): array
    {
        $cards = [];

        // Only draw from deck (not discard, not already in recruit pools, not in hordes)
        if ($ferCount > 0) {
            $fer = $this->getCollectionFromDb(
                "SELECT * FROM card WHERE card_type = 'fer' AND card_is_leader = 0 AND card_location = 'deck'"
            );
            $fer = $this->bgaShuffle($fer);
            $cards = array_merge($cards, array_slice($fer, 0, $ferCount));
        }

        if ($packCount > 0) {
            $pack = $this->getCollectionFromDb(
                "SELECT * FROM card WHERE card_type = 'pack' AND card_location = 'deck'"
            );
            $pack = $this->bgaShuffle($pack);
            $cards = array_merge($cards, array_slice($pack, 0, $packCount));
        }

        if ($traineCount > 0) {
            $traine = $this->getCollectionFromDb(
                "SELECT * FROM card WHERE card_type = 'traine' AND card_location = 'deck'"
            );
            $traine = $this->bgaShuffle($traine);
            $cards = array_merge($cards, array_slice($traine, 0, $traineCount));
        }

        return $cards;
    }

    /**
     * Add a card to a tile's location (when released/abandoned on that tile)
     * All cards go to tile-based locations: tile_Q_R_chC
     * Village/city tiles also use 'location_' prefix for recruit pool compatibility
     */
    function addCardToRecruitPool(int $card_id, array $tile): void
    {
        $chapter = $this->getGameStateValue('current_chapter');

        if ($tile['tile_type'] == 'village' || $tile['tile_type'] == 'city') {
            // Village/city: use location_ prefix (for recruit pool queries)
            $location = $this->getRecruitLocation($tile);
        } else {
            // Other tiles: use tile_ prefix
            $location = 'tile_' . $tile['tile_q'] . '_' . $tile['tile_r'] . '_ch' . $chapter;
        }

        $this->DbQuery("UPDATE card SET card_location = '$location' WHERE card_id = $card_id");
    }

    /**
     * Clear recruit pool flags for a chapter
     * Called at chapter end - cards stay on their tiles (become inaccessible)
     * No more 'discard' pile - cards just remain on old chapter tiles
     */
    function clearRecruitPoolsForChapter(int $chapter): void
    {
        // Cards stay on their tiles (location_X_Y_chC or tile_X_Y_chC)
        // They become inaccessible when chapter changes - no need to move them

        // Clear pool initialization flags for this chapter (cleanup)
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

        // Check if current player has completed their horde
        $horde = $this->cards->getCardsInLocation('horde_' . $player_id);
        if (count($horde) < 8) {
            // Current player hasn't finished yet, stay in draft
            $this->gamestate->nextState('nextPlayer');
            return;
        }

        // Current player finished - check if ALL players have completed their hordes
        $players = $this->loadPlayersBasicInfos();
        $allDrafted = true;
        foreach ($players as $pid => $player) {
            $playerHorde = $this->cards->getCardsInLocation('horde_' . $pid);
            if (count($playerHorde) < 8) {
                $allDrafted = false;
                break;
            }
        }

        if ($allDrafted) {
            // All players have completed their hordes
            $this->gamestate->nextState('allDrafted');
        } else {
            // Move to next player who hasn't finished
            $this->activeNextPlayer();
            $this->gamestate->nextState('nextPlayer');
        }
    }

    function stRest(): void
    {
        // Reset rest_next_state to prevent stale values from affecting routing
        $this->setGameStateValue('rest_next_state', 0);

        // Reset movement counters for the active player (after failure or manual rest)
        $player_id = $this->getActivePlayerId();
        $this->DbQuery("UPDATE player SET player_has_moved = 0, player_surpass_count = 0 WHERE player_id = $player_id");

        // Increment rest count stat (counts as a rest whether voluntary or after failure)
        $this->incStat(1, 'rest_count', $player_id);
        $rest_count = (int) $this->getStat('rest_count', $player_id);

        // Get player data for notification
        $player = $this->getObjectFromDB("SELECT * FROM player WHERE player_id = $player_id");

        // Notify UI to update rest counter
        $this->notifyAllPlayers('playerRests', clienttranslate('${player_name} rests and resets surpass counter'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'dice_count' => (int) $player['player_dice_count'],
            'surpass_count' => 0,
            'rest_count' => $rest_count
        ]);

        // Increment day counters when a player rests
        $totalDays = $this->getGameStateValue('current_round');
        $totalDays++;
        $this->setGameStateValue('current_round', $totalDays);

        $chapterDay = $this->getGameStateValue('chapter_round');
        $chapterDay++;
        $this->setGameStateValue('chapter_round', $chapterDay);

        $this->notifyAllPlayers('newDay', clienttranslate('Day ${chapter_day} of chapter (${total_days} total)'), [
            'chapter_day' => $chapterDay,
            'total_days' => $totalDays
        ]);

        // Get current tile to check if in city
        $player = $this->getObjectFromDB("SELECT * FROM player WHERE player_id = $player_id");
        $tile = $this->getTileAt((int) $player['player_position_q'], (int) $player['player_position_r'], (int) $player['player_chapter']);

        // In cities or villages: rest ALL Hordiers (reactivate all powers)
        if ($tile && ($tile['tile_type'] == 'city' || $tile['tile_type'] == 'village')) {
            $location_type = $tile['tile_type'] == 'city' ? 'city' : 'village';
            $rested_count = $this->restAllHordiers($player_id);
            if ($rested_count > 0) {
                $this->notifyAllPlayers('allHordiersRested', clienttranslate('${player_name} rests in the ${location_type} - all Hordiers recover their powers'), [
                    'player_id' => $player_id,
                    'player_name' => $this->getActivePlayerName(),
                    'rested_count' => $rested_count,
                    'location_type' => $location_type
                ]);
            }

            // Lyara bonus: +1 moral when rest-all on a village with Lyara in horde
            if ($tile['tile_type'] == 'village' && $this->hasLyaraActive($player_id)) {
                $new_moral = $this->modifyPlayerMoral($player_id, 1);
                $this->notifyAllPlayers('moralChanged', clienttranslate('${player_name} gains +1 moral from Lyara\'s inspiration!'), [
                    'player_id' => $player_id,
                    'player_name' => $this->getActivePlayerName(),
                    'amount' => 1,
                    'new_moral' => $new_moral,
                    'terrain_name' => 'Lyara'
                ]);
            }

            $this->gamestate->nextState('restComplete');
        } else {
            // On regular tiles: check how many hordiers can be rested
            $exhausted = $this->getRestableExhaustedHordiers($player_id);

            if (count($exhausted) <= 1) {
                // 0 or 1 exhausted hordier: rest automatically
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

                $this->gamestate->nextState('restComplete');
            } else {
                // Multiple exhausted hordiers: let player choose
                $this->gamestate->nextState('chooseHordier');
            }
        }
    }

    function stApplyTileEffect(): void
    {
        // Reset rest_next_state to prevent stale values from affecting routing
        $this->setGameStateValue('rest_next_state', 0);

        $player_id = $this->getActivePlayerId();
        $tile_id = $this->getGameStateValue('selected_tile');
        $tile = $this->getTileById($tile_id);

        // Update player position to this tile
        // This is needed for tiles without wind (villages/cities) where
        // handleConfrontationSuccess is not called
        $this->DbQuery("UPDATE player SET player_position_q = {$tile['tile_q']}, player_position_r = {$tile['tile_r']} WHERE player_id = $player_id");

        // Notify clients to refresh player position
        $this->notifyAllPlayers('playerMoves', clienttranslate('${player_name} moves to ${terrain_name}'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'q' => (int) $tile['tile_q'],
            'r' => (int) $tile['tile_r'],
            'terrain_name' => $tile['tile_subtype']
        ]);

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
        $moral_effect = (int) $tile['tile_moral_effect'];

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

            // Check if player has no more moral - game over!
            if ($new_moral <= 0) {
                $this->notifyAllPlayers('playerEliminated', clienttranslate('${player_name} has depleted all moral and is eliminated!'), [
                    'player_id' => $player_id,
                    'player_name' => $this->getActivePlayerName()
                ]);

                $this->setGameStateValue('player_to_eliminate', $player_id);
                $this->gamestate->nextState('eliminate');
                return;
            }
        }

        // Cities and villages: rest 1 Hordier when passing through
        if ($tile['tile_type'] == 'village' || $tile['tile_type'] == 'city') {
            // Check how many hordiers can be rested
            $exhausted = $this->getRestableExhaustedHordiers($player_id);

            if (count($exhausted) <= 1) {
                // 0 or 1 exhausted hordier: rest automatically
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
            } else {
                // Multiple exhausted hordiers: let player choose, then go to recruit
                $this->setGameStateValue('rest_next_state', 1); // 1 = go to recruit after

                // Check if player reached chapter destination first
                if ($this->isChapterDestination($tile)) {
                    $this->gamestate->nextState('endChapter');
                    return;
                }

                $this->gamestate->nextState('chooseHordier');
                return;
            }
        }

        // Score is now updated incrementally in WW_Confrontation

        // Check if player reached chapter destination
        if ($this->isChapterDestination($tile)) {
            $this->gamestate->nextState('endChapter');
            return;
        }

        // Check for recruitment
        if ($tile['tile_type'] == 'village' || $tile['tile_type'] == 'city') {
            $this->gamestate->nextState('recruit');
            return;
        }

        // Special tiles (Tour Fontaine, Porte d'Hurle, etc.) and normal tiles
        // - no specific action needed, just continue to next player
        $this->gamestate->nextState('continue');
    }

    function stNextPlayer(): void
    {
        $player_id = $this->getActivePlayerId();
        $this->incStat(1, 'turns_number', $player_id);
        $this->incStat(1, 'turns_number');

        // Reset turn-based power effects
        $this->setGlobalVariable('lihn_double_points', null);
        $this->setGlobalVariable('protected_cards', null);

        $this->activeNextPlayer();
        $this->gamestate->nextState('nextTurn');
    }

    function stEndRound(): void
    {
        // End of round - kept for compatibility
        // Days are now incremented in stRest() when players rest
        $this->gamestate->nextState('newRound');
    }

    function stEndChapter(): void
    {
        $chapter = $this->getGameStateValue('current_chapter');
        $this->incStat(1, 'chapters_completed');

        // Get chapter days and PAR
        $chapterDays = $this->getGameStateValue('chapter_round');
        $chapterPar = $this->chapters[$chapter]['par'] ?? 10;
        $parDiff = $chapterDays - $chapterPar;

        // Clear all recruit pools (villages and cities) for this chapter - cards go back to deck
        $this->clearRecruitPoolsForChapter($chapter);

        // Calculate PAR bonus (golf scoring)
        $parResult = $this->calculateParBonus($parDiff);
        $parBonus = $parResult['bonus'];
        $parName = $parResult['name'];

        // Calculate and display final scores for this chapter
        $players = $this->loadPlayersBasicInfos();
        foreach ($players as $player_id => $player) {
            // Track chapter days and par difference
            $this->setStat($chapterDays, 'chapter_' . $chapter . '_days', $player_id);
            $this->incStat($parDiff, 'total_par_difference', $player_id);

            // Track PAR bonus for this chapter
            $this->setStat($parBonus, 'chapter_' . $chapter . '_par_bonus', $player_id);
            $this->incStat($parBonus, 'total_par_bonus', $player_id);

            // Award moral for completing chapter
            $this->modifyPlayerMoral($player_id, 1);

            // Update score with chapter-end bonuses (moral + hordiers)
            $this->updateChapterEndScore($player_id);
        }

        // Notify chapter completion with PAR info and golf term
        $parText = $parDiff == 0 ? 'PAR' : ($parDiff < 0 ? $parDiff : '+' . $parDiff);
        $bonusText = $parBonus > 0 ? " - ${parName}! +${parBonus} pts" : '';
        $this->notifyAllPlayers('chapterComplete', clienttranslate('Chapter ${chapter_num} complete! ${days} days (PAR ${par}, ${par_text})${bonus_text}'), [
            'chapter_num' => $chapter,
            'days' => $chapterDays,
            'par' => $chapterPar,
            'par_text' => $parText,
            'par_diff' => $parDiff,
            'par_bonus' => $parBonus,
            'par_name' => $parName,
            'bonus_text' => $bonusText
        ]);

        if ($chapter >= self::LAST_CHAPTER) {
            // Game over - route to final scoring state before framework gameEnd (99)
            $this->gamestate->nextState('finalScoring');
            return;
        }

        $this->gamestate->nextState('nextChapter');
    }

    /**
     * Final scoring state executed before the framework's final gameEnd state (99).
     * Needed because Table::stGameEnd is final, so we compute here and then transition to 99.
     */
    function stFinalScoring(): void
    {
        // Ensure final scores are computed and persisted (avoid null/0 on abandon)
        $this->calculateFinalScores();

        // Record final team stats
        $players = $this->loadPlayersBasicInfos();
        foreach ($players as $player_id => $player) {
            // Get player's horde
            $horde = $this->getObjectListFromDB("SELECT * FROM card WHERE card_location = 'horde_$player_id'");

            $traceur_id = 0;
            $team_size = 0;

            foreach ($horde as $card) {
                $type_arg = (int) $card['card_type_arg'];
                $team_size++;

                // Check if this is the traceur (leader)
                if (!empty($card['card_is_leader'])) {
                    $traceur_id = $type_arg;
                }
            }

            // Set stats (BGA only supports numeric stats)
            $this->setStat($traceur_id, 'traceur_id', $player_id);
            $this->setStat($team_size, 'final_team_size', $player_id);
        }

        // Force eliminated players (if any) to score 0
        foreach ($players as $player_id => $player) {
            if (isset($player['player_eliminated']) && $player['player_eliminated']) {
                $this->DbQuery("UPDATE player SET player_score = 0 WHERE player_id = $player_id");
            }
        }

        // Move to the framework-managed gameEnd state
        $this->gamestate->nextState('gameEnd');
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

        // Reset chapter day counter for new chapter
        $this->setGameStateValue('chapter_round', 1);

        // Setup the chapter draft pool with 6 new characters (2 fer, 2 pack, 2 traine)
        // This must be called here to ensure a fresh pool, not in argChapterDraft
        $this->setupChapterDraftPool();

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
            'chapter_par' => $this->chapters[$chapter]['par'] ?? 10,
            'tiles' => $tiles,
            'players' => $players
        ]);

        // Store first player for chapter draft rotation tracking
        $this->activeNextPlayer();
        $first_player = $this->getActivePlayerId();
        $this->setGameStateValue('first_player', $first_player);

        // Go to chapter draft phase
        $this->gamestate->nextState('chapterDraft');
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

    private function calculateInGameScore(int $player_id): int
    {
        $tiles = $this->getStat('tiles_traversed', $player_id);
        $surpass = $this->getStat('surpass_points', $player_id) ?? 0;
        $furevents = $this->getStat('furevents_defeated', $player_id);
        return $tiles + $surpass + ($furevents * self::FUREVENT_SCORE_MULTIPLIER);
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
            'furevents_points' => $furevents * self::FUREVENT_SCORE_MULTIPLIER
        ];
    }

    /**
     * Notify chapter end bonus (for display only - final score is calculated from stats)
     */
    function updateChapterEndScore(int $player_id): void
    {
        // Get current chapter and moral
        $chapter = $this->getGameStateValue('current_chapter');
        $moral = $this->getPlayerMoral($player_id);
        $hordiers = count($this->cards->getCardsInLocation('horde_' . $player_id));

        // Track moral bonus for this chapter (only moral counts at chapter end, not hordiers)
        $stat_name = 'chapter_' . $chapter . '_moral_bonus';
        $this->setStat($moral, $stat_name, $player_id);

        // Notify all players of chapter end score (informational)
        $this->notifyAllPlayers('chapterEndScore', clienttranslate('${player_name} earns ${moral} bonus points from moral at end of chapter ${chapter}'), [
            'player_id' => $player_id,
            'player_name' => $this->getPlayerNameById($player_id),
            'chapter' => $chapter,
            'moral' => $moral,
            'hordiers' => $hordiers
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

            // Calculate final score from stats (authoritative source)
            $tiles = $this->getStat('tiles_traversed', $player_id) ?? 0;
            $surpass = $this->getStat('surpass_points', $player_id) ?? 0;
            $furevents = $this->getStat('furevents_defeated', $player_id) ?? 0;
            $lihn_bonus = $this->getStat('lihn_bonus_points', $player_id) ?? 0;
            $portedhurle_bonus = $this->getStat('portedhurle_bonus', $player_id) ?? 0;

            // Sum moral bonuses from all chapters
            $chapter_moral_bonus = 0;
            for ($i = 1; $i <= self::LAST_CHAPTER; $i++) {
                $chapter_moral_bonus += $this->getStat('chapter_' . $i . '_moral_bonus', $player_id) ?? 0;
            }

            // Hordiers count only at end of campaign (reaching Camp Boban)
            $hordiers = count($this->cards->getCardsInLocation('horde_' . $player_id));

            // Get PAR bonus (golf scoring: Albatross +30, Eagle +15, Birdie +5)
            $total_par_bonus = $this->getStat('total_par_bonus', $player_id) ?? 0;

            // Get PAR stats for display
            $total_par_diff = $this->getStat('total_par_difference', $player_id) ?? 0;
            $total_days = 0;
            $total_par = 0;
            for ($i = 1; $i <= self::LAST_CHAPTER; $i++) {
                $total_days += $this->getStat('chapter_' . $i . '_days', $player_id) ?? 0;
                $total_par += $this->chapters[$i]['par'] ?? 10;
            }

            // Final score = tiles + surpass + furevents×3 + lihn_bonus + portedhurle + chapter_moral_bonuses + hordiers×2 + PAR_bonus
            $score = $tiles + $surpass + ($furevents * self::FUREVENT_SCORE_MULTIPLIER) + $lihn_bonus + $portedhurle_bonus + $chapter_moral_bonus + ($hordiers * 2) + $total_par_bonus;

            $this->DbQuery("UPDATE player SET player_score = $score WHERE player_id = $player_id");
            $this->setStat($score, 'total_score', $player_id);
            $this->setStat($total_days, 'total_days', $player_id);

            // Calculate and save character preferences
            $prefs = $this->calculateCharacterPreferences($player_id);
            $this->setStat($prefs['favorite']['id'], 'favorite_character_id', $player_id);
            $this->setStat($prefs['favorite']['count'], 'favorite_character_picks', $player_id);
            $this->setStat($prefs['most_played']['id'], 'most_played_character_id', $player_id);
            $this->setStat($prefs['most_played']['count'], 'most_played_character_uses', $player_id);
            $this->setStat($prefs['most_ignored']['id'], 'most_ignored_character_id', $player_id);
            $this->setStat($prefs['most_ignored']['count'], 'most_ignored_character_seen', $player_id);
            $this->setStat($prefs['most_benched']['id'], 'most_benched_character_id', $player_id);
            $this->setStat($prefs['most_benched']['count'], 'most_benched_character_picks', $player_id);
            $this->setStat($prefs['unique_picked'], 'unique_characters_picked', $player_id);
            $this->setStat($prefs['unique_power_used'], 'unique_powers_used', $player_id);

            // Format PAR text
            $parText = $total_par_diff == 0 ? 'PAR' : ($total_par_diff < 0 ? $total_par_diff : '+' . $total_par_diff);

            // Notify final score with breakdown
            $this->notifyAllPlayers('finalScore', clienttranslate('${player_name} scores ${score} points (${total_days} days, ${par_text})'), [
                'player_id' => $player_id,
                'player_name' => $player['player_name'],
                'score' => $score,
                'total_days' => $total_days,
                'total_par' => $total_par,
                'par_text' => $parText,
                'par_diff' => $total_par_diff,
                'par_bonus' => $total_par_bonus,
                'breakdown' => [
                    'tiles' => $tiles,
                    'surpass' => $surpass,
                    'furevents' => $furevents,
                    'furevents_points' => $furevents * self::FUREVENT_SCORE_MULTIPLIER,
                    'lihn_bonus' => $lihn_bonus,
                    'portedhurle_bonus' => $portedhurle_bonus,
                    'chapter_moral_bonus' => $chapter_moral_bonus,
                    'hordiers' => $hordiers,
                    'hordiers_points' => $hordiers * 2,
                    'par_bonus' => $total_par_bonus
                ]
            ]);
        }
    }

    /**
     * Calculate player FINAL score according to rules:
     * Uses the accumulated player_score (tiles, surpass, furevents, Lihn bonuses)
     * and adds end-game bonuses (moral, hordiers)
     */
    private function calculatePlayerScore(int $player_id): int
    {
        // Get the accumulated score from gameplay (includes tiles, surpass, furevents, Lihn doubles)
        $score = (int) $this->getUniqueValueFromDB("SELECT COALESCE(player_score, 0) FROM player WHERE player_id = $player_id");

        // Add end-game bonuses only:

        // Moral remaining (1 point each)
        $moral = $this->getPlayerMoral($player_id);
        $score += $moral;

        // Hordiers remaining (2 points each)
        $hordiers = count($this->cards->getCardsInLocation('horde_' . $player_id));
        $score += $hordiers * 2;

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

        // Get accumulated gameplay score (before end-game bonuses)
        $gameplay_score = (int) $this->getUniqueValueFromDB("SELECT COALESCE(player_score, 0) FROM player WHERE player_id = $player_id");

        return [
            'gameplay_score' => $gameplay_score,  // Base score from all chapters
            'tiles' => $tiles,
            'surpass' => $surpass,
            'moral' => $moral,
            'hordiers' => $hordiers,
            'hordiers_points' => $hordiers * 2,
            'furevents' => $furevents,
            'furevents_points' => $furevents * self::FUREVENT_SCORE_MULTIPLIER
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
