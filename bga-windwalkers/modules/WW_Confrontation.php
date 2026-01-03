<?php
/**
 * WW_Confrontation - Confrontation (dice rolling and wind) logic
 */

trait WW_Confrontation
{
    //////////////////////////////////////////////////////////////////////////////
    // Constants
    //////////////////////////////////////////////////////////////////////////////
    
    const MAX_HORDE_SIZE = 8;
    
    //////////////////////////////////////////////////////////////////////////////
    // Helper Functions
    //////////////////////////////////////////////////////////////////////////////
    
    /**
     * Get the number of missing hordiers for a player
     * Max horde size is 8, so missing = 8 - current horde count
     * @param int $player_id Player ID
     * @return int Number of missing hordiers (0 to 8)
     */
    private function getMissingHordiersCount(int $player_id): int
    {
        $horde_count = (int)$this->getUniqueValueFromDB(
            "SELECT COUNT(*) FROM card WHERE card_location = 'horde_$player_id'"
        );
        return max(0, self::MAX_HORDE_SIZE - $horde_count);
    }
    
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
        
        $this->DbQuery("UPDATE player SET player_moral = GREATEST(0, player_moral - 1) WHERE player_id = $player_id");
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
        $this->DbQuery("UPDATE player SET player_moral = GREATEST(0, player_moral - $moral_cost) WHERE player_id = $player_id");
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
        
        // Get ignored dice IDs to send to client
        $ignored_dice_json = $this->getGlobalVariable('uther_ignored_dice');
        $ignored_dice = $ignored_dice_json ? json_decode($ignored_dice_json, true) : [];
        
