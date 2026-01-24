<?php
/**
 * WW_PlayerHelper - Player data access helpers
 */

trait WW_PlayerHelper
{
    //////////////////////////////////////////////////////////////////////////////
    // Player Data Access
    //////////////////////////////////////////////////////////////////////////////
    
    /**
     * Get full player data from database
     */
    function getPlayerData(int $player_id): array
    {
        $player = $this->getObjectFromDB("SELECT * FROM player WHERE player_id = $player_id");
        if (!$player) {
            throw new BgaVisibleSystemException("Player $player_id not found");
        }
        return $player;
    }
    
    /**
     * Get player position as array [q, r]
     */
    function getPlayerPosition(int $player_id): array
    {
        $player = $this->getPlayerData($player_id);
        return [
            'q' => (int)$player['player_position_q'],
            'r' => (int)$player['player_position_r']
        ];
    }
    
    /**
     * Update player position
     */
    function setPlayerPosition(int $player_id, int $q, int $r): void
    {
        $this->DbQuery(
            "UPDATE player SET player_position_q = $q, player_position_r = $r WHERE player_id = $player_id"
        );
    }
    
    /**
     * Get player moral
     */
    function getPlayerMoral(int $player_id): int
    {
        return (int)$this->getUniqueValueFromDB(
            "SELECT player_moral FROM player WHERE player_id = $player_id"
        );
    }
    
    /**
     * Modify player moral (clamped to 0-9)
     * If Lihn's power is active and delta is positive, double the gain
     */
    function modifyPlayerMoral(int $player_id, int $delta): int
    {
        // Check if Lihn's double points is active (only for positive gains)
        if ($delta > 0) {
            $lihn_active = (int)($this->getGlobalVariable('lihn_double_points') ?? 0);
            if ($lihn_active) {
                $delta *= 2;
            }
        }
        
        $this->DbQuery(
            "UPDATE player SET player_moral = GREATEST(0, LEAST(9, player_moral + $delta)) WHERE player_id = $player_id"
        );
        return $this->getPlayerMoral($player_id);
    }
    
    /**
     * Get player movement state
     */
    function getPlayerMovementState(int $player_id): array
    {
        $player = $this->getPlayerData($player_id);
        return [
            'has_moved' => (int)$player['player_has_moved'],
            'surpass_count' => (int)$player['player_surpass_count'],
            'dice_count' => (int)$player['player_dice_count']
        ];
    }
    
    /**
     * Increment player movement counter
     */
    function incrementMovement(int $player_id): void
    {
        $this->DbQuery(
            "UPDATE player SET player_has_moved = player_has_moved + 1 WHERE player_id = $player_id"
        );
    }
    
    /**
     * Increment both movement and surpass counters
     */
    function incrementMovementAndSurpass(int $player_id): void
    {
        $this->DbQuery(
            "UPDATE player SET player_has_moved = player_has_moved + 1, 
             player_surpass_count = player_surpass_count + 1 WHERE player_id = $player_id"
        );
    }
    
    /**
     * Reset movement and surpass counters (for rest)
     */
    function resetMovementCounters(int $player_id): void
    {
        $this->DbQuery(
            "UPDATE player SET player_has_moved = 0, player_surpass_count = 0 WHERE player_id = $player_id"
        );
    }

    //////////////////////////////////////////////////////////////////////////////
    // Player Extended Info (for getAllDatas)
    //////////////////////////////////////////////////////////////////////////////
    
    /**
     * Enrich player info with game-specific data
     */
    function enrichPlayerInfo(array $player_id_list): array
    {
        $enriched = [];
        foreach ($player_id_list as $player_id) {
            $p = $this->getObjectFromDB(
                "SELECT player_moral moral, player_position_q pos_q, player_position_r pos_r, 
                 player_has_moved has_moved, player_surpass_count surpass_count, player_dice_count dice_count 
                 FROM player WHERE player_id = $player_id"
            );
            if ($p) {
                $enriched[$player_id] = [
                    'moral' => $p['moral'],
                    'pos_q' => $p['pos_q'],
                    'pos_r' => $p['pos_r'],
                    'has_moved' => $p['has_moved'],
                    'surpass' => $p['surpass_count'],
                    'dice_count' => $p['dice_count']
                ];
            }
        }
        return $enriched;
    }
    
    /**
     * Check if player has a specific character (by power_code) active in their horde
     * @param int $player_id Player ID
     * @param string $power_code The power code to check (e.g. 'lyara_power')
     * @param bool $mustBeAvailable If true, the power must not be exhausted
     * @return bool
     */
    function hasCharacterWithPower(int $player_id, string $power_code, bool $mustBeAvailable = false): bool
    {
        // Find the character ID with this power_code
        $char_id = null;
        foreach ($this->characters as $id => $char) {
            if (isset($char['power_code']) && $char['power_code'] === $power_code) {
                $char_id = $id;
                break;
            }
        }
        
        if ($char_id === null) {
            return false;
        }
        
        // Check if player has this character in their horde
        $exhausted_condition = $mustBeAvailable ? " AND card_power_used = 0" : "";
        $count = (int)$this->getUniqueValueFromDB(
            "SELECT COUNT(*) FROM card WHERE card_location = 'horde_$player_id' AND card_type_arg = $char_id" . $exhausted_condition
        );
        
        return $count > 0;
    }
    
    /**
     * Check if player has Lyara l'Inspirante in their horde (villages = cities)
     */
    function hasLyaraActive(int $player_id): bool
    {
        return $this->hasCharacterWithPower($player_id, 'lyara_power', false);
    }
    
    /**
     * Check if a tile should be treated as a city (actual city OR village with Lyara)
     */
    function isTreatedAsCity(array $tile, int $player_id): bool
    {
        if ($tile['tile_type'] === 'city') {
            return true;
        }
        if ($tile['tile_type'] === 'village' && $this->hasLyaraActive($player_id)) {
            return true;
        }
        return false;
    }
}
