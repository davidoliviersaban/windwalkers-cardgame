<?php
/**
 * WW_Confrontation - Confrontation (dice rolling and wind) logic
 */

trait WW_Confrontation
{
    //////////////////////////////////////////////////////////////////////////////
    // Dice Actions
    //////////////////////////////////////////////////////////////////////////////
    
    /**
     * Roll horde dice
     */
    function actRollDice(): void
    {
        $this->checkAction('actRollDice');
        $player_id = $this->getActivePlayerId();
        
        $player = $this->getObjectFromDB("SELECT * FROM player WHERE player_id = $player_id");
        $surpass_count = $player['player_surpass_count'];
        $dice_count = $player['player_dice_count'] - $surpass_count;
        
        $horde_dice = $this->rollDice($dice_count, 'blue', 'player');
        
        // Store in database
        $this->storeDiceRolls($horde_dice);
        
        $this->notify->all('diceRolled', clienttranslate('${player_name} rolls ${dice_count} dice'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'dice_count' => $dice_count,
            'dice' => $horde_dice
        ]);
        
        $this->gamestate->nextState('rollAgain');
    }

    /**
     * Use moral to modify a die
     */
    function actUseMoral(int $dice_id, int $modifier): void
    {
        $this->checkAction('actUseMoral');
        $player_id = $this->getActivePlayerId();
        
        $moral = $this->getUniqueValueFromDB("SELECT player_moral FROM player WHERE player_id = $player_id");
        if ($moral <= 1) {
            throw new BgaUserException($this->_("You don't have enough moral"));
        }
        
        if ($modifier != -1 && $modifier != 1) {
            throw new BgaUserException($this->_("Invalid modifier"));
        }
        
        $dice = $this->getObjectFromDB("SELECT * FROM dice_roll WHERE dice_id = $dice_id");
        if (!$dice || $dice['dice_owner'] != 'player') {
            throw new BgaUserException($this->_("Invalid dice"));
        }
        
        $new_value = max(1, min(6, $dice['dice_value'] + $modifier));
        $this->DbQuery("UPDATE dice_roll SET dice_value = $new_value WHERE dice_id = $dice_id");
        
        $this->DbQuery("UPDATE player SET player_moral = player_moral - 1 WHERE player_id = $player_id");
        $this->incStat(1, 'moral_spent', $player_id);
        
        $this->notify->all('moralUsed', clienttranslate('${player_name} spends 1 moral to modify a die'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'dice_id' => $dice_id,
            'new_value' => $new_value,
            'new_moral' => $moral - 1
        ]);
    }

    /**
     * Confirm dice roll
     */
    function actConfirmRoll(): void
    {
        $this->checkAction('actConfirmRoll');
        $this->gamestate->nextState('checkResult');
    }

    //////////////////////////////////////////////////////////////////////////////
    // Wind Revelation
    //////////////////////////////////////////////////////////////////////////////
    
    /**
     * State: Reveal wind on tile
     */
    function stRevealWind(): void
    {
        $tile_id = $this->getGameStateValue('selected_tile');
        $tile = $this->getObjectFromDB("SELECT * FROM tile WHERE tile_id = $tile_id");
        
        // Cities have no wind
        if ($this->tileHasNoWind($tile)) {
            $this->gamestate->nextState('noWind');
            return;
        }
        
        // Draw wind token if not already revealed
        if ($tile['tile_wind_force'] === null) {
            $this->revealWindOnTile($tile_id, $tile);
        }
        
        $this->gamestate->nextState('windRevealed');
    }

    /**
     * Check if tile has no wind
     */
    private function tileHasNoWind(array $tile): bool
    {
        return $tile['tile_type'] == 'city' || 
               isset($this->terrain_types[$tile['tile_subtype']]['no_wind']);
    }

