<?php
/**
 * WW_Movement - Movement and tile selection logic
 */

trait WW_Movement
{
    //////////////////////////////////////////////////////////////////////////////
    // Movement Actions
    //////////////////////////////////////////////////////////////////////////////
    
    /**
     * Select a tile to move to
     */
    function actSelectTile(int $tile_id): void
    {
        $this->checkAction('actSelectTile');
        $player_id = $this->getActivePlayerId();
        
        $this->validateTileAdjacent($player_id, $tile_id);
        
        $this->setGameStateValue('selected_tile', $tile_id);
        $this->DbQuery("UPDATE player SET player_has_moved = player_has_moved + 1 WHERE player_id = $player_id");
        
        $this->gamestate->nextState('moveToTile');
    }

    /**
     * Surpass (extra movement at cost of 1 die) and select tile
     */
    function actSurpassAndSelectTile(int $tile_id): void
    {
        $this->checkAction('actSurpassAndSelectTile');
        $player_id = $this->getActivePlayerId();
        
        // Must have moved first
        $has_moved = $this->getUniqueValueFromDB("SELECT player_has_moved FROM player WHERE player_id = $player_id");
        if ($has_moved == 0) {
            throw new BgaUserException($this->_("You must move first before surpassing"));
        }
        
        $this->validateTileAdjacent($player_id, $tile_id);
        
        $this->setGameStateValue('selected_tile', $tile_id);
        
        // Increment both counters
        $this->DbQuery("UPDATE player SET player_has_moved = player_has_moved + 1, player_surpass_count = player_surpass_count + 1 WHERE player_id = $player_id");
        $this->incStat(1, 'surpass_count', $player_id);
        
        $this->notify->all('playerSurpasses', clienttranslate('${player_name} surpasses! (-1 die)'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName()
        ]);
        
        $this->gamestate->nextState('moveToTile');
    }

    /**
     * Rest action (reset movement counters)
     */
    function actRest(): void
    {
        $this->checkAction('actRest');
        $player_id = $this->getActivePlayerId();
        
        $this->DbQuery("UPDATE player SET player_has_moved = 0, player_surpass_count = 0 WHERE player_id = $player_id");
        
        $this->notify->all('playerRests', clienttranslate('${player_name} rests and resets surpass counter'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName()
        ]);
        
        $this->incStat(1, 'rest_count', $player_id);
        $this->gamestate->nextState('rest');
    }

    /**
     * End turn without resting (keep surpass counters)
     */
    function actEndTurn(): void
    {
        $this->checkAction('actEndTurn');
        $player_id = $this->getActivePlayerId();
        
        $this->gamestate->nextState('nextTurn');
    }

    //////////////////////////////////////////////////////////////////////////////
    // Tile Validation
    //////////////////////////////////////////////////////////////////////////////
    
    /**
     * Validate tile is adjacent to player
     */
    private function validateTileAdjacent(int $player_id, int $tile_id): void
    {
        $player = $this->getObjectFromDB("SELECT * FROM player WHERE player_id = $player_id");
        $chapter = (int)($player['player_chapter'] ?? 0);
        
        if ($chapter < 1) {
            throw new BgaVisibleSystemException("Invalid chapter value ($chapter) for player $player_id - database may be corrupted");
        }
        
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
    }

    //////////////////////////////////////////////////////////////////////////////
    // Movement State Arguments
    //////////////////////////////////////////////////////////////////////////////
    
    /**
     * Get player turn state arguments
     */
    function argPlayerTurn(): array
    {
        $player_id = $this->getActivePlayerId();
        $player = $this->getObjectFromDB("SELECT * FROM player WHERE player_id = $player_id");
        
        $chapter = (int)($player['player_chapter'] ?? 0);
        if ($chapter < 1) {
            throw new BgaVisibleSystemException("Invalid chapter value ($chapter) for player $player_id - database may be corrupted");
        }
        
        // Ensure tiles exist
        $tile_count = (int)$this->getUniqueValueFromDB("SELECT COUNT(*) FROM tile WHERE tile_chapter = $chapter");
        if ($tile_count == 0) {
            $this->setupChapterTiles($chapter);
            $tile_count = (int)$this->getUniqueValueFromDB("SELECT COUNT(*) FROM tile WHERE tile_chapter = $chapter");
        }
        
        $q = (int)$player['player_position_q'];
        $r = (int)$player['player_position_r'];
        $adjacent = $this->getAdjacentTiles($q, $r, $chapter);
        
        $all_tiles = $this->getCollectionFromDb("SELECT tile_id, tile_q, tile_r, tile_subtype FROM tile WHERE tile_chapter = $chapter LIMIT 10");
        
        return [
            'position' => ['q' => $q, 'r' => $r],
            'adjacent' => $adjacent,
            'moral' => $player['player_moral'],
            'has_moved' => $player['player_has_moved'],
            'can_surpass' => $player['player_has_moved'] > 0,
            '_debug_chapter' => $chapter,
            '_debug_tile_count' => $tile_count,
            '_debug_player_pos' => "q=$q, r=$r",
            '_debug_adjacent_count' => count($adjacent),
            '_debug_sample_tiles' => $all_tiles
        ];
    }

    /**
     * Move player to a tile (called after confrontation success)
     */
    function movePlayerToTile(int $player_id, int $tile_id): void
    {
        $tile = $this->getObjectFromDB("SELECT * FROM tile WHERE tile_id = $tile_id");
        if (!$tile) {
            throw new BgaVisibleSystemException("Tile $tile_id not found");
        }
        
        $this->DbQuery("UPDATE player SET player_position_q = {$tile['tile_q']}, player_position_r = {$tile['tile_r']} WHERE player_id = $player_id");
    }
}


