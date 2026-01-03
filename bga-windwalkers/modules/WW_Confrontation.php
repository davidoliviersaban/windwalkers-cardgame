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
        $surpass_count = (int)$player['player_surpass_count'];
        $base_dice = (int)$player['player_dice_count'];
        
        // Final dice count after surpass reduction
        $dice_count = max(0, $base_dice - $surpass_count);
        
        // Roll blue horde dice
        $horde_dice = $this->rollDice($dice_count, 'blue', 'player');
        
        // Get selected tile to check for black dice (fatalité)
        $tile_id = $this->getGameStateValue('selected_tile');
        $tile = $this->getObjectFromDB("SELECT * FROM tile WHERE tile_id = $tile_id");
        $black_dice_count = (int)($tile['tile_black_dice'] ?? 0);
        
        // Roll violet dice to counter black dice (destin)
        $violet_dice = [];
        if ($black_dice_count > 0) {
            $violet_dice = $this->rollDice($black_dice_count, 'violet', 'player');
        }
        
        // Combine all player dice
        $all_dice = array_merge($horde_dice, $violet_dice);
        
        // Store in database and get dice with their DB IDs
        $stored_dice = $this->storeDiceRolls($all_dice);
        
        $message = $black_dice_count > 0 
            ? clienttranslate('${player_name} rolls ${dice_count} blue dice and ${violet_count} violet dice')
            : clienttranslate('${player_name} rolls ${dice_count} dice');
        
        $this->notifyAllPlayers('diceRolled', $message, [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'dice_count' => $dice_count,
            'violet_count' => $black_dice_count,
            'dice' => $stored_dice
        ]);
        
        // Go to diceResult state where player can modify or confirm
        $this->gamestate->nextState('diceRolled');
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
        
        $this->notifyAllPlayers('moralUsed', clienttranslate('${player_name} spends 1 moral to modify a die'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'dice_id' => $dice_id,
            'new_value' => $new_value,
            'new_moral' => $moral - 1
        ]);
        
        // Stay in diceResult state
        $this->gamestate->nextState('modified');
    }

    /**
     * Reroll all dice (costs moral)
     */
    function actRerollAll(): void
    {
        $this->checkAction('actRerollAll');
        $moral_cost = 1;
        $player_id = $this->getActivePlayerId();
        
        $moral = $this->getUniqueValueFromDB("SELECT player_moral FROM player WHERE player_id = $player_id");
        if ($moral <= $moral_cost) {
            throw new BgaUserException($this->_("You don't have enough moral to reroll all dice"));
        }
        
        // Spend 1 moral
        $this->DbQuery("UPDATE player SET player_moral = player_moral - $moral_cost WHERE player_id = $player_id");
        $this->incStat($moral_cost, 'moral_spent', $player_id);
        
        // Clear current dice
        $this->DbQuery("DELETE FROM dice_roll WHERE dice_owner = 'player'");
        
        // Roll new blue dice
        $player = $this->getObjectFromDB("SELECT * FROM player WHERE player_id = $player_id");
        $surpass_count = (int)$player['player_surpass_count'];
        $base_dice = (int)$player['player_dice_count'];
        $dice_count = max(0, $base_dice - $surpass_count);
        
        $horde_dice = $this->rollDice($dice_count, 'blue', 'player');
        
        // Get selected tile to check for black dice (fatalité)
        $tile_id = $this->getGameStateValue('selected_tile');
        $tile = $this->getObjectFromDB("SELECT * FROM tile WHERE tile_id = $tile_id");
        $black_dice_count = (int)($tile['tile_black_dice'] ?? 0);
        
        // Roll violet dice to counter black dice (destin)
        $violet_dice = [];
        if ($black_dice_count > 0) {
            $violet_dice = $this->rollDice($black_dice_count, 'violet', 'player');
        }
        
        // Combine all player dice
        $all_dice = array_merge($horde_dice, $violet_dice);
        $stored_dice = $this->storeDiceRolls($all_dice);
        
        $this->notifyAllPlayers('diceRolled', clienttranslate('${player_name} rerolls all dice (costs 1 moral)'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'dice_count' => $dice_count,
            'violet_count' => $black_dice_count,
            'dice' => $stored_dice,
            'new_moral' => $moral - $moral_cost
        ]);
        
        $this->gamestate->nextState('modified');
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
        
        // Clear previous dice rolls
        $this->clearDiceRolls();
        
        // Cities have no wind
        if ($this->tileHasNoWind($tile)) {
            $this->gamestate->nextState('noWind');
            return;
        }
        
        // Draw wind token if not already revealed (check for null or empty)
        if (empty($tile['tile_wind_force'])) {
            $this->revealWindOnTile($tile_id, $tile);
        } else {
            // Tile already discovered - just roll challenge dice with existing wind force
            $this->rollChallengeForExistingTile($tile_id, $tile);
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
        
        $this->notifyAllPlayers('windRevealed', clienttranslate('Wind force ${force} revealed!'), [
            'tile_id' => $tile_id,
            'force' => $force,
            'white_dice' => array_values($white_dice),
            'green_dice' => array_values($green_dice),
            'black_dice' => array_values($black_dice),
            'added_white_dice' => array_values($added_white)
        ]);
    }

    /**
     * Roll challenge dice for an already discovered tile
     */
    private function rollChallengeForExistingTile(int $tile_id, array $tile): void
    {
        $force = (int) $tile['tile_wind_force'];
        
        // Roll challenge dice
        $challenge_dice = $this->rollChallengeDice($tile, $force);
        
        // Store wind dice
        foreach ($challenge_dice as $dice) {
            $this->DbQuery("INSERT INTO dice_roll (dice_type, dice_value, dice_owner) 
                           VALUES ('{$dice['type']}', {$dice['value']}, 'challenge')");
        }
        
        // Separate by type for notification
        $white_dice = array_filter($challenge_dice, fn($d) => $d['type'] == 'white');
        $green_dice = array_filter($challenge_dice, fn($d) => $d['type'] == 'green');
        $black_dice = array_filter($challenge_dice, fn($d) => $d['type'] == 'black');
        
        $this->notifyAllPlayers('windRevealed', clienttranslate('Wind force ${force} - challenge dice rolled'), [
            'tile_id' => $tile_id,
            'force' => $force,
            'white_dice' => array_values($white_dice),
            'green_dice' => array_values($green_dice),
            'black_dice' => array_values($black_dice),
            'added_white_dice' => []
        ]);
    }

    /**
     * Roll challenge dice for a tile
     * On edge tiles (< 6 neighbors), wind rolls max 5 dice total (easier for player)
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
        
        // Check if this tile is on the edge (< 6 neighbors)
        // If so, cap total challenge dice to 5 maximum (easier for player)
        $is_edge_tile = false;
        $neighbors = $this->getAdjacentTiles((int)$tile['tile_q'], (int)$tile['tile_r'], (int)$tile['tile_chapter']);
        if (count($neighbors) < 6) {
            $is_edge_tile = true;
            $white_dice = array_slice($white_dice, 0, 5 - count($green_dice));
            if ($force === 6) {
                $white_dice[] = [
                    'type' => 'white',
                    'value' => 6,
                    'owner' => 'challenge',
                    'rolled' => false
                ];
            }
        }

        // Combine all dice
        $all_dice = array_merge($white_dice, $green_dice, $black_dice);
        return $all_dice;
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
        // 1. Separate dice by type
        $blue_dice = array_filter($horde_dice, fn($d) => $d['dice_type'] == 'blue');
        $green_dice = array_filter($wind_dice, fn($d) => $d['dice_type'] == 'green');
        $white_dice = array_filter($wind_dice, fn($d) => $d['dice_type'] == 'white');
        $non_black_wind = array_filter($wind_dice, fn($d) => $d['dice_type'] != 'black');
        
        // 2. FIRST: Match violet vs black (separate channel, independent of wind force)
        $dummy = [];  // Not used, black matching uses violet dice directly
        $black_match = $this->matchAndConsumeDice($wind_dice, $dummy, 'black', 'violet', $horde_dice);
        
        // 3. THEN: Match blue vs green/white
        $blue_counts = $this->countFaceOccurrences($blue_dice, null, 'player');
        
        $green_match = $this->matchAndConsumeDice($wind_dice, $blue_counts, 'green');
        $reduced_force = max(0, $wind_force - $green_match['matched']);

        $white_match = $this->matchAndConsumeDice($wind_dice, $blue_counts, 'white');

        // 4. Sum check: blue vs non-black
        $horde_sum = array_sum(array_column($blue_dice, 'dice_value'));
        $wind_sum = array_sum(array_column($non_black_wind, 'dice_value'));

        // Check all conditions
        $success = ($horde_sum >= $wind_sum) 
                && ($green_match['ok'] || $green_match['matched'] >= $wind_force)
                && ($white_match['matched'] >= $reduced_force)
                && $black_match['ok'];
        
        return [
            'success' => $success,
            'horde_sum' => $horde_sum,
            'wind_sum' => $wind_sum,
            'wind_force' => $wind_force,
            'wind_counts' => $this->countFaceOccurrences($wind_dice, null, 'challenge'),
            'player_counts' => $this->countFaceOccurrences($blue_dice, null, 'player')
        ];
    }

    /**
     * Handle confrontation success
     */
    private function handleConfrontationSuccess(int $player_id, array $tile, array $result): void
    {
        $this->incStat(1, 'confrontations_won', $player_id);
        $this->incStat(1, 'tiles_traversed', $player_id);
        
        // 1 point for tile traversed
        $points_earned = 1;
        
        if ($result['wind_force'] == 6) {
            $this->incStat(1, 'furevents_defeated', $player_id);
            $this->incStat(1, 'furevents_defeated');
            // 3 points for furevent
            $points_earned += 3;
        }
        
        // Award surpass points (cumulative: 0, 1, 2, 3, 4, 5...)
        $surpass_count = (int)$this->getUniqueValueFromDB("SELECT player_surpass_count FROM player WHERE player_id = $player_id");
        if ($surpass_count > 0) {
            $this->incStat($surpass_count, 'surpass_points', $player_id);
            $points_earned += $surpass_count;
        }
        
        // Increment score directly in player table
        $this->DbQuery("UPDATE player SET player_score = player_score + $points_earned WHERE player_id = $player_id");
        
        // Get new score to notify
        $new_score = $this->getUniqueValueFromDB("SELECT player_score FROM player WHERE player_id = $player_id");
        
        $this->notifyAllPlayers('confrontationSuccess', clienttranslate('${player_name} overcomes the wind! (+${surpass_points} points for surpass)'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'horde_sum' => $result['horde_sum'],
            'wind_sum' => $result['wind_sum'],
            'surpass_points' => $surpass_count,
            'wind_value_counts' => $result['wind_counts'],
            'player_value_counts' => $result['player_counts'],
            'new_score' => $new_score
        ]);
        
        // Move player
        $this->DbQuery("UPDATE player SET player_position_q = {$tile['tile_q']}, player_position_r = {$tile['tile_r']} WHERE player_id = $player_id");

        // Notify clients to refresh player position
        $this->notifyAllPlayers('playerMoves', clienttranslate('${player_name} moves to (${q}, ${r})'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'q' => (int)$tile['tile_q'],
            'r' => (int)$tile['tile_r']
        ]);
        
        $this->gamestate->nextState('success');
    }

    /**
     * Handle confrontation failure
     */
    private function handleConfrontationFailure(int $player_id, array $result): void
    {
        $this->incStat(1, 'confrontations_lost', $player_id);
        
        $this->notifyAllPlayers('confrontationFailure', clienttranslate('${player_name} is pushed back by the wind!'), [
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
        $player_id = $this->getActivePlayerId();
        $tile_id = $this->getGameStateValue('selected_tile');
        $tile = $this->getObjectFromDB("SELECT * FROM tile WHERE tile_id = $tile_id");
        
        $horde_dice = $this->getCollectionFromDb("SELECT * FROM dice_roll WHERE dice_owner = 'player'");
        $challenge_dice = $this->getCollectionFromDb("SELECT * FROM dice_roll WHERE dice_owner = 'challenge'");
        
        return [
            'tile' => $tile,
            'wind_force' => $tile['tile_wind_force'],
            'horde_dice' => $horde_dice,
            'challenge_dice' => $challenge_dice,
            'horde' => $this->getHordeWithPowerStatus($player_id)
        ];
    }

    //////////////////////////////////////////////////////////////////////////////
    // Lose Hordier (after confrontation failure)
    //////////////////////////////////////////////////////////////////////////////

    /**
     * Get arguments for loseHordier state
     */
    function argLoseHordier(): array
    {
        $player_id = $this->getActivePlayerId();
        
        // Get player's horde cards with power_used status
        $horde = $this->getHordeWithPowerStatus($player_id);
        
        return [
            'horde' => $horde,
            'horde_count' => count($horde)
        ];
    }

    /**
     * Player abandons a hordier after losing a confrontation
     */
    function actAbandonHordier(int $card_id): void
    {
        $this->checkAction('actAbandonHordier');
        $player_id = $this->getActivePlayerId();
        
        // Verify the card belongs to the player's horde
        $card = $this->cards->getCard($card_id);
        $location = $card['card_location'] ?? $card['location'] ?? '';
        if (!$card || $location != 'horde_' . $player_id) {
            throw new BgaUserException($this->_("This card is not in your horde"));
        }
        
        // Move card to discard
        $this->cards->moveCard($card_id, 'discard');
        
        $this->incStat(1, 'hordiers_lost', $player_id);
        
        // Get character info for notification
        $type_arg = $card['card_type_arg'] ?? $card['type_arg'] ?? null;
        $char_info = $this->characters[$type_arg] ?? ['name' => 'Hordier'];
        
        $this->notifyAllPlayers('hordierLost', clienttranslate('${player_name} loses ${character_name}'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'card_id' => $card_id,
            'character_name' => $char_info['name']
        ]);
        
        // Check if player has any hordiers left
        $remaining_hordiers = count($this->cards->getCardsInLocation('horde_' . $player_id));
        
        if ($remaining_hordiers == 0) {
            // Game over for this player - they will be eliminated in the game state
            $this->notifyAllPlayers('playerEliminated', clienttranslate('${player_name} has lost all Hordiers and is eliminated!'), [
                'player_id' => $player_id,
                'player_name' => $this->getActivePlayerName()
            ]);
            
            // Store player to eliminate and transition to game state
            $this->setGameStateValue('player_to_eliminate', $player_id);
            $this->gamestate->nextState('eliminate');
            return;
        }
        
        // Go to rest state
        $this->gamestate->nextState('hordierLost');
    }

    /**
     * Player voluntarily abandons the game after losing a confrontation
     */
    function actAbandonGame(): void
    {
        $this->checkAction('actAbandonGame');
        $player_id = $this->getActivePlayerId();
        
        // Notify all players
        $this->notifyAllPlayers('playerEliminated', clienttranslate('${player_name} has abandoned the expedition!'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName()
        ]);
        
        // Store player to eliminate and transition to game state
        $this->setGameStateValue('player_to_eliminate', $player_id);
        $this->gamestate->nextState('eliminate');
    }

    /**
     * Game state action to eliminate a player (can't eliminate active player directly)
     */
    function stPlayerElimination(): void
    {
        $player_id = $this->getGameStateValue('player_to_eliminate');
        
        if ($player_id > 0) {
            // Check if player is still active (not already eliminated by BGA framework)
            $player = $this->getObjectFromDB("SELECT player_eliminated FROM player WHERE player_id = $player_id");
            
            if ($player && $player['player_eliminated'] == 0) {
                // Player is still active - mark as eliminated without calling eliminatePlayer()
                // This avoids BGA server communication issues in studio
                
                // Set eliminated player's score to 0
                $this->DbQuery("UPDATE player SET player_score = 0, player_eliminated = 1 WHERE player_id = $player_id");
                
                // Calculate final scores for remaining players
                $this->calculateFinalScores();
            } else {
                // Player already eliminated - just calculate scores
                $this->calculateFinalScores();
            }
            
            // Clear the value
            $this->setGameStateValue('player_to_eliminate', 0);
        }
        
        $this->gamestate->nextState('finalScoring');
    }
}