        if (count($actions_array) > 0) {
            $this->notifyAllPlayers('batchActionsApplied', clienttranslate('${player_name} applied ${count} actions'), [
                'player_id' => $player_id,
                'player_name' => $this->getActivePlayerName(),
                'count' => count($actions_array),
                'new_moral' => $new_moral,
                'updated_dice' => array_values($updated_dice),
                'ignored_dice' => $ignored_dice
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
        $this->DbQuery("UPDATE player SET player_moral = GREATEST(0, player_moral - 1) WHERE player_id = $player_id");
        $this->incStat(1, 'moral_spent', $player_id);
    }
    
    /**
     * Execute a single usePower action from batch
     */
    private function executeBatchUsePower(int $player_id, array $params): void
    {
        $card_id = (int)($params['card_id'] ?? 0);
        $target_card_id = isset($params['target_card_id']) ? (int)$params['target_card_id'] : null;
        
        // Decode nested params if they are a JSON string
        $power_params = $params;
        if (isset($params['params']) && is_string($params['params'])) {
            $decoded = json_decode($params['params'], true);
            if (is_array($decoded)) {
                $power_params = array_merge($params, $decoded);
            }
        }
        
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
        $this->applyPowerEffect($player_id, $card_id, $power_code, $target_card_id, $power_params);
        
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
     * Protected so it can be called from WW_Draft for powers used outside confrontation
     */
    protected function applyPowerEffect(int $player_id, int $card_id, string $power_code, ?int $target_card_id, array $params): void
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
            case 'osvaldo_power':
                // Osvaldo: Si tuile = 3 dés verts, gagnez +3 moral
                $this->applyOsvaldoPower($player_id);
                break;
            case 'baramas_power':
                // Baramas: Si force = 3, gagnez +3 moral
                $this->applyBaramasPower($player_id);
                break;
            case 'uther_power':
                // Uther: :tap:: :discard: pour ignorer 3 :tous-des: / :missing:
                $this->applyUtherPower($player_id, $card_id, $target_card_id, $params);
                break;
            case 'xavio_power':
                // Xavio Torantor: +1 dé, si autre Torantor ±1 sur 1 dé
                $this->applyXavioPower($player_id, $card_id, $params);
                break;
            case 'yavo_power':
                // Yavo Torantor: +1 dé, si autre Torantor +1 moral
                $this->applyYavoPower($player_id, $card_id);
                break;
            case 'kyo_power':
                // Kyo Torantor: +1 dé, si autre Torantor repose cette carte
                $this->applyKyoPower($player_id, $card_id);
                break;
            case 'zaffa_power':
                // Zaffa Torantor: +1 dé violet, repose 1 autre Torantor
                $this->applyZaffaPower($player_id, $card_id, $target_card_id);
                break;
            case 'gianni_power':
                // Gianni Raymondi: Placez 1 dé de horde avec valeur choisie
                $this->applyGianniPower($player_id, $params);
                break;
            case 'wanda_power':
                // Wanda Pfeffer: Ignorez 1 dé de challenge
                $this->applyWandaPower($player_id, $params);
                break;
            case 'kunigunde_power':
                // Kunigunde Nosske: Si somme dés horde > épreuve, ignore tous dés blancs
                $this->applyKunigundePower($player_id);
                break;
            case 'thomassin_power':
                // Thomassin de Gaude: ±1 sur chaque dé de horde
                $this->applyThomassinPower($player_id, $params);
                break;
            case 'blanchette_power':
                // Blanchette de Gaude: ±1 sur dés de horde, nombre = force du vent
                $this->applyBlanchettePower($player_id, $params);
                break;
            case 'waldo_power':
                // Waldo Waldmann: Ignorer 1 dé terrain par hordier manquant
                $this->applyWaldoPower($player_id, $params);
                break;
            case 'belkacem_power':
                // Belkacem: Placer 1 dé terrain (ajouter un dé challenge avec valeur choisie)
                $this->applyBelkacemPower($player_id, $params);
                break;
            case 'benelim_power':
                // Benelim: Lancez +1 dé horde par carte PACK
                $this->applyBenelimPower($player_id);
                break;
            case 'galas_power':
                // Galas Thunderflayer: Si force = 6 (FUREVENT), rest-all (except himself)
                $this->applyGalasPower($player_id, $card_id);
                break;
                
            // Add more powers here as they are implemented
            default:
                // Unknown or unimplemented power - no effect
                break;
        }
    }
    
    /**
     * Galas Thunderflayer's power: If wind force is 6 (FUREVENT), rest all hordiers except himself
     * :tap:: Si :force-x: = FUREVENT :force-6:, :rest-all:
     */
    private function applyGalasPower(int $player_id, int $galas_card_id): void
    {
        // Get the selected tile to check wind force
        $tile_id = $this->getGameStateValue('selected_tile');
        if (!$tile_id) {
            throw new BgaUserException($this->_("No tile selected"));
        }
        
        $tile = $this->getObjectFromDB("SELECT * FROM tile WHERE tile_id = $tile_id");
        if (!$tile) {
            throw new BgaUserException($this->_("Tile not found"));
        }
        
        $wind_force = (int)($tile['tile_wind_force'] ?? 0);
        
        // Check if it's a FUREVENT (force = 6)
        if ($wind_force != 6) {
            throw new BgaUserException($this->_("This power only works on FUREVENT tiles (wind force 6)"));
        }
        
        // Rest all hordiers EXCEPT Galas himself (set card_power_used = 0)
        $this->DbQuery("UPDATE card SET card_power_used = 0 WHERE card_location = 'horde_$player_id' AND card_id != $galas_card_id");
        
        // Notify all players
        $this->notifyAllPlayers('allHordiersRested', clienttranslate('${player_name} uses Galas\' power: All other hordiers are rested!'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'except_card_id' => $galas_card_id
        ]);
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
            // Uther: can ignore 3 dice per missing hordier
            $missing_count = $this->getMissingHordiersCount($player_id);
            $max_ignore = 3 * $missing_count;
            
            // Validate not ignoring more than allowed
            if (count($ignored_dice) > $max_ignore) {
                throw new BgaUserException(sprintf($this->_("You can only ignore %d dice"), $max_ignore));
            }
            
            // Get current ignored dice and merge with new ones (to support multiple ignore powers)
            $current_ignored = json_decode($this->getGlobalVariable('uther_ignored_dice') ?? '[]', true);
            $current_ignored = array_merge($current_ignored, $ignored_dice);
            
            // Store ignored dice IDs for confrontation calculation
            $this->setGlobalVariable('uther_ignored_dice', json_encode($current_ignored));
            
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
        $chapter = $this->getGameStateValue('current_chapter');
        
        // Check if we're in a confrontation state (diceResult or resolveConfrontation)
        $state = $this->gamestate->state();
        $stateName = $state['name'] ?? '';
        $inConfrontation = in_array($stateName, ['diceResult', 'resolveConfrontation', 'confrontation']);
        
        // $this->trace("applySaskiaPower - state: $stateName, inConfrontation: " . ($inConfrontation ? 'yes' : 'no') . ", chapter: $chapter");
        
        if ($inConfrontation) {
            // During confrontation - use selected tile
            $tile_id = $this->getGameStateValue('selected_tile');
            $tile = $this->getObjectFromDB("SELECT * FROM tile WHERE tile_id = $tile_id");
            // $this->trace("applySaskiaPower - Using selected tile $tile_id");
        } else {
            // Outside confrontation - use player's current tile
            $player = $this->getObjectFromDB("SELECT player_position_q, player_position_r FROM player WHERE player_id = $player_id");
            if (!$player) {
                throw new BgaUserException($this->_("Player not found"));
            }
            $q = $player['player_position_q'];
            $r = $player['player_position_r'];
            // $this->trace("applySaskiaPower - Player at ($q, $r), chapter $chapter");
            
            $tile = $this->getObjectFromDB(
                "SELECT * FROM tile WHERE tile_q = $q AND tile_r = $r AND tile_chapter = $chapter"
            );
            
            if ($tile) {
                // $this->trace("applySaskiaPower - Found tile: subtype=" . ($tile['tile_subtype'] ?? 'unknown') . ", green_dice=" . ($tile['tile_green_dice'] ?? 0));
            }
        }
        
        if (!$tile) {
            throw new BgaUserException($this->_("No tile found"));
        }
        
        // Count green dice only
        $greenDice = (int)$tile['tile_green_dice'];
        // $this->trace("applySaskiaPower - greenDice: $greenDice");
        
        if ($greenDice !== 2) {
            throw new BgaUserException(sprintf(
                $this->_("Saskia's power requires exactly 2 green dice (this tile has %d)"),
                $greenDice
            ));
        }
        
        // Add +2 moral (max 9)
        $this->DbQuery("UPDATE player SET player_moral = LEAST(9, player_moral + 2) WHERE player_id = $player_id");
        
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
     * Osvaldo's power: If tile has exactly 3 green dice, gain +3 moral
     */
    private function applyOsvaldoPower(int $player_id): void
    {
        $chapter = $this->getGameStateValue('current_chapter');
        
        // Check if we're in a confrontation state
        $state = $this->gamestate->state();
        $stateName = $state['name'] ?? '';
        $inConfrontation = in_array($stateName, ['diceResult', 'resolveConfrontation', 'confrontation']);
        
        if ($inConfrontation) {
            // During confrontation - use selected tile
            $tile_id = $this->getGameStateValue('selected_tile');
            $tile = $this->getObjectFromDB("SELECT * FROM tile WHERE tile_id = $tile_id");
        } else {
            // Outside confrontation - use player's current tile
            $player = $this->getObjectFromDB("SELECT player_position_q, player_position_r FROM player WHERE player_id = $player_id");
            if (!$player) {
                throw new BgaUserException($this->_("Player not found"));
            }
            $q = $player['player_position_q'];
            $r = $player['player_position_r'];
            
            $tile = $this->getObjectFromDB(
                "SELECT * FROM tile WHERE tile_q = $q AND tile_r = $r AND tile_chapter = $chapter"
            );
        }
        
        if (!$tile) {
            throw new BgaUserException($this->_("No tile found"));
        }
        
        // Count green dice only
        $greenDice = (int)$tile['tile_green_dice'];
        
        if ($greenDice !== 3) {
            throw new BgaUserException(sprintf(
                $this->_("Osvaldo's power requires exactly 3 green dice (this tile has %d)"),
                $greenDice
            ));
        }
        
        // Add +3 moral (max 9)
        $this->DbQuery("UPDATE player SET player_moral = LEAST(9, player_moral + 3) WHERE player_id = $player_id");
        
        // Get new moral value
        $newMoral = (int)$this->getUniqueValueFromDB("SELECT player_moral FROM player WHERE player_id = $player_id");
        
        // Notify
        $this->notifyAllPlayers('moralChanged', clienttranslate('${player_name} gains +3 moral (Osvaldo\'s power)'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'moral' => $newMoral,
            'change' => 3
        ]);
    }
    
    /**
     * Baramas's power: If wind force = 3, gain +3 moral
     */
    private function applyBaramasPower(int $player_id): void
    {
        $chapter = $this->getGameStateValue('current_chapter');
        
        // Check if we're in a confrontation state
        $state = $this->gamestate->state();
        $stateName = $state['name'] ?? '';
        $inConfrontation = in_array($stateName, ['diceResult', 'resolveConfrontation', 'confrontation']);
        
        if ($inConfrontation) {
            // During confrontation - use selected tile
            $tile_id = $this->getGameStateValue('selected_tile');
            $tile = $this->getObjectFromDB("SELECT * FROM tile WHERE tile_id = $tile_id");
        } else {
            // Outside confrontation - use player's current tile
            $player = $this->getObjectFromDB("SELECT player_position_q, player_position_r FROM player WHERE player_id = $player_id");
            if (!$player) {
                throw new BgaUserException($this->_("Player not found"));
            }
            $q = $player['player_position_q'];
            $r = $player['player_position_r'];
            
            $tile = $this->getObjectFromDB(
                "SELECT * FROM tile WHERE tile_q = $q AND tile_r = $r AND tile_chapter = $chapter"
            );
        }
        
        if (!$tile) {
            throw new BgaUserException($this->_("No tile found"));
        }
        
        // Check wind force
        $windForce = (int)($tile['tile_wind_force'] ?? 0);
        
        if ($windForce !== 3) {
            throw new BgaUserException(sprintf(
                $this->_("Baramas's power requires wind force 3 (this tile has force %d)"),
                $windForce
            ));
        }
        
        // Add +3 moral (max 9)
        $this->DbQuery("UPDATE player SET player_moral = LEAST(9, player_moral + 3) WHERE player_id = $player_id");
        
        // Get new moral value
        $newMoral = (int)$this->getUniqueValueFromDB("SELECT player_moral FROM player WHERE player_id = $player_id");
        
        // Notify
        $this->notifyAllPlayers('moralChanged', clienttranslate('${player_name} gains +3 moral (Baramas\'s power)'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'moral' => $newMoral,
            'change' => 3
        ]);
    }
    
    /**
     * Check if player has another Torantor in their horde (excluding specified card)
     */
    private function hasAnotherTorantor(int $player_id, int $exclude_card_id): bool
    {
        // Get all hordiers in player's horde except the specified card
        $horde = $this->getObjectListFromDB(
            "SELECT card_type_arg FROM card WHERE card_location = 'horde_$player_id' AND card_id != $exclude_card_id"
        );
        
        foreach ($horde as $card) {
            $char_id = (int)$card['card_type_arg'];
            $char = $this->characters[$char_id] ?? null;
            if ($char && stripos($char['name'], 'Torantor') !== false) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * Roll an extra die and add it to the dice pool
     */
    private function rollExtraDie(int $player_id, string $type, string $power_name): array
    {
        // Roll the extra die
        $extra_dice = $this->rollDice(1, $type, 'player');
        
        // Store in database
        $stored_dice = $this->storeDiceRolls($extra_dice);
        
        // Notify
        $this->notifyAllPlayers('extraDiceRolled', clienttranslate('${player_name} rolls +1 ${dice_type} die (${power_name})'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'dice' => $stored_dice,
            'dice_type' => $type,
            'power_name' => $power_name
        ]);
        
        return $stored_dice;
    }
    
    /**
     * Xavio Torantor's power: Roll +1 die, if another Torantor ±1 on 1 die
     */
    private function applyXavioPower(int $player_id, int $card_id, array $params): void
    {
        // Roll +1 blue die
        $this->rollExtraDie($player_id, 'blue', 'Xavio Torantor');
        
        // Check for another Torantor
        if ($this->hasAnotherTorantor($player_id, $card_id)) {
            // Apply ±1 to specified die (client must pass dice_id and modifier in params)
            $dice_id = $params['dice_id'] ?? null;
            $modifier = $params['modifier'] ?? 0;
            
            if ($dice_id && ($modifier === 1 || $modifier === -1)) {
                $dice = $this->getObjectFromDB("SELECT * FROM dice_roll WHERE dice_id = $dice_id AND dice_owner = 'player'");
                if ($dice) {
                    $new_value = max(1, min(6, $dice['dice_value'] + $modifier));
                    $this->DbQuery("UPDATE dice_roll SET dice_value = $new_value WHERE dice_id = $dice_id");
                    
                    $this->notifyAllPlayers('diceModified', clienttranslate('${player_name} modifies a die by ${modifier} (Xavio Torantor bonus)'), [
                        'player_id' => $player_id,
                        'player_name' => $this->getActivePlayerName(),
                        'dice_id' => $dice_id,
                        'new_value' => $new_value,
                        'modifier' => ($modifier > 0 ? '+' : '') . $modifier
                    ]);
                }
            }
        }
    }
    
    /**
     * Yavo Torantor's power: Roll +1 die, if another Torantor +1 moral
     */
    private function applyYavoPower(int $player_id, int $card_id): void
    {
        // Roll +1 blue die
        $this->rollExtraDie($player_id, 'blue', 'Yavo Torantor');
        
        // Check for another Torantor
        if ($this->hasAnotherTorantor($player_id, $card_id)) {
            // Add +1 moral (max 9)
            $this->DbQuery("UPDATE player SET player_moral = LEAST(9, player_moral + 1) WHERE player_id = $player_id");
            
            // Get new moral value
            $newMoral = (int)$this->getUniqueValueFromDB("SELECT player_moral FROM player WHERE player_id = $player_id");
            
            $this->notifyAllPlayers('moralChanged', clienttranslate('${player_name} gains +1 moral (Yavo Torantor bonus)'), [
                'player_id' => $player_id,
                'player_name' => $this->getActivePlayerName(),
                'moral' => $newMoral,
                'change' => 1
            ]);
        }
    }
    
    /**
     * Kyo Torantor's power: Roll +1 die, if another Torantor rest this card
     */
    private function applyKyoPower(int $player_id, int $card_id): void
    {
        // Roll +1 blue die
        $this->rollExtraDie($player_id, 'blue', 'Kyo Torantor');
        
        // Check for another Torantor
        if ($this->hasAnotherTorantor($player_id, $card_id)) {
            // Rest Kyo (un-exhaust him)
            $this->DbQuery("UPDATE card SET card_power_used = 0 WHERE card_id = $card_id");
            
            // Get character name for notification
            $card = $this->getObjectFromDB("SELECT card_type_arg FROM card WHERE card_id = $card_id");
            $char_id = (int)$card['card_type_arg'];
            $char = $this->characters[$char_id] ?? ['name' => 'Kyo Torantor'];
            
            $this->notifyAllPlayers('hordierRested', clienttranslate('${character_name} is rested (Torantor bonus)'), [
                'player_id' => $player_id,
                'card_id' => $card_id,
                'character_name' => $char['name']
            ]);
        }
    }
    
    /**
     * Zaffa Torantor's power: Roll +1 violet die, rest another Torantor
     * Note: This is a discard power, so the card is already being discarded
     */
    private function applyZaffaPower(int $player_id, int $card_id, ?int $target_card_id): void
    {
        // Roll +1 violet die
        $this->rollExtraDie($player_id, 'violet', 'Zaffa Torantor');
        
        // Rest another Torantor (target_card_id)
        if ($target_card_id) {
            $target = $this->getObjectFromDB("SELECT * FROM card WHERE card_id = $target_card_id AND card_location = 'horde_$player_id'");
            if ($target) {
                $char_id = (int)$target['card_type_arg'];
                $char = $this->characters[$char_id] ?? null;
                
                // Check target is a Torantor
                if ($char && stripos($char['name'], 'Torantor') !== false) {
                    // Rest the target
                    $this->DbQuery("UPDATE card SET card_power_used = 0 WHERE card_id = $target_card_id");
                    
                    $this->notifyAllPlayers('hordierRested', clienttranslate('${character_name} is rested (Zaffa Torantor)'), [
                        'player_id' => $player_id,
                        'card_id' => $target_card_id,
                        'character_name' => $char['name']
                    ]);
                } else {
                    throw new BgaUserException($this->_("You must select another Torantor to rest"));
                }
            }
        }
    }
    
    /**
     * Gianni Raymondi's power: Set an existing blue horde die to chosen value
     */
    private function applyGianniPower(int $player_id, array $params): void
    {
        $dice_id = $params['dice_id'] ?? null;
        $dice_value = $params['dice_value'] ?? null;
        
        if ($dice_id === null) {
            throw new BgaUserException($this->_("You must select a die to modify"));
        }
        
        if ($dice_value === null || $dice_value < 1 || $dice_value > 6) {
            throw new BgaUserException($this->_("You must choose a die value between 1 and 6"));
        }
        
        // Check the die exists and belongs to player
        $dice = $this->getObjectFromDB("SELECT * FROM dice_roll WHERE dice_id = $dice_id AND dice_owner = 'player' AND dice_type = 'blue'");
        if (!$dice) {
            throw new BgaUserException($this->_("Invalid die selection"));
        }
        
        // Update the die value
        $this->DbQuery("UPDATE dice_roll SET dice_value = $dice_value WHERE dice_id = $dice_id");
        
        // Notify
        $this->notifyAllPlayers('diceModified', clienttranslate('${player_name} sets a die (Gianni Raymondi)'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'dice_id' => $dice_id,
            'new_value' => $dice_value
        ]);
    }
    
    /**
     * Wanda Pfeffer's power: Ignore 1 challenge die
     */
    private function applyWandaPower(int $player_id, array $params): void
    {
        $ignored_dice = $params['ignored_dice'] ?? [];
        
        if (empty($ignored_dice) || count($ignored_dice) !== 1) {
            throw new BgaUserException($this->_("You must select exactly 1 challenge die to ignore"));
        }
        
        // Get current ignored dice and add this one
        $current_ignored = json_decode($this->getGlobalVariable('uther_ignored_dice') ?? '[]', true);
        $current_ignored = array_merge($current_ignored, $ignored_dice);
        $this->setGlobalVariable('uther_ignored_dice', json_encode($current_ignored));
        
        $this->notifyAllPlayers('diceIgnored', clienttranslate('${player_name} ignores 1 challenge die (Wanda Pfeffer)'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'ignored_dice' => $ignored_dice,
            'count' => 1
        ]);
    }
    
    /**
     * Kunigunde Nosske's power: If sum of horde dice > challenge, ignore all white dice
     */
    private function applyKunigundePower(int $player_id): void
    {
        // Get all player dice (blue)
        $player_dice = $this->getObjectListFromDB("SELECT * FROM dice_roll WHERE dice_owner = 'player' AND dice_type = 'blue'");
        $player_sum = 0;
        foreach ($player_dice as $dice) {
            $player_sum += (int)$dice['dice_value'];
        }
        
        // Get all challenge dice (white + green + black)
        $challenge_dice = $this->getObjectListFromDB("SELECT * FROM dice_roll WHERE dice_owner = 'challenge'");
        $challenge_sum = 0;
        foreach ($challenge_dice as $dice) {
            $challenge_sum += (int)$dice['dice_value'];
        }
        
        if ($player_sum <= $challenge_sum) {
            throw new BgaUserException(sprintf(
                $this->_("Kunigunde's power requires horde dice sum (%d) > challenge sum (%d)"),
                $player_sum,
                $challenge_sum
            ));
        }
        
        // Find all white dice and ignore them
        $white_dice = $this->getObjectListFromDB("SELECT * FROM dice_roll WHERE dice_owner = 'challenge' AND dice_type = 'white'");
        
        if (empty($white_dice)) {
            throw new BgaUserException($this->_("No white dice to ignore"));
        }
        
        // Build list of white dice IDs to ignore
        $ignored_dice = [];
        foreach ($white_dice as $index => $dice) {
            $ignored_dice[] = 'white_' . $index;
        }
        
        // Add to ignored dice
        $current_ignored = json_decode($this->getGlobalVariable('uther_ignored_dice') ?? '[]', true);
        $current_ignored = array_merge($current_ignored, $ignored_dice);
        $this->setGlobalVariable('uther_ignored_dice', json_encode($current_ignored));
        
        $this->notifyAllPlayers('diceIgnored', clienttranslate('${player_name} ignores all white dice (Kunigunde Nosske)'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'ignored_dice' => $ignored_dice,
            'count' => count($ignored_dice)
        ]);
    }
    
    /**
     * Thomassin de Gaude's power: ±1 on each blue horde die
     * Client must pass dice_modifiers = array of {dice_id, modifier (+1 or -1)} for each die
     */
    private function applyThomassinPower(int $player_id, array $params): void
    {
        $dice_modifiers = $params['dice_modifiers'] ?? [];
        
        if (empty($dice_modifiers)) {
            throw new BgaUserException($this->_("You must specify modifiers for your dice"));
        }
        
        // Get only blue player dice
        $player_dice = $this->getObjectListFromDB("SELECT * FROM dice_roll WHERE dice_owner = 'player' AND dice_type = 'blue'");
        $player_dice_ids = array_column($player_dice, 'dice_id');
        
        // Apply each modifier
        foreach ($dice_modifiers as $mod) {
            $dice_id = (int)($mod['dice_id'] ?? 0);
            $modifier = (int)($mod['modifier'] ?? 0);
            
            if (!in_array($dice_id, $player_dice_ids)) {
                continue; // Skip invalid dice
            }
            
            if ($modifier !== 1 && $modifier !== -1) {
                continue; // Skip invalid modifier
            }
            
            $dice = $this->getObjectFromDB("SELECT * FROM dice_roll WHERE dice_id = $dice_id");
            if ($dice) {
                $new_value = max(1, min(6, $dice['dice_value'] + $modifier));
                $this->DbQuery("UPDATE dice_roll SET dice_value = $new_value WHERE dice_id = $dice_id");
            }
        }
        
        // Notify with all modified dice
        $this->notifyAllPlayers('diceModified', clienttranslate('${player_name} modifies all horde dice (Thomassin de Gaude)'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'dice_modifiers' => $dice_modifiers
        ]);
    }
    
    /**
     * Blanchette de Gaude's power: ±1 on blue horde dice, number of modifications = wind force
     * Client must pass dice_modifiers = array of {dice_id, modifier (+1 or -1)}
     */
    private function applyBlanchettePower(int $player_id, array $params): void
    {
        // Get wind force from current tile
        $tile_id = $this->getGameStateValue('selected_tile');
        $tile = $this->getObjectFromDB("SELECT * FROM tile WHERE tile_id = $tile_id");
        $wind_force = (int)($tile['tile_wind_force'] ?? 0);
        
        if ($wind_force <= 0) {
            throw new BgaUserException($this->_("No wind force on this tile"));
        }
        
        $dice_modifiers = $params['dice_modifiers'] ?? [];
        
        if (count($dice_modifiers) > $wind_force) {
            throw new BgaUserException(sprintf(
                $this->_("You can only modify %d dice (wind force)"),
                $wind_force
            ));
        }
        
        // Get only blue player dice
        $player_dice = $this->getObjectListFromDB("SELECT * FROM dice_roll WHERE dice_owner = 'player' AND dice_type = 'blue'");
        $player_dice_ids = array_column($player_dice, 'dice_id');
        
        // Apply each modifier
        foreach ($dice_modifiers as $mod) {
            $dice_id = (int)($mod['dice_id'] ?? 0);
            $modifier = (int)($mod['modifier'] ?? 0);
            
            if (!in_array($dice_id, $player_dice_ids)) {
                continue;
            }
            
            if ($modifier !== 1 && $modifier !== -1) {
                continue;
            }
            
            $dice = $this->getObjectFromDB("SELECT * FROM dice_roll WHERE dice_id = $dice_id");
            if ($dice) {
                $new_value = max(1, min(6, $dice['dice_value'] + $modifier));
                $this->DbQuery("UPDATE dice_roll SET dice_value = $new_value WHERE dice_id = $dice_id");
            }
        }
        
        $this->notifyAllPlayers('diceModified', clienttranslate('${player_name} modifies ${count} dice (Blanchette de Gaude)'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'dice_modifiers' => $dice_modifiers,
            'count' => count($dice_modifiers)
        ]);
    }
    
    /**
     * Waldo Waldmann's power: Ignore 1 challenge die per missing hordier
     * :tap:: Ignorez -1 :terrain: / :missing:
     */
    private function applyWaldoPower(int $player_id, array $params): void
    {
        $ignored_dice = $params['ignored_dice'] ?? [];
        
        // Waldo: can ignore 1 GREEN die per missing hordier
        $max_ignore = $this->getMissingHordiersCount($player_id);
        
        if (count($ignored_dice) > $max_ignore) {
            throw new BgaUserException(sprintf(
                $this->_("You can only ignore %d dice (1 per missing hordier)"),
                $max_ignore
            ));
        }
        
        if (empty($ignored_dice)) {
            return; // Nothing to ignore
        }
        
        // Validate that all selected dice are GREEN (terrain dice)
        foreach ($ignored_dice as $dice_id) {
            $dice = $this->getObjectFromDB("SELECT * FROM dice_roll WHERE dice_id = " . (int)$dice_id);
            if (!$dice || $dice['dice_type'] !== 'green') {
                throw new BgaUserException($this->_("Waldo can only ignore green terrain dice"));
            }
        }
        
        // Get current ignored dice and add these
        $current_ignored = json_decode($this->getGlobalVariable('uther_ignored_dice') ?? '[]', true);
        $current_ignored = array_merge($current_ignored, $ignored_dice);
        $this->setGlobalVariable('uther_ignored_dice', json_encode($current_ignored));
        
        $this->notifyAllPlayers('diceIgnored', clienttranslate('${player_name} ignores ${count} challenge dice (Waldo Waldmann)'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'ignored_dice' => $ignored_dice,
            'count' => count($ignored_dice)
        ]);
    }
    
    /**
     * Belkacem's power: Set a green terrain die to a chosen value
     * :tap:: Placez 1 :terrain: (set value of a green die)
     */
    private function applyBelkacemPower(int $player_id, array $params): void
    {
        $dice_id = $params['dice_id'] ?? null;
        $dice_value = $params['dice_value'] ?? null;
        
        if ($dice_id === null) {
            throw new BgaUserException($this->_("You must select a green die"));
        }
        
        if ($dice_value === null || $dice_value < 1 || $dice_value > 6) {
            throw new BgaUserException($this->_("You must choose a die value between 1 and 6"));
        }
        
        // Verify it's a green die (terrain dice are challenge dice)
        $dice = $this->getObjectFromDB("SELECT * FROM dice_roll WHERE dice_id = $dice_id AND dice_type = 'green'");
        if (!$dice) {
            throw new BgaUserException($this->_("Invalid die selection - must be a green terrain die"));
        }
        
        // Update the die value
        $this->DbQuery("UPDATE dice_roll SET dice_value = $dice_value WHERE dice_id = $dice_id");
        
        $this->notifyAllPlayers('diceModified', clienttranslate('${player_name} sets a green die to ${dice_value} (Belkacem)'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'dice_id' => $dice_id,
            'new_value' => $dice_value,
            'dice_value' => $dice_value
        ]);
    }
    
    /**
     * Benelim's power: Roll +1 horde die per PACK card in horde
     * :discard:: Lancez +1 :tous-mes-des: / :card: <b>PACK</b>.
     */
    private function applyBenelimPower(int $player_id): void
    {
        // Count PACK cards in player's horde (including Benelim himself who is TRAINE, not PACK)
        $pack_cards = $this->getObjectListFromDB(
            "SELECT c.card_id, c.card_type_arg FROM card c 
             WHERE c.card_location = 'horde_$player_id'"
        );
        
        $pack_count = 0;
        foreach ($pack_cards as $card) {
            $char_id = (int)$card['card_type_arg'];
            $char = $this->characters[$char_id] ?? null;
            if ($char && ($char['type'] ?? '') === CHAR_PACK) {
                $pack_count++;
            }
        }
        
        if ($pack_count === 0) {
            $this->notifyAllPlayers('message', clienttranslate('${player_name} has no PACK cards - Benelim has no effect'), [
                'player_name' => $this->getActivePlayerName()
            ]);
            return;
        }
        
        // Roll +1 blue die per PACK card
        for ($i = 0; $i < $pack_count; $i++) {
            $this->rollExtraDie($player_id, 'blue', 'Benelim');
        }
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
        
        // Check if this tile has challenge dice even without wind (like Porte d'Hurle)
        $hasChallengeWithoutWind = $this->tileHasChallengeWithoutWind($tile);
        
        // Cities and villages have no wind and no challenge
        if ($this->tileHasNoWind($tile) && !$hasChallengeWithoutWind) {
            $this->gamestate->nextState('noWind');
            return;
        }
        
        // Special case: tiles with no wind but still have challenge dice (Porte d'Hurle)
        if ($hasChallengeWithoutWind) {
            $this->rollChallengeForNoWindTile($tile_id, $tile);
            $this->gamestate->nextState('windRevealed');
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
     * Check if tile has no wind (no wind token)
     * Only cities and special terrains like Porte d'Hurle have no wind
     * Villages DO have wind tokens like normal terrain
     */
    private function tileHasNoWind(array $tile): bool
    {
        // Cities have no wind and no challenge
        if ($tile['tile_type'] == 'city') {
            return true;
        }
        
        // Villages HAVE wind - they draw a wind token like normal terrain
        // Only special terrains with no_wind flag (like Porte d'Hurle) have no wind
        return isset($this->terrain_types[$tile['tile_subtype']]['no_wind']) 
            && $this->terrain_types[$tile['tile_subtype']]['no_wind'];
    }
    
    /**
     * Check if tile has challenge dice even without wind token
     * This is only for special tiles like Porte d'Hurle (black dice only, no wind)
     */
    private function tileHasChallengeWithoutWind(array $tile): bool
    {
        $subtype = $tile['tile_subtype'];
        
        // Check terrain_types for special terrains like Porte d'Hurle
        if (isset($this->terrain_types[$subtype])) {
            $terrain = $this->terrain_types[$subtype];
            if (!isset($terrain['no_wind']) || !$terrain['no_wind']) {
                return false;
            }
            
            // Has challenge if any dice are required (Porte d'Hurle has black dice)
            $whiteDice = (int)($terrain['white_dice'] ?? 0);
            $greenDice = (int)($terrain['green_dice'] ?? 0);
            $blackDice = (int)($terrain['black_dice'] ?? 0);
            
            return ($whiteDice + $greenDice + $blackDice) > 0;
        }
        
        return false;
    }

    /**
     * Roll challenge dice for a tile with no wind token but has challenge dice
     * This handles villages (white dice) and special tiles like Porte d'Hurle (black dice)
     */
    private function rollChallengeForNoWindTile(int $tile_id, array $tile): void
    {
        // Wind force is 0 for no-wind tiles
        $force = 0;
        
        // Mark tile as discovered with wind_force = 0
        $this->DbQuery("UPDATE tile SET tile_wind_force = 0, tile_discovered = 1 WHERE tile_id = $tile_id");
        
        // Roll challenge dice based on tile definition
        $challenge_dice = $this->rollChallengeDice($tile, $force);
        
        // Store dice
        foreach ($challenge_dice as $dice) {
            $this->DbQuery("INSERT INTO dice_roll (dice_type, dice_value, dice_owner) 
                           VALUES ('{$dice['type']}', {$dice['value']}, '{$dice['owner']}')");
        }
        
        // Separate by type for notification
        $white_dice = array_filter($challenge_dice, fn($d) => $d['type'] == 'white');
        $green_dice = array_filter($challenge_dice, fn($d) => $d['type'] == 'green');
        $black_dice = array_filter($challenge_dice, fn($d) => $d['type'] == 'black');
        
        // Get terrain/village name
        $terrain_name = 'Unknown';
        if ($tile['tile_type'] == 'village' && isset($this->village_types[$tile['tile_subtype']])) {
            $terrain_name = $this->village_types[$tile['tile_subtype']]['name'];
        } elseif (isset($this->terrain_types[$tile['tile_subtype']])) {
            $terrain_name = $this->terrain_types[$tile['tile_subtype']]['name'];
        }
        
        $white_count = count($white_dice);
        $black_count = count($black_dice);
        
        // Choose appropriate message based on dice types
        if ($black_count > 0) {
            $message = clienttranslate('Entering ${terrain_name} - ${black_count} black dice! Match them with your violet dice.');
            $args = [
                'tile_id' => $tile_id,
                'force' => $force,
                'terrain_name' => $terrain_name,
                'black_count' => $black_count,
                'white_dice' => array_values($white_dice),
                'green_dice' => array_values($green_dice),
                'black_dice' => array_values($black_dice),
                'added_white_dice' => []
            ];
        } else {
            $message = clienttranslate('Entering ${terrain_name} - ${white_count} white dice challenge!');
            $args = [
                'tile_id' => $tile_id,
                'force' => $force,
                'terrain_name' => $terrain_name,
                'white_count' => $white_count,
                'white_dice' => array_values($white_dice),
                'green_dice' => array_values($green_dice),
                'black_dice' => array_values($black_dice),
                'added_white_dice' => []
            ];
        }
        
        $this->notifyAllPlayers('windRevealed', $message, $args);
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
        
        // $this->trace("stResolveConfrontation - wind_dice count before filter: " . count($wind_dice));
        // $this->trace("stResolveConfrontation - wind_dice keys: " . json_encode(array_keys($wind_dice)));
        
        // Filter out ignored dice (from Uther's power)
        $ignored_dice_json = $this->getGlobalVariable('uther_ignored_dice');
        // $this->trace("stResolveConfrontation - ignored_dice_json: " . ($ignored_dice_json ?? 'null'));
        
        if ($ignored_dice_json) {
            $ignored_dice = json_decode($ignored_dice_json, true) ?? [];
            // $this->trace("stResolveConfrontation - ignored_dice decoded: " . json_encode($ignored_dice));
            
            if (!empty($ignored_dice)) {
                // Convert to integers for comparison
                $ignored_dice_int = array_map('intval', $ignored_dice);
                // $this->trace("stResolveConfrontation - ignored_dice_int: " . json_encode($ignored_dice_int));
                
                $wind_dice = array_filter($wind_dice, function($dice) use ($ignored_dice_int) {
                    $dice_id = (int)$dice['dice_id'];
                    $keep = !in_array($dice_id, $ignored_dice_int, true);
                    return $keep;
                });
                // Clear the variable for next confrontation
                $this->setGlobalVariable('uther_ignored_dice', null);
            }
        }
        
        // $this->trace("stResolveConfrontation - wind_dice count after filter: " . count($wind_dice));
        
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
