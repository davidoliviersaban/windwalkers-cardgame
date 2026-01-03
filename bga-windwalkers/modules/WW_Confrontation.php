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
     * Process batch actions from client (undo-able actions)
     * Client sends all pending actions at once for validation
     * @param string $actions JSON array of actions
     * @param int $andConfirm If 1, also confirm the roll after applying actions
     */
    function actBatchActions(string $actions, int $andConfirm = 0): void
    {
        $this->checkAction('actBatchActions');
        $player_id = $this->getActivePlayerId();
        
        $actions_array = json_decode($actions, true);
        if (!is_array($actions_array)) {
            throw new BgaUserException($this->_("Invalid actions format"));
        }
        
        // Get current state for validation
        $moral = (int)$this->getUniqueValueFromDB("SELECT player_moral FROM player WHERE player_id = $player_id");
        $total_moral_cost = 0;
        
        // First pass: validate all actions can be executed
        foreach ($actions_array as $action) {
            $type = $action['type'] ?? '';
            $params = $action['params'] ?? [];
            
            switch ($type) {
                case 'modifyDice':
                    $total_moral_cost += 1;
                    break;
                case 'usePower':
                    // Check card exists and belongs to player
                    $card_id = (int)($params['card_id'] ?? 0);
                    $card = $this->getObjectFromDB("SELECT * FROM card WHERE card_id = $card_id AND card_location = 'horde_$player_id'");
                    if (!$card) {
                        throw new BgaUserException($this->_("Invalid card"));
                    }
                    break;
                case 'rerollAll':
                    $total_moral_cost += 1;
                    break;
            }
        }
        
        // Check total moral cost (need more moral than cost, keep at least 1)
        if ($total_moral_cost > 0 && $moral <= $total_moral_cost) {
            throw new BgaUserException($this->_("Not enough moral for all actions"));
        }
        
        // Second pass: execute all actions
        foreach ($actions_array as $action) {
            $type = $action['type'] ?? '';
            $params = $action['params'] ?? [];
            
            switch ($type) {
                case 'modifyDice':
                    $this->executeBatchModifyDice($player_id, $params);
                    break;
                case 'usePower':
                    $this->executeBatchUsePower($player_id, $params);
                    break;
            }
        }
        
        // Send summary notification with updated dice values
        $new_moral = (int)$this->getUniqueValueFromDB("SELECT player_moral FROM player WHERE player_id = $player_id");
        $updated_dice = $this->getCollectionFromDb("SELECT * FROM dice_roll WHERE dice_owner = 'player'");
        
        if (count($actions_array) > 0) {
            $this->notifyAllPlayers('batchActionsApplied', clienttranslate('\${player_name} applied \${count} actions'), [
                'player_id' => $player_id,
                'player_name' => $this->getActivePlayerName(),
                'count' => count($actions_array),
                'new_moral' => $new_moral,
                'updated_dice' => array_values($updated_dice)
            ]);
        }
        
        // If andConfirm is true, proceed to check result instead of staying in diceResult
        if ($andConfirm) {
            $this->gamestate->nextState('checkResult');
        } else {
            $this->gamestate->nextState('modified');
        }
    }
    
    /**
     * Execute a single modifyDice action from batch
     */
    private function executeBatchModifyDice(int $player_id, array $params): void
    {
        $dice_id = (int)($params['dice_id'] ?? 0);
        $modifier = (int)($params['modifier'] ?? 0);
        
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
    }
    
    /**
     * Execute a single usePower action from batch
     */
    private function executeBatchUsePower(int $player_id, array $params): void
    {
        $card_id = (int)($params['card_id'] ?? 0);
        $target_card_id = isset($params['target_card_id']) ? (int)$params['target_card_id'] : null;
        
        $card = $this->getObjectFromDB("SELECT * FROM card WHERE card_id = $card_id AND card_location = 'horde_$player_id'");
        if (!$card) {
            throw new BgaUserException($this->_("Invalid card"));
        }
        
        if ($card['card_power_used']) {
            throw new BgaUserException($this->_("Power already used"));
        }
        
        // Get character info
        $type_arg = (int)$card['card_type_arg'];
        $char_info = $this->characters[$type_arg] ?? null;
        $power_code = $char_info['power_code'] ?? '';
        
        // Mark power as used (tap)
        $this->DbQuery("UPDATE card SET card_power_used = 1 WHERE card_id = $card_id");
        
        // Apply power effect based on power_code
        $this->applyPowerEffect($player_id, $card_id, $power_code, $target_card_id, $params);
        
        // Notify power used
        $this->notifyAllPlayers('powerUsed', clienttranslate('${player_name} uses ${character_name}\'s power'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'card_id' => $card_id,
            'character_name' => $char_info['name'] ?? 'Unknown',
            'power_code' => $power_code
        ]);
    }
    
    /**
     * Apply power effect based on power_code
     */
    private function applyPowerEffect(int $player_id, int $card_id, string $power_code, ?int $target_card_id, array $params): void
    {
        switch ($power_code) {
            case 'vera_power':
                // Vera: :tap:: :rest: - Rest one exhausted Hordier
                $this->applyVeraPower($player_id, $card_id, $target_card_id);
                break;
            case 'saskia_power':
                // Saskia: Si tuile = 2 dés verts, gagnez +2 moral
                $this->applySaskiaPower($player_id);
                break;
            case 'uther_power':
                // Uther: :tap:: :discard: pour ignorer 3 :tous-des: / :missing:
                $this->applyUtherPower($player_id, $card_id, $target_card_id, $params);
                break;
                
            // Add more powers here as they are implemented
            default:
                // Unknown or unimplemented power - no effect
                break;
        }
    }
    
    /**
     * Uther's power: Sacrifice another Hordier to ignore challenge dice
     * :tap:: :discard: pour ignorer 3 :tous-des: / :missing:
     * Can ignore up to 3 dice per missing hordier
     */
    private function applyUtherPower(int $player_id, int $uther_card_id, ?int $target_card_id, array $params): void
    {
        if (!$target_card_id) {
            throw new BgaUserException($this->_("You must select a Hordier to sacrifice"));
        }
        
        // Validate target is in player's horde and not Uther himself
        $target_card = $this->getObjectFromDB("SELECT * FROM card WHERE card_id = $target_card_id AND card_location = 'horde_$player_id'");
        if (!$target_card) {
            throw new BgaUserException($this->_("Invalid target card"));
        }
        
        if ($target_card_id == $uther_card_id) {
            throw new BgaUserException($this->_("Uther cannot sacrifice himself"));
        }
        
        // Get target character name
        $target_type_arg = (int)$target_card['card_type_arg'];
        $target_char = $this->characters[$target_type_arg] ?? null;
        $target_name = $target_char['name'] ?? 'Unknown';
        
        // Discard the target
        $this->DbQuery("UPDATE card SET card_location = 'discard' WHERE card_id = $target_card_id");
        
        // Notify about the sacrifice
        $this->notifyAllPlayers('hordierLost', clienttranslate('${player_name} sacrifices ${character_name}!'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'card_id' => $target_card_id,
            'character_name' => $target_name
        ]);
        
        // Get ignored dice from params
        $ignored_dice = $params['ignored_dice'] ?? [];
        
        if (!empty($ignored_dice)) {
            // Count missing hordiers (max horde is 8)
            $horde_count = (int)$this->getUniqueValueFromDB("SELECT COUNT(*) FROM card WHERE card_location = 'horde_$player_id'");
            $missing_count = 8 - $horde_count;
            $max_ignore = 3 * $missing_count;
            
            // Validate not ignoring more than allowed
            if (count($ignored_dice) > $max_ignore) {
                throw new BgaUserException(sprintf($this->_("You can only ignore %d dice"), $max_ignore));
            }
            
            // Mark dice as ignored (locked) - they won't count in confrontation
            foreach ($ignored_dice as $dice_id) {
                // dice_id from client is like "white_0", "green_1", etc.
                // We need to find the actual database dice_id
                // For now, we store ignored dice IDs in a game state variable
            }
            
            // Store ignored dice IDs for confrontation calculation
            $this->setGlobalVariable('uther_ignored_dice', json_encode($ignored_dice));
            
            $this->notifyAllPlayers('diceIgnored', clienttranslate('${count} challenge dice ignored!'), [
                'player_id' => $player_id,
                'ignored_dice' => $ignored_dice,
                'count' => count($ignored_dice)
            ]);
        }
    }
    
    /**
     * Saskia's power: If tile has exactly 2 green dice, gain +2 moral
     */
    private function applySaskiaPower(int $player_id): void
    {
        // Get current tile
        $tile_id = $this->getGameStateValue('selected_tile');
        $tile = $this->getObjectFromDB("SELECT * FROM tile WHERE tile_id = $tile_id");
        
        if (!$tile) {
            throw new BgaUserException($this->_("No tile selected"));
        }
        
        // Count green dice only
        $greenDice = (int)$tile['tile_green_dice'];
        
        if ($greenDice !== 2) {
            throw new BgaUserException(sprintf(
                $this->_("Saskia's power requires exactly 2 green dice (this tile has %d)"),
                $greenDice
            ));
        }
        
        // Add +2 moral
        $this->DbQuery("UPDATE player SET player_moral = player_moral + 2 WHERE player_id = $player_id");
        
        // Get new moral value
        $newMoral = (int)$this->getUniqueValueFromDB("SELECT player_moral FROM player WHERE player_id = $player_id");
        
        // Notify
        $this->notifyAllPlayers('moralChanged', clienttranslate('${player_name} gains +2 moral (Saskia\'s power)'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'moral' => $newMoral,
            'change' => 2
        ]);
    }
    
    /**
     * Vera's power: Rest one exhausted Hordier (not herself)
     */
    private function applyVeraPower(int $player_id, int $vera_card_id, ?int $target_card_id): void
    {
        if ($target_card_id === null) {
            throw new BgaUserException($this->_("You must select a Hordier to rest"));
        }
        
        // Can't rest herself
        if ($target_card_id === $vera_card_id) {
            throw new BgaUserException($this->_("Vera cannot rest herself"));
        }
        
        // Check target is in player's horde and exhausted
        $target = $this->getObjectFromDB(
            "SELECT * FROM card WHERE card_id = $target_card_id AND card_location = 'horde_$player_id'"
        );
        
        if (!$target) {
            throw new BgaUserException($this->_("Invalid target"));
        }
        
        if (!$target['card_power_used']) {
            throw new BgaUserException($this->_("This Hordier is not exhausted"));
        }
        
        // Rest the target
        $this->DbQuery("UPDATE card SET card_power_used = 0 WHERE card_id = $target_card_id");
        
        // Notify
        $target_type_arg = (int)$target['card_type_arg'];
        $target_char = $this->characters[$target_type_arg] ?? ['name' => 'Hordier'];
        
        $this->notifyAllPlayers('hordierRested', clienttranslate('${character_name} is rested'), [
            'player_id' => $player_id,
            'card_id' => $target_card_id,
            'character_name' => $target_char['name']
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
        
        // Filter out ignored dice (from Uther's power)
        $ignored_dice_json = $this->getGlobalVariable('uther_ignored_dice');
        if ($ignored_dice_json) {
            $ignored_dice = json_decode($ignored_dice_json, true) ?? [];
            if (!empty($ignored_dice)) {
                $wind_dice = array_filter($wind_dice, function($dice) use ($ignored_dice) {
                    return !in_array($dice['dice_id'], $ignored_dice);
                });
                // Clear the variable for next confrontation
                $this->setGlobalVariable('uther_ignored_dice', null);
            }
        }
        
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
        // If no wind dice remain (all ignored), automatic success
        if (empty($wind_dice)) {
            return [
                'success' => true,
                'horde_sum' => array_sum(array_column($horde_dice, 'dice_value')),
                'wind_sum' => 0,
                'wind_force' => $wind_force,
                'wind_counts' => [],
                'player_counts' => $this->countFaceOccurrences($horde_dice, null, 'player')
            ];
        }
        
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
        
        // Wind force cannot exceed the number of available challenge dice (green + white)
        $effective_wind_force = min($wind_force, count($green_dice) + count($white_dice));
        
        // If no green dice, green matching is automatically OK
        $green_match = empty($green_dice) 
            ? ['ok' => true, 'matched' => 0]
            : $this->matchAndConsumeDice($wind_dice, $blue_counts, 'green');
        
        // Reduced force cannot exceed the number of white dice available
        $reduced_force = max(0, $effective_wind_force - $green_match['matched']);
        $reduced_force = min($reduced_force, count($white_dice));

        // If no white dice, white matching is automatically OK
        $white_match = empty($white_dice)
            ? ['ok' => true, 'matched' => $reduced_force]  // Consider all required as matched
            : $this->matchAndConsumeDice($wind_dice, $blue_counts, 'white');

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
        $player = $this->getObjectFromDB("SELECT player_moral FROM player WHERE player_id = $player_id");
        
        $horde_dice = $this->getCollectionFromDb("SELECT * FROM dice_roll WHERE dice_owner = 'player'");
        $challenge_dice = $this->getCollectionFromDb("SELECT * FROM dice_roll WHERE dice_owner = 'challenge'");
        
        return [
            'tile' => $tile,
            'wind_force' => $tile['tile_wind_force'],
            'moral' => (int)$player['player_moral'],
            'horde_dice' => array_values($horde_dice),
            'challenge_dice' => array_values($challenge_dice),
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
                
                // Set eliminated player's score to -1 (indicates defeat/abandon)
                $this->DbQuery("UPDATE player SET player_score = -1, player_eliminated = 1 WHERE player_id = $player_id");
                
                // Notify defeat
                $this->notifyAllPlayers('gameDefeat', clienttranslate('The expedition has failed. Final score: ${score}'), [
                    'player_id' => $player_id,
                    'score' => -1
                ]);
            }
            
            // Clear the value
            $this->setGameStateValue('player_to_eliminate', 0);
        }
        
        $this->gamestate->nextState('finalScoring');
    }
}
