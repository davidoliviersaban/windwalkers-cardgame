<?php
/**
 * WW_Validation - Data validation utilities
 */

trait WW_Validation
{
    /**
     * Get and validate current chapter from game state
     * @throws BgaVisibleSystemException if chapter is invalid
     */
    function getValidatedChapter(): int
    {
        $chapter = (int)$this->getGameStateValue('current_chapter');
        
        if ($chapter < 1) {
            $chapter = 1;  // Default fallback
        }
        
        if ($chapter > 4) {
            throw new BgaVisibleSystemException(
                "Invalid chapter value ($chapter) - database may be corrupted"
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
