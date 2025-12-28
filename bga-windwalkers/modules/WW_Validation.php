<?php
/**
 * WW_Validation - Data validation utilities
 */

trait WW_Validation
{
    /**
     * Get and validate player's chapter
     * @throws BgaVisibleSystemException if chapter is invalid
     */
    function getValidatedPlayerChapter(int $player_id): int
    {
        $player = $this->getObjectFromDB("SELECT * FROM player WHERE player_id = $player_id");
        if (!$player) {
            throw new BgaVisibleSystemException("Player $player_id not found");
        }
        $chapter = (int)($player['player_chapter'] ?? 0);
        
        if ($chapter < 1 || $chapter > 4) {
            throw new BgaVisibleSystemException(
                "Invalid chapter value ($chapter) for player $player_id - database may be corrupted"
            );
        }
        
        return $chapter;
    }
    
    /**
     * Ensure tiles exist for a chapter, creating them if needed
     */
    function ensureTilesExist(int $chapter): int
    {
        $tile_count = (int)$this->getUniqueValueFromDB(
            "SELECT COUNT(*) FROM tile WHERE tile_chapter = $chapter"
        );
        
        if ($tile_count == 0) {
            $this->setupChapterTiles($chapter);
            $tile_count = (int)$this->getUniqueValueFromDB(
                "SELECT COUNT(*) FROM tile WHERE tile_chapter = $chapter"
            );
        }
        
        return $tile_count;
    }
}
