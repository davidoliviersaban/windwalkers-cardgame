<?php
/**
 * WW_HexGrid - Hex grid utilities (FLAT-TOP axial coordinates)
 * @see https://www.redblobgames.com/grids/hexagons/
 */

trait WW_HexGrid
{
    /**
     * Get the 6 adjacent hex directions for flat-top layout
     */
    private function getHexDirections(): array
    {
        return [
            [+1, 0],  // East
            [+1, -1], // North-East  
            [0, -1],  // North-West
            [-1, 0],  // West
            [-1, +1], // South-West
            [0, +1]   // South-East
        ];
    }
    
    /**
     * Get adjacent tiles for a hex position
     */
    function getAdjacentTiles(int $q, int $r, int $chapter): array
    {
        $adjacent = [];
        foreach ($this->getHexDirections() as $dir) {
            $tile = $this->getTileAt($q + $dir[0], $r + $dir[1], $chapter);
            if ($tile) {
                $adjacent[] = $tile;
            }
        }
        return $adjacent;
    }
    
    /**
     * Get tile at specific coordinates
     */
    function getTileAt(int $q, int $r, int $chapter): ?array
    {
        $tile = $this->getObjectFromDB(
            "SELECT tile_id, tile_q, tile_r, tile_type, tile_subtype, tile_chapter,
                    tile_wind_force, tile_discovered, tile_white_dice, tile_green_dice,
                    tile_black_dice, tile_moral_effect
             FROM tile WHERE tile_q = $q AND tile_r = $r AND tile_chapter = $chapter"
        );
        return $tile ?: null;
    }
    
    /**
     * Get tile by ID
     */
    function getTileById(int $tile_id): ?array
    {
        $tile = $this->getObjectFromDB("SELECT * FROM tile WHERE tile_id = $tile_id");
        return $tile ?: null;
    }
    
    /**
     * Check if a tile is adjacent to a position
     */
    function isTileAdjacent(int $tile_id, int $q, int $r, int $chapter): bool
    {
        foreach ($this->getAdjacentTiles($q, $r, $chapter) as $tile) {
            if ($tile['tile_id'] == $tile_id) {
                return true;
            }
        }
        return false;
    }
}
