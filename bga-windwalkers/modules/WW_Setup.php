<?php
/**
 * WW_Setup - Game initialization and setup
 */

trait WW_Setup
{
    //////////////////////////////////////////////////////////////////////////////
    // Character Cards Setup
    //////////////////////////////////////////////////////////////////////////////
    
    /**
     * Create all character cards in deck
     */
    function setupCharacterCards(): void
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

    //////////////////////////////////////////////////////////////////////////////
    // Wind Tokens Setup
    //////////////////////////////////////////////////////////////////////////////
    
    /**
     * Create wind tokens according to distribution
     */
    function setupWindTokens(): void
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

    //////////////////////////////////////////////////////////////////////////////
    // Chapter Tiles Setup
    //////////////////////////////////////////////////////////////////////////////
    
    /**
     * Setup tiles for a specific chapter
     */
    function setupChapterTiles(int $chapter): void
    {
        if ($chapter < 1 || $chapter > 4) {
            throw new BgaVisibleSystemException("setupChapterTiles called with invalid chapter: $chapter");
        }
        
        $this->debug("=== setupChapterTiles for chapter $chapter ===");
        
        $tiles = $this->getChapterTilesData($chapter);
        
        $this->debug("Creating " . count($tiles) . " tiles");
        $this->createTilesFromData($tiles, $chapter);
        
        $count = $this->getUniqueValueFromDB("SELECT COUNT(*) FROM tile WHERE tile_chapter = $chapter");
        $this->debug("Total tiles in DB for chapter $chapter: $count");
    }

    /**
     * Get tile data for a chapter from JSON file
     */
    function getChapterTilesData(int $chapter): array
    {
        $jsonPath = __DIR__ . "/chapters/chapter{$chapter}.json";
        
        // Check if file exists
        if (!file_exists($jsonPath)) {
            throw new BgaVisibleSystemException(
                "Chapter $chapter JSON file not found at: $jsonPath"
            );
        }
        
        // Read file contents
        $jsonContent = file_get_contents($jsonPath);
        if ($jsonContent === false) {
            throw new BgaVisibleSystemException(
                "Failed to read chapter $chapter JSON file at: $jsonPath"
            );
        }
        
        // Parse JSON
        $data = json_decode($jsonContent, true);
        if ($data === null) {
            throw new BgaVisibleSystemException(
                "Invalid JSON in chapter $chapter file: " . json_last_error_msg()
            );
        }
        
        // Validate structure
        if (!isset($data['grid']) || !is_array($data['grid'])) {
            throw new BgaVisibleSystemException(
                "Chapter $chapter JSON missing 'grid' array"
            );
        }
        
        // Convert JSON format to internal format
        $tiles = [];
        foreach ($data['grid'] as $index => $tile) {
            if (!isset($tile['q']) || !isset($tile['r']) || !isset($tile['name'])) {
                throw new BgaVisibleSystemException(
                    "Chapter $chapter tile #$index missing q, r, or name"
                );
            }
            $tiles[] = [
                'q' => (int)$tile['q'],
                'r' => (int)$tile['r'],
                'subtype' => $tile['name']
            ];
        }
        
        $this->debug("Loaded " . count($tiles) . " tiles from $jsonPath");
        return $tiles;
    }

    /**
     * Create tiles from chapter data array
     */
    function createTilesFromData(array $tiles, int $chapter): void
    {
        $values = [];
        foreach ($tiles as $tile) {
            $subtype = $tile['subtype'];
            $type = $this->determineTileType($subtype);
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
            $sql = "INSERT IGNORE INTO tile (tile_q, tile_r, tile_type, tile_subtype, tile_chapter, 
                tile_white_dice, tile_green_dice, tile_black_dice, tile_moral_effect) 
                VALUES " . implode(',', $values);
            $this->DbQuery($sql);
        }
    }

    /**
     * Determine tile type from subtype
     */
    function determineTileType(string $subtype): string
    {
        if (isset($this->cities[$subtype])) {
            return 'city';
        }
        if (isset($this->village_types[$subtype])) {
            return 'village';
        }
        if (in_array($subtype, ['tourfontaine', 'portedhurle'])) {
            return 'special';
        }
        return 'terrain';
    }

    //////////////////////////////////////////////////////////////////////////////
    // Starting Position
    //////////////////////////////////////////////////////////////////////////////
    
    /**
     * Find starting city position for the given chapter
     */
    function getStartingCityPosition(int $chapter): ?array
    {
        // Determine start city subtype for chapter
        $startSubtype = null;
        foreach ($this->cities as $subtype => $city) {
            if (($city['chapter'] ?? null) == $chapter && !empty($city['is_start'])) {
                $startSubtype = $subtype;
                break;
            }
        }
        
        if ($startSubtype === null) {
            return null;
        }

        $tile = $this->getObjectFromDB(
            "SELECT tile_q q, tile_r r FROM tile WHERE tile_subtype = '" . addslashes($startSubtype) . "' AND tile_chapter = $chapter LIMIT 1"
        );
        
        if (!$tile) {
            return null;
        }
        
        return ['q' => (int)$tile['q'], 'r' => (int)$tile['r']];
    }

    /**
     * Initialize player positions to starting city
     */
    function initializePlayerPositions(array $player_ids, int $chapter): void
    {
        $startPos = $this->getStartingCityPosition($chapter);
        if (!$startPos) {
            return;
        }
        
        foreach ($player_ids as $player_id) {
            $this->DbQuery(
                "UPDATE player SET player_position_q = {$startPos['q']}, player_position_r = {$startPos['r']}, player_chapter = $chapter WHERE player_id = $player_id"
            );
        }
    }

    //////////////////////////////////////////////////////////////////////////////
    // Chapter Management
    //////////////////////////////////////////////////////////////////////////////
    
    /**
     * Ensure tiles exist for the given chapter
     */
    function ensureChapterSetup(int $chapter): void
    {
        $tile_count = (int)$this->getUniqueValueFromDB("SELECT COUNT(*) FROM tile WHERE tile_chapter = $chapter");
        if ($tile_count == 0) {
            $this->setupChapterTiles($chapter);
        }
    }

    /**
     * Setup next chapter (for chapter transitions)
     */
    function transitionToNextChapter(): void
    {
        $chapter = $this->getGameStateValue('current_chapter') + 1;
        $this->setGameStateValue('current_chapter', $chapter);
        
        $this->setupChapterTiles($chapter);
        
        // Reset wind tokens
        $this->DbQuery("UPDATE wind_token SET token_location = 'bag', token_tile_id = NULL");
    }
}