    /**
     * Reveal wind on a tile
     */
    private function revealWindOnTile(int $tile_id, array $tile): void
    {
        $token = $this->drawWindToken();
        $force = $token['token_force'];
        
        $this->DbQuery("UPDATE tile SET tile_wind_force = $force, tile_discovered = 1 WHERE tile_id = $tile_id");
        $this->DbQuery("UPDATE wind_token SET token_location = 'tile', token_tile_id = $tile_id WHERE token_id = {$token['token_id']}");
        
        // Roll challenge dice
        $challenge_dice = $this->rollChallengeDice($tile, $force);
        
        // Store wind dice
        foreach ($challenge_dice as $dice) {
            $this->DbQuery("INSERT INTO dice_roll (dice_type, dice_value, dice_owner) 
                           VALUES ('{$dice['type']}', {$dice['value']}, '{$dice['owner']}')");
        }
        
        // Separate by type for notification
        $white_dice = array_filter($challenge_dice, fn($d) => $d['type'] == 'white');
        $green_dice = array_filter($challenge_dice, fn($d) => $d['type'] == 'green');
        $black_dice = array_filter($challenge_dice, fn($d) => $d['type'] == 'black');
        $added_white = array_filter($white_dice, fn($d) => !isset($d['rolled']) || !$d['rolled']);
        
        $this->notify->all('windRevealed', clienttranslate('Wind force ${force} revealed!'), [
            'tile_id' => $tile_id,
            'force' => $force,
            'white_dice' => array_values($white_dice),
            'green_dice' => array_values($green_dice),
            'black_dice' => array_values($black_dice),
            'added_white_dice' => array_values($added_white)
        ]);
    }

    /**
     * Roll challenge dice for a tile
     */
    private function rollChallengeDice(array $tile, int $force): array
    {
        $green_dice = $this->rollDice($tile['tile_green_dice'], 'green', 'challenge');
        $white_dice = $this->rollDice($tile['tile_white_dice'], 'white', 'challenge');
        $black_dice = $this->rollDice($tile['tile_black_dice'], 'black', 'challenge');
        
        // Mark rolled dice
        foreach ($white_dice as &$d) { $d['rolled'] = true; }
        foreach ($green_dice as &$d) { $d['rolled'] = true; }
        foreach ($black_dice as &$d) { $d['rolled'] = true; }
        
        // Add missing white dice as fixed 6 to reach wind force
        $missing_white = max(0, $force - (count($white_dice) + count($green_dice)));
        for ($i = 0; $i < $missing_white; $i++) {
            $white_dice[] = [
                'type' => 'white',
                'value' => 6,
                'owner' => 'challenge',
                'rolled' => false
            ];
        }
        
        return array_merge($white_dice, $green_dice, $black_dice);
    }

    //////////////////////////////////////////////////////////////////////////////
    // Confrontation Resolution
    //////////////////////////////////////////////////////////////////////////////
    
    /**
     * State: Resolve confrontation
     */
    function stResolveConfrontation(): void
    {
        $player_id = $this->getActivePlayerId();
        
        $horde_dice = $this->getCollectionFromDb("SELECT * FROM dice_roll WHERE dice_owner = 'player'");
        $wind_dice = $this->getCollectionFromDb("SELECT * FROM dice_roll WHERE dice_owner = 'challenge'");
        
        $tile_id = $this->getGameStateValue('selected_tile');
        $tile = $this->getObjectFromDB("SELECT * FROM tile WHERE tile_id = $tile_id");
        $wind_force = $tile['tile_wind_force'] ?? 0;

        $result = $this->calculateConfrontationResult($horde_dice, $wind_dice, $wind_force);
        
        if ($result['success']) {
            $this->handleConfrontationSuccess($player_id, $tile, $result);
        } else {
            $this->handleConfrontationFailure($player_id, $result);
        }
    }

    /**
     * Calculate confrontation result
     */
    private function calculateConfrontationResult(array $horde_dice, array $wind_dice, int $wind_force): array
    {
        $horde_sum = array_sum(array_column($horde_dice, 'dice_value'));
        $wind_sum = array_sum(array_column($wind_dice, 'dice_value'));
        
        $wind_counts = $this->countFaceOccurrences($wind_dice, null, 'challenge');
        $player_counts = $this->countFaceOccurrences($horde_dice, null, 'player');
        $available_counts = $player_counts;
        
        // Match by dimension
        $green_match = $this->matchAndConsumeDice($wind_dice, $available_counts, 'green');
        $greens_ok = ($green_match['matched'] >= $green_match['required'] || $green_match['matched'] >= $wind_force);
        $reduced_force = max(0, $wind_force - $green_match['matched']);

        $white_match = $this->matchAndConsumeDice($wind_dice, $available_counts, 'white');
        $whites_ok = ($white_match['matched'] >= $reduced_force);

        $black_match = $this->matchAndConsumeDice($wind_dice, $available_counts, 'black');
        $blacks_ok = ($black_match['matched'] >= $black_match['required']);

        $success = ($horde_sum >= $wind_sum) && $greens_ok && $whites_ok && $blacks_ok;
        
        return [
            'success' => $success,
            'horde_sum' => $horde_sum,
            'wind_sum' => $wind_sum,
            'wind_force' => $wind_force,
            'wind_counts' => $wind_counts,
            'player_counts' => $player_counts
        ];
    }

    /**
     * Handle confrontation success
     */
    private function handleConfrontationSuccess(int $player_id, array $tile, array $result): void
    {
        $this->incStat(1, 'confrontations_won', $player_id);
        $this->incStat(1, 'tiles_traversed', $player_id);
        
        if ($result['wind_force'] == 6) {
            $this->incStat(1, 'furevents_defeated', $player_id);
            $this->incStat(1, 'furevents_defeated');
        }
        
        // Award surpass points
        $surpass_count = $this->getUniqueValueFromDB("SELECT player_surpass_count FROM player WHERE player_id = $player_id");
        $this->DbQuery("UPDATE player SET player_score = player_score + $surpass_count WHERE player_id = $player_id");
        
        $this->notify->all('confrontationSuccess', clienttranslate('${player_name} overcomes the wind! (+${surpass_points} points for surpass)'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'horde_sum' => $result['horde_sum'],
            'wind_sum' => $result['wind_sum'],
            'surpass_points' => $surpass_count,
            'wind_value_counts' => $result['wind_counts'],
            'player_value_counts' => $result['player_counts']
        ]);
        
        // Move player
        $this->DbQuery("UPDATE player SET player_position_q = {$tile['tile_q']}, player_position_r = {$tile['tile_r']} WHERE player_id = $player_id");
        
        $this->gamestate->nextState('success');
    }

    /**
     * Handle confrontation failure
     */
    private function handleConfrontationFailure(int $player_id, array $result): void
    {
        $this->incStat(1, 'confrontations_lost', $player_id);
        
        $this->notify->all('confrontationFailure', clienttranslate('${player_name} is pushed back by the wind!'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'horde_sum' => $result['horde_sum'],
            'wind_sum' => $result['wind_sum'],
            'wind_value_counts' => $result['wind_counts'],
            'player_value_counts' => $result['player_counts']
        ]);
        
        $this->gamestate->nextState('failure');
    }

    //////////////////////////////////////////////////////////////////////////////
    // Confrontation State Arguments
    //////////////////////////////////////////////////////////////////////////////
    
    /**
     * Get confrontation state arguments
     */
    function argConfrontation(): array
    {
        $tile_id = $this->getGameStateValue('selected_tile');
        $tile = $this->getObjectFromDB("SELECT * FROM tile WHERE tile_id = $tile_id");
        
        $horde_dice = $this->getCollectionFromDb("SELECT * FROM dice_roll WHERE dice_owner = 'player'");
        $challenge_dice = $this->getCollectionFromDb("SELECT * FROM dice_roll WHERE dice_owner = 'challenge'");
        
        return [
            'tile' => $tile,
            'wind_force' => $tile['tile_wind_force'],
            'horde_dice' => $horde_dice,
            'challenge_dice' => $challenge_dice
        ];
    }
}
