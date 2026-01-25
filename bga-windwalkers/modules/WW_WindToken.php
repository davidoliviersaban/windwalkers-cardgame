<?php
/**
 * WW_WindToken - Wind token management
 */

trait WW_WindToken
{
    /**
     * Draw a random wind token from the bag
     * Uses bgaShuffle instead of MySQL RAND() for reliable randomness in BGA Studio
     */
    function drawWindToken(): ?array
    {
        $tokens = $this->getCollectionFromDb(
            "SELECT * FROM wind_token WHERE token_location = 'bag'"
        );
        if (empty($tokens)) {
            return null;
        }
        $tokens = $this->bgaShuffle($tokens);
        return $tokens[0] ?? null;
    }

    /**
     * Place a wind token on a tile
     */
    function placeWindTokenOnTile(int $token_id, int $tile_id, int $force): void
    {
        $this->DbQuery("UPDATE tile SET tile_wind_force = $force, tile_discovered = 1 WHERE tile_id = $tile_id");
        $this->DbQuery("UPDATE wind_token SET token_location = 'tile', token_tile_id = $tile_id WHERE token_id = $token_id");
    }

    /**
     * Return all wind tokens to bag
     */
    function resetWindTokens(): void
    {
        $this->DbQuery("UPDATE wind_token SET token_location = 'bag', token_tile_id = NULL");
    }
}
