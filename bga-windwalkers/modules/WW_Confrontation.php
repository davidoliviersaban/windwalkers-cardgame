<?php
/**
 * WW_Confrontation - Confrontation (dice rolling and wind) logic
 */

trait WW_Confrontation
{
    //////////////////////////////////////////////////////////////////////////////
    // Constants
    //////////////////////////////////////////////////////////////////////////////

    // Game limits
    const MAX_HORDE_SIZE = 8;
    const MAX_MORAL = 9;

    // Dice constraints
    const MIN_DICE_VALUE = 1;
    const MAX_DICE_VALUE = 6;
    const DEFAULT_DICE_COUNT = 6;

    // Moral bonuses (card powers)
    const DRAGON_MORAL_BONUS = 3;
    const SASKIA_MORAL_BONUS = 2;
    const OSVALDO_MORAL_BONUS = 3;
    const BARAMAS_MORAL_BONUS = 3;

    // Scoring multipliers
    const FUREVENT_SCORE_MULTIPLIER = 3;
    const PORTEDHURLE_SCORE_MULTIPLIER = 6;
    const HORDE_SCORE_MULTIPLIER = 2;

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
        $horde_count = (int) $this->getUniqueValueFromDB(
            "SELECT COUNT(*) FROM card WHERE card_location = 'horde_$player_id'"
        );
        return max(0, self::MAX_HORDE_SIZE - $horde_count);
    }

    function getCardDefinition(int $card_id, int $player_id): array
    {
        $card = $this->getObjectFromDB("SELECT * FROM card WHERE card_id = $card_id AND card_location = 'horde_$player_id'");
        if (!$card) {
            throw new BgaUserException($this->_("Invalid card ID"));
        }
        return $card;
    }

    /**
     * Common function to discard a traine card (self-discard powers)
     * Handles: moving to current tile, incrementing stat, sending notification
     * @param int $player_id Player ID
     * @param int $card_id Card ID to discard
     * @param bool $to_use_its_power Whether the card is discarded to use its power (default: true)
     */
    private function discardCard(int $player_id, int $card_id, bool $to_use_its_power = true): void
    {
        $card = $this->getCardDefinition($card_id, $player_id);
        // Get card info before moving
        $type_arg = (int) $card['card_type_arg'];
        $char_info = $this->characters[$type_arg] ?? ['name' => 'Hordier'];
        $character_name = $char_info['name'];

        // Move card to player's current tile (no more 'discard' pile)
        $tile_location = $this->getPlayerTileLocation($player_id);
        $this->cards->moveCard($card_id, $tile_location);

        // Increment hordiers lost stat
        $this->incStat(1, 'hordiers_lost', $player_id);

        // Notify about discard
        $to_use_its_power_string = $to_use_its_power ? "(to use its power)" : "";
        $this->notifyAllPlayers('hordierDiscarded', clienttranslate('${player_name} abandons ${character_name} ' . $to_use_its_power_string), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'card_id' => $card_id,
            'character_name' => $character_name
        ]);
    }

    /**
     * Common function to rest a card (untap)
     * Handles: validation of protected cards, updating DB, sending notification
     * @param int $player_id Player ID
     * @param int $card_id Card ID to rest
     * @param string $power_name Name of the power causing the rest (for notification)
     * @throws BgaUserException if card is protected
     */
    private function restCard(int $player_id, int $card_id, string $power_name = ''): void
    {
        // Check if card is protected (like Régitha after using her power)
        $protected_cards = json_decode($this->getGlobalVariable('protected_cards') ?? '[]', true);
        $protected_cards_int = array_map('intval', $protected_cards);
        if (in_array((int) $card_id, $protected_cards_int, true)) {
            throw new BgaUserException($this->_("This card cannot be rested"));
        }

        // Rest the card
        $this->DbQuery("UPDATE card SET card_power_used = 0 WHERE card_id = $card_id");

        // Get character info for notification
        $card = $this->getObjectFromDB("SELECT card_type_arg FROM card WHERE card_id = $card_id");
        $type_arg = (int) ($card['card_type_arg'] ?? 0);
        $char_info = $this->characters[$type_arg] ?? ['name' => 'Hordier'];
        $character_name = $char_info['name'];

        // Notify
        $message = $power_name
            ? clienttranslate('${character_name} is rested (${power_name})')
            : clienttranslate('${character_name} is rested');

        $this->notifyAllPlayers('hordierRested', $message, [
            'player_id' => $player_id,
            'card_id' => $card_id,
            'character_name' => $character_name,
            'power_name' => $power_name
        ]);
    }

    /**
     * Check if a card is protected (cannot be rested/discarded)
     * @param int $card_id Card ID to check
     * @return bool True if card is protected
     */
    private function isCardProtected(int $card_id): bool
    {
        $protected_cards = json_decode($this->getGlobalVariable('protected_cards') ?? '[]', true);
        $protected_cards_int = array_map('intval', $protected_cards);
        return in_array((int) $card_id, $protected_cards_int, true);
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

        // Clear any pending multi-step power state
        $this->setGlobalVariable('card_pending', null);

        $player = $this->getObjectFromDB("SELECT * FROM player WHERE player_id = $player_id");
        $surpass_count = (int) $player['player_surpass_count'];
        $base_dice = (int) $player['player_dice_count'];

        // Final dice count after surpass reduction
        $dice_count = max(0, $base_dice - $surpass_count);

        // Roll blue horde dice
        $horde_dice = $this->rollDice($dice_count, 'blue', 'player');

        // Get selected tile to check for black dice (fatalité)
        $tile_id = $this->getGameStateValue('selected_tile');
        $tile = $this->getObjectFromDB("SELECT * FROM tile WHERE tile_id = $tile_id");
        $black_dice_count = (int) ($tile['tile_black_dice'] ?? 0);

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

        $new_value = max(self::MIN_DICE_VALUE, min(self::MAX_DICE_VALUE, $dice['dice_value'] + $modifier));
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
        $surpass_count = (int) $player['player_surpass_count'];
        $base_dice = (int) $player['player_dice_count'];
        $dice_count = max(0, $base_dice - $surpass_count);

        $horde_dice = $this->rollDice($dice_count, 'blue', 'player');

        // Get selected tile to check for black dice (fatalité)
        $tile_id = $this->getGameStateValue('selected_tile');
        $tile = $this->getObjectFromDB("SELECT * FROM tile WHERE tile_id = $tile_id");
        $black_dice_count = (int) ($tile['tile_black_dice'] ?? 0);

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
        $moral = (int) $this->getUniqueValueFromDB("SELECT player_moral FROM player WHERE player_id = $player_id");
        $total_moral_cost = 0;
        $total_moral_gain = 0;  // Track potential moral gains from powers

        // First pass: validate all actions and calculate moral balance
        foreach ($actions_array as $action) {
            $type = $action['type'] ?? '';
            $params = $action['params'] ?? [];

            switch ($type) {
                case 'modifyDice':
                    $total_moral_cost += 1;
                    break;
                case 'usePower':
                    // Check card exists and belongs to player
                    $card_id = (int) ($params['card_id'] ?? 0);
                    $card = $this->getCardDefinition($card_id, $player_id);
                    if (!$card) {
                        throw new BgaUserException($this->_("Invalid card"));
                    }
                    // Calculate potential moral gain from this power
                    $total_moral_gain += $this->getPowerMoralGain($card_id, $player_id, $params);
                    break;
                case 'rerollAll':
                    $total_moral_cost += 1;
                    break;
            }
        }

        // Check total moral cost (moral + gains must exceed cost to keep at least 1)
        $effective_moral = $moral + $total_moral_gain;
        if ($total_moral_cost > 0 && $effective_moral <= $total_moral_cost) {
            throw new BgaUserException($this->_("Not enough moral for all actions"));
        }

        // Reorder actions: powers that give moral should be executed first
        usort($actions_array, function ($a, $b) use ($player_id) {
            $a_is_power = ($a['type'] ?? '') === 'usePower';
            $b_is_power = ($b['type'] ?? '') === 'usePower';

            // Powers before dice modifications
            if ($a_is_power && !$b_is_power)
                return -1;
            if (!$a_is_power && $b_is_power)
                return 1;

            // Among powers, moral-giving powers first
            if ($a_is_power && $b_is_power) {
                $a_gain = $this->getPowerMoralGain($a['params']['card_id'] ?? 0, $player_id, $a['params'] ?? []);
                $b_gain = $this->getPowerMoralGain($b['params']['card_id'] ?? 0, $player_id, $b['params'] ?? []);
                return $b_gain - $a_gain;  // Higher gain first
            }

            return 0;
        });

        // Second pass: execute all actions (powers first, then dice modifications)
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
        $new_moral = (int) $this->getUniqueValueFromDB("SELECT player_moral FROM player WHERE player_id = $player_id");
        $updated_dice = $this->getCollectionFromDb("SELECT * FROM dice_roll WHERE dice_owner = 'player'");

        // Get ignored dice IDs to send to client
        $ignored_dice_json = $this->getGlobalVariable('card_ignored_dice');
        $ignored_dice = $ignored_dice_json ? json_decode($ignored_dice_json, true) : [];

        if (count($actions_array) > 0) {
            $this->notifyAllPlayers('batchActionsApplied', clienttranslate('${player_name} applied ${count} actions'), [
                'player_id' => $player_id,
                'player_name' => $this->getActivePlayerName(),
                'count' => count($actions_array),
                'new_moral' => $new_moral,
                'updated_dice' => array_values($updated_dice),
                'ignored_dice' => $ignored_dice,
                'stay_in_confrontation' => !$andConfirm
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
     * Calculate potential moral gain from a power
     * Used during batch validation to allow spending moral gained from powers
     * @param int $card_id Card ID
     * @param int $player_id Player ID  
     * @param array $params Power parameters
     * @return int Potential moral gain (0 if power doesn't give moral)
     */
    private function getPowerMoralGain(int $card_id, int $player_id, array $params): int
    {
        if ($card_id <= 0)
            return 0;

        $card = $this->getObjectFromDB("SELECT * FROM card WHERE card_id = $card_id");
        if (!$card)
            return 0;

        $type_arg = (int) $card['card_type_arg'];
        $char_info = $this->characters[$type_arg] ?? null;
        if (!$char_info)
            return 0;

        $power_code = $char_info['power_code'] ?? '';

        switch ($power_code) {
            case 'dragon_power':
                // Dragon: +4 moral (requires target, so check if target provided)
                $target = $params['target_card_id'] ?? null;
                return $target ? self::DRAGON_MORAL_BONUS : 0;

            case 'saskia_power':
                // Saskia: +2 moral (if tile has exactly 2 green dice)
                return self::SASKIA_MORAL_BONUS;  // Assume conditions met; actual validation happens during execution

            case 'osvaldo_power':
                // Osvaldo: +3 moral (if tile has exactly 3 green dice)
                return self::OSVALDO_MORAL_BONUS;

            case 'baramas_power':
                // Baramas: +3 moral (if wind force = 3)
                return self::BARAMAS_MORAL_BONUS;

            case 'yavo_power':
                // Yavo: +1 moral if another Torantor exists
                if ($this->hasAnotherTorantor($player_id, $card_id)) {
                    return self::YAVO_MORAL_BONUS;
                }
                return 0;

            default:
                return 0;
        }
    }

    /**
     * Execute a single modifyDice action from batch
     */
    private function executeBatchModifyDice(int $player_id, array $params): void
    {
        $dice_id = (int) ($params['dice_id'] ?? 0);
        $modifier = (int) ($params['modifier'] ?? 0);

        if ($modifier != -1 && $modifier != 1) {
            throw new BgaUserException($this->_("Invalid modifier"));
        }

        $dice = $this->getObjectFromDB("SELECT * FROM dice_roll WHERE dice_id = $dice_id");
        if (!$dice || $dice['dice_owner'] != 'player') {
            throw new BgaUserException($this->_("Invalid dice"));
        }

        $new_value = max(self::MIN_DICE_VALUE, min(self::MAX_DICE_VALUE, $dice['dice_value'] + $modifier));
        $this->DbQuery("UPDATE dice_roll SET dice_value = $new_value WHERE dice_id = $dice_id");
        $this->DbQuery("UPDATE player SET player_moral = GREATEST(0, player_moral - 1) WHERE player_id = $player_id");
        $this->incStat(1, 'moral_spent', $player_id);
    }

    public function checkMultistepPower($char_info): void
    {
        $card_power_used = $char_info['card_power_used'] ?? 0;

        // This card was used and is single playable
        if ($card_power_used == 1 && !$char_info['has_multistep_power']) {
            throw new BgaUserException($this->_("Power already used"));
        }
        // This card was used and is single playable
        else if ($card_power_used == 2 && $char_info['has_multistep_power']) {
            throw new BgaUserException($this->_("Power already used"));
        }
    }

    public function useCardPower($card, int $times = 1): void
    {
        $card_power_used = $card['card_power_used'] ?? 0;
        $card_id = $card['card_id'];

        $this->DbQuery("UPDATE card SET card_power_used = " . ($card_power_used + $times) . " WHERE card_id = $card_id");
    }

    /**
     * Execute a single usePower action from batch
     */
    private function executeBatchUsePower(int $player_id, array $params): void
    {
        $card_id = (int) ($params['card_id'] ?? 0);
        $target_card_id = isset($params['target_card_id']) ? (int) $params['target_card_id'] : null;

        // Decode nested params if they are a JSON string
        $power_params = $params;
        if (isset($params['params']) && is_string($params['params'])) {
            $decoded = json_decode($params['params'], true);
            if (is_array($decoded)) {
                $power_params = array_merge($params, $decoded);
            }
        }

        // Check if this is step 2 of a multi-step Torantor power (Kyo, Xavio, Zaffa)
        // For Zaffa: card was discarded in step 1 (on player's tile), need to retrieve it
        // For Kyo/Xavio: card is still in horde
        $card_pending = json_decode($this->getGlobalVariable('card_pending') ?? '{}', true);
        // Only treat as step 2 if card_id matches the pending card
        $is_card_step2 = !empty($card_pending) && isset($card_pending['card_id']) && $card_id == $card_pending['card_id'];

        if ($is_card_step2) {
            // Step 2 of multi-step power
            // Try to get card from horde first (Kyo, Xavio), then from player's tile (Zaffa)
            $card = $this->getObjectFromDB("SELECT * FROM card WHERE card_id = $card_id AND card_location = 'horde_$player_id'");
            if (!$card) {
                // Card not in horde - try player's current tile (Zaffa discards to tile in step 1)
                $tile_location = $this->getPlayerTileLocation($player_id);
                $card = $this->getObjectFromDB("SELECT * FROM card WHERE card_id = $card_id AND card_location = '$tile_location'");
            }
            if (!$card) {
                throw new BgaUserException($this->_("Card not found"));
            }
        } else {
            // Normal case - card should be in horde
            // If card_pending was set for a different card, ignore it
            $card = $this->getCardDefinition($card_id, $player_id);
        }

        // Get character info
        $type_arg = (int) $card['card_type_arg'];
        $char_info = $this->characters[$type_arg] ?? null;
        $power_code = $char_info['power_code'] ?? '';
        $card_power_used = $card['card_power_used'] ?? 0;

        // For step 2 of discard powers, skip validation and tap (already done in step 1)
        if (!$is_card_step2) {
            // Check if power can be used (merge card and char_info for multistep check)
            $this->checkMultistepPower(array_merge($card, $char_info ?? []));

            // Powers that roll dice need to commit before rolling (no undo after server-side randomness)
            if ($char_info['has_dice_roll_power'] ?? false) {
                $this->undoSavePoint();
            }

            // Mark power as used (tap)
            $this->useCardPower($card);
        }

        // Apply power effect based on power_code
        $this->applyPowerEffect($player_id, $card_id, $power_code, $target_card_id, $power_params);

        // Increment powers_used stat
        $this->incStat(1, 'powers_used', $player_id);

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
                // Uther: :tap:: :discard: pour ignorer 3 :d6-black-white-green: / :missing:
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
                // Kyo Torantor: +1 dé, si autre Torantor repose un autre Torantor
                $this->applyKyoPower($player_id, $card_id, $target_card_id);
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
            case 'ukkiba_power':
                // Ukkiba Tomoshi: -1 moral, puis ±1 sur dés = moral restant
                $this->applyUkkibaPower($player_id, $params);
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
                $this->applyBenelimPower($player_id, $card_id);
                break;
            case 'galas_power':
                // Galas Thunderflayer: Si force = 6 (FUREVENT), rest-all (except himself)
                $this->applyGalasPower($player_id, $card_id);
                break;
            case 'oranne_power':
                // Oranne la Voyageuse: Si tuile avec moral, ignorez jusqu'à 3 dés challenge
                $this->applyOrannePower($player_id, $params);
                break;
            case 'ivana_power':
                // Ivana: Discard to ignore all challenge dice < wind force
                $this->applyIvanaPower($player_id, $card_id);
                break;
            case 'thutmus_power':
                // Thutmus: Roll exactly wind_force number of horde dice
                $this->applyThutmusPower($player_id);
                break;
            case 'amon_power':
                // Amon Amon: Ignore selected white dice (max = black dice count)
                $dice_ids = $params['dice_ids'] ?? [];
                $this->applyAmonPower($player_id, $dice_ids);
                break;
            case 'duke_power':
                // Duke Arnaud N.: Discard to place 2 of your dice
                $this->applyDukePower($player_id, $card_id, $params);
                break;
            case 'lethune_power':
                // Lethune de Prals: Roll +1 die per moral on tile
                $this->applyLethunePower($player_id);
                break;
            case 'regitha_power':
                // Régitha: Ignore ALL challenge dice, but can't be discarded/replaced/rested after
                $this->applyRegithaPower($player_id, $card_id);
                break;
            case 'lyara_power':
                // Lyara l'Inspirante: On villages, treat as city (ignore all dice, recruit any type)
                $this->applyLyaraPower($player_id, $card_id);
                break;
            case 'topilzin_power':
                // Topilzin: Discard to set wind force to 3
                $this->applyTopilzinPower($player_id, $card_id);
                break;
            case 'osuros_power':
                // Osuros: Discard to set wind force to 6 (FUREVENT)
                $this->applyOsurosPower($player_id, $card_id);
                break;
            case 'tula_power':
                // Tula: Discard to set wind force to 2
                $this->applyTulaPower($player_id, $card_id);
                break;
            case 'charlize_power':
                // Charlize Soulages: Discard to gain +2 moral per black die
                $this->applyCharlizePower($player_id, $card_id);
                break;
            case 'jonas_power':
                // Jonas: Choose wind token from bag (place on current tile)
                $this->applyJonasPower($player_id, $card_id, $params);
                break;
            case 'lihn_power':
                // Lihn: Double points gained this turn
                $this->applyLihnPower($player_id, $card_id);
                break;
            case 'dragon_power':
                // Dragon: Tap another hordier to gain +4 moral
                $this->applyDragonPower($player_id, $card_id, $target_card_id);
                break;
            case 'kon_power':
                // Kon: Reroll all or some blue dice (horde dice)
                $this->applyKonPower($player_id, $params);
                break;

            // Add more powers here as they are implemented
            default:
                // Unknown or unimplemented power - no effect
                break;
        }
    }

    /**
     * Kon's power: Reroll all or some blue dice (horde dice)
     * :tap:: Relancez tout ou partie de :d6-blue:
     */
    private function applyKonPower(int $player_id, array $params): void
    {
        // Get dice IDs to reroll from params
        $dice_ids = $params['dice_ids'] ?? [];

        if (empty($dice_ids)) {
            throw new BgaUserException($this->_("You must select at least one die to reroll"));
        }

        // Validate all dice are blue and belong to player
        $dice_ids_sql = implode(',', array_map('intval', $dice_ids));
        $valid_dice = $this->getCollectionFromDb(
            "SELECT dice_id FROM dice_roll WHERE dice_id IN ($dice_ids_sql) AND dice_type = 'blue' AND dice_owner = 'player'"
        );

        if (count($valid_dice) !== count($dice_ids)) {
            throw new BgaUserException($this->_("Invalid dice selection - only blue dice can be rerolled"));
        }

        // Delete selected dice
        $this->DbQuery("DELETE FROM dice_roll WHERE dice_id IN ($dice_ids_sql)");

        // Roll new blue dice
        $count = count($dice_ids);
        $new_dice = $this->rollDice($count, 'blue', 'player');
        $stored_dice = $this->storeDiceRolls($new_dice);

        // Notify with removed IDs and new dice
        $this->notifyAllPlayers('selectedDiceRerolled', clienttranslate('${player_name} uses Kon\'s power to reroll ${count} blue dice'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'count' => $count,
            'removed_dice_ids' => array_map('intval', $dice_ids),
            'new_dice' => $stored_dice
        ]);
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

        $wind_force = (int) ($tile['tile_wind_force'] ?? 0);

        // Check if it's a FUREVENT (force = 6)
        if ($wind_force != 6) {
            throw new BgaUserException($this->_("This power only works on FUREVENT tiles (wind force 6)"));
        }

        // Get protected cards (like Régitha after using her power)
        $protected_cards = json_decode($this->getGlobalVariable('protected_cards') ?? '[]', true);

        // Build list of cards to exclude from resting
        $exclude_ids = [$galas_card_id];
        if (!empty($protected_cards)) {
            $exclude_ids = array_merge($exclude_ids, array_map('intval', $protected_cards));
        }

        // Also find any exhausted Régitha cards - they can NEVER rest
        $regitha_type_arg = null;
        foreach ($this->characters as $type_arg => $char) {
            if (($char['power_code'] ?? '') === 'regitha_power') {
                $regitha_type_arg = $type_arg;
                break;
            }
        }
        if ($regitha_type_arg !== null) {
            $exhausted_regitha = $this->getObjectFromDB(
                "SELECT card_id FROM card WHERE card_location = 'horde_$player_id' 
                 AND card_type_arg = $regitha_type_arg AND card_power_used = 1"
            );
            if ($exhausted_regitha) {
                $exclude_ids[] = (int) $exhausted_regitha['card_id'];
            }
        }

        $exclude_ids = array_unique($exclude_ids);
        $exclude_sql = implode(',', $exclude_ids);

        // Rest all hordiers EXCEPT Galas himself and protected cards (set card_power_used = 0)
        $sql = "UPDATE card SET card_power_used = 0 WHERE card_location = 'horde_$player_id' AND card_id NOT IN ($exclude_sql)";
        $this->DbQuery($sql);

        // Get list of cards that were rested for the notification
        $rested_cards = $this->getObjectListFromDB("SELECT card_id FROM card WHERE card_location = 'horde_$player_id' AND card_id NOT IN ($exclude_sql)");
        $rested_ids = array_map(function ($c) {
            return (int) $c['card_id'];
        }, $rested_cards);

        // Notify all players
        $this->notifyAllPlayers('allHordiersRested', clienttranslate('\${player_name} uses Galas\' power: All other hordiers are rested!'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'except_card_id' => $galas_card_id,
            'rested_cards' => $rested_ids
        ]);
    }

    /**
     * Oranne la Voyageuse's power: If tile has moral effect, ignore up to 3 challenge dice
     * :tap:: Si :tuile: avec :moral: alors ignorez -3 :d6-black-white-green:
     */
    private function applyOrannePower(int $player_id, array $params): void
    {
        // Get the selected tile to check moral effect
        $tile_id = $this->getGameStateValue('selected_tile');
        if (!$tile_id) {
            throw new BgaUserException($this->_("No tile selected"));
        }

        $tile = $this->getObjectFromDB("SELECT * FROM tile WHERE tile_id = $tile_id");
        if (!$tile) {
            throw new BgaUserException($this->_("Tile not found"));
        }

        $moral_effect = (int) ($tile['tile_moral_effect'] ?? 0);

        // Check if tile has any moral effect (positive or negative)
        if ($moral_effect == 0) {
            throw new BgaUserException($this->_("This power only works on tiles with a moral effect"));
        }

        $ignored_dice = $params['ignored_dice'] ?? [];

        if (empty($ignored_dice)) {
            return; // Nothing to ignore
        }

        // Max 3 dice can be ignored
        if (count($ignored_dice) > self::ORANNE_MAX_IGNORE_DICE) {
            throw new BgaUserException($this->_("You can only ignore up to " . self::ORANNE_MAX_IGNORE_DICE . " dice"));
        }

        // Get current ignored dice and merge
        $current_ignored = json_decode($this->getGlobalVariable('card_ignored_dice') ?? '[]', true);
        $current_ignored = array_merge($current_ignored, $ignored_dice);
        $this->setGlobalVariable('card_ignored_dice', json_encode($current_ignored));

        // Notify all players
        $this->notifyAllPlayers('diceIgnored', clienttranslate('${player_name} uses Oranne\'s power: ${count} challenge dice ignored!'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'ignored_dice' => $ignored_dice,
            'count' => count($ignored_dice)
        ]);
    }

    /**
     * Ivana's power: Discard to ignore all challenge dice with value < wind force
     * :discard:: Ignorez :d6-black-white-green: < à :force-x:
     */
    private function applyIvanaPower(int $player_id, int $card_id): void
    {
        // Get wind force
        $tile_id = $this->getGameStateValue('selected_tile');
        if (!$tile_id) {
            throw new BgaUserException($this->_("No tile selected"));
        }

        $tile = $this->getObjectFromDB("SELECT * FROM tile WHERE tile_id = $tile_id");
        if (!$tile) {
            throw new BgaUserException($this->_("Tile not found"));
        }

        $wind_force = (int) ($tile['tile_wind_force'] ?? 0);

        if ($wind_force <= 1) {
            throw new BgaUserException($this->_("Wind force must be greater than 1 to use this power"));
        }

        // Get all challenge dice with value < wind_force
        $challenge_dice = $this->getCollectionFromDb("SELECT * FROM dice_roll WHERE dice_owner = 'challenge' AND dice_value < $wind_force");

        if (empty($challenge_dice)) {
            throw new BgaUserException($this->_("No challenge dice with value less than wind force"));
        }

        // Discard Ivana using common function
        $this->discardCard($player_id, $card_id, true);

        // Build list of dice IDs to ignore
        $ignored_dice = array_keys($challenge_dice);

        // Add to ignored dice
        $current_ignored = json_decode($this->getGlobalVariable('card_ignored_dice') ?? '[]', true);
        $current_ignored = array_merge($current_ignored, $ignored_dice);
        $this->setGlobalVariable('card_ignored_dice', json_encode($current_ignored));

        // Notify all players
        $this->notifyAllPlayers('diceIgnored', clienttranslate('${player_name} uses Ivana\'s power: All dice with value < ${wind_force} are ignored! (${count} dice)'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'ignored_dice' => $ignored_dice,
            'count' => count($ignored_dice),
            'wind_force' => $wind_force
        ]);
    }

    /**
     * Thutmus's power: Roll exactly wind_force number of BLUE horde dice
     * :tap:: Lancez autant :d6-blue: / Force :force-x:, ni plus, ni moins.
     * Only affects blue dice, violet dice are kept
     */
    private function applyThutmusPower(int $player_id): void
    {
        // Get wind force
        $tile_id = $this->getGameStateValue('selected_tile');
        if (!$tile_id) {
            throw new BgaUserException($this->_("No tile selected"));
        }

        $tile = $this->getObjectFromDB("SELECT * FROM tile WHERE tile_id = $tile_id");
        if (!$tile) {
            throw new BgaUserException($this->_("Tile not found"));
        }

        $wind_force = (int) ($tile['tile_wind_force'] ?? 0);

        if ($wind_force <= 0) {
            throw new BgaUserException($this->_("No wind force on this tile"));
        }

        // Clear ONLY blue horde dice (keep violet dice from Torantor powers)
        $this->DbQuery("DELETE FROM dice_roll WHERE dice_owner = 'player' AND dice_type = 'blue'");

        // Roll exactly wind_force number of blue dice
        $new_dice = [];
        for ($i = 0; $i < $wind_force; $i++) {
            $value = bga_rand(1, 6);
            $this->DbQuery("INSERT INTO dice_roll (dice_type, dice_value, dice_owner) VALUES ('blue', $value, 'player')");
            $dice_id = $this->DbGetLastId();
            $new_dice[] = [
                'id' => $dice_id,
                'type' => 'blue',
                'value' => $value
            ];
        }

        // Notify all players about the new dice (this will replace blue dice in UI)
        $this->notifyAllPlayers('blueDiceRerolled', clienttranslate('${player_name} uses Thutmus\' power: Rolling exactly ${count} blue horde dice (equal to wind force)'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'dice' => $new_dice,
            'count' => $wind_force
        ]);
    }

    /**
     * Amon Amon's power: Ignore selected white dice (1 per black die max)
     * :tap:: Ignorez :d6-white: / :d6-black:
     */
    private function applyAmonPower(int $player_id, array $dice_ids): void
    {
        // Count black dice (fatalite)
        $black_dice = $this->getCollectionFromDb("SELECT * FROM dice_roll WHERE dice_owner = 'challenge' AND dice_type = 'black'");
        $black_count = count($black_dice);

        if ($black_count == 0) {
            throw new BgaUserException($this->_("No black dice (fatalité) - cannot use this power"));
        }

        if (empty($dice_ids)) {
            throw new BgaUserException($this->_("No dice selected to ignore"));
        }

        // Validate: can't ignore more than black dice count
        if (count($dice_ids) > $black_count) {
            throw new BgaUserException($this->_("Cannot ignore more white dice than black dice"));
        }

        // Validate selected dice are actually white dice
        $white_dice = $this->getCollectionFromDb("SELECT * FROM dice_roll WHERE dice_owner = 'challenge' AND dice_type = 'white'");

        foreach ($dice_ids as $dice_id) {
            if (!isset($white_dice[$dice_id])) {
                throw new BgaUserException($this->_("Invalid die selected - must be a white die"));
            }
        }

        // Add to ignored dice
        $current_ignored = json_decode($this->getGlobalVariable('card_ignored_dice') ?? '[]', true);
        $current_ignored = array_merge($current_ignored, $dice_ids);
        $this->setGlobalVariable('card_ignored_dice', json_encode($current_ignored));

        // Notify all players
        $this->notifyAllPlayers('diceIgnored', clienttranslate('${player_name} uses Amon Amon\'s power: ${count} white dice ignored'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'ignored_dice' => $dice_ids,
            'count' => count($dice_ids)
        ]);
    }

    /**
     * Duke Arnaud N.'s power: Discard to place (set values of) 2 of your dice
     * :discard:: Placez 2 :d6-blue-violet:
     */
    private function applyDukePower(int $player_id, int $card_id, array $params): void
    {
        $dice_selections = $params['dice_selections'] ?? [];

        if (count($dice_selections) !== 2) {
            throw new BgaUserException($this->_("You must select exactly 2 dice to set"));
        }

        // Validate and update each die
        $modified_dice = [];
        foreach ($dice_selections as $selection) {
            $dice_id = $selection['dice_id'] ?? null;
            $dice_value = $selection['dice_value'] ?? null;

            if ($dice_id === null || $dice_value === null) {
                throw new BgaUserException($this->_("Invalid dice selection"));
            }

            if ($dice_value < self::MIN_DICE_VALUE || $dice_value > self::MAX_DICE_VALUE) {
                throw new BgaUserException($this->_("Dice value must be between 1 and 6"));
            }

            // Check the die exists and belongs to player (blue or violet dice)
            $dice = $this->getObjectFromDB("SELECT * FROM dice_roll WHERE dice_id = $dice_id AND dice_owner = 'player' AND dice_type IN ('blue', 'violet')");
            if (!$dice) {
                throw new BgaUserException($this->_("Invalid die selection - you can only modify your blue or violet dice"));
            }

            // Update the die value
            $this->DbQuery("UPDATE dice_roll SET dice_value = $dice_value WHERE dice_id = $dice_id");
            $modified_dice[] = [
                'dice_id' => $dice_id,
                'new_value' => $dice_value
            ];
        }

        // Discard Duke using common function
        $this->discardCard($player_id, $card_id, true);

        // Notify about dice modification (one notification per die to reuse existing handler)
        foreach ($modified_dice as $dice) {
            $this->notifyAllPlayers('diceModified', clienttranslate('${player_name} sets a die to ${new_value} (Duke)'), [
                'player_id' => $player_id,
                'player_name' => $this->getActivePlayerName(),
                'dice_id' => $dice['dice_id'],
                'new_value' => $dice['new_value']
            ]);
        }
    }

    /**
     * Lethune de Prals's power: Roll +1 blue die per moral on tile
     * :tap:: Lancez +1 :d6-blue: / :moral: sur :tuile:
     * Only works on tiles with POSITIVE moral effect (not deserts with negative moral)
     */
    private function applyLethunePower(int $player_id): void
    {
        // Get the selected tile
        $tile_id = $this->getGameStateValue('selected_tile');
        if (!$tile_id) {
            throw new BgaUserException($this->_("No tile selected"));
        }

        $tile = $this->getObjectFromDB("SELECT * FROM tile WHERE tile_id = $tile_id");
        if (!$tile) {
            throw new BgaUserException($this->_("Tile not found"));
        }

        // Get tile's moral effect from terrain_types (authoritative source)
        // DO NOT use abs() - power only works on tiles with POSITIVE moral
        $subtype = $tile['tile_subtype'];
        $moral_effect = 0;
        if (isset($this->terrain_types[$subtype])) {
            $moral_effect = (int) ($this->terrain_types[$subtype]['moral_effect'] ?? 0);
        } elseif (isset($this->village_types[$subtype])) {
            $moral_effect = (int) ($this->village_types[$subtype]['moral_effect'] ?? 0);
        }
        $moral_effect = abs($moral_effect);

        if ($moral_effect <= 0) {
            throw new BgaUserException($this->_("This tile has no moral bonus - cannot use Lethune's power"));
        }

        // Roll +1 blue die per moral on tile
        for ($i = 0; $i < $moral_effect; $i++) {
            $this->rollExtraDie($player_id, 'blue', 'Lethune de Prals');
        }

        // Notify
        $this->notifyAllPlayers('message', clienttranslate('${player_name} uses Lethune de Prals: +${count} dice (${moral} moral on tile)'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'count' => $moral_effect,
            'moral' => $moral_effect
        ]);
    }

    /**
     * Uther's power: Sacrifice another Hordier to ignore challenge dice
     * :tap:: :discard: pour ignorer 3 :d6-black-white-green: / :missing:
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
        $target_type_arg = (int) $target_card['card_type_arg'];
        $target_char = $this->characters[$target_type_arg] ?? null;
        $target_name = $target_char['name'] ?? 'Unknown';

        // Discard the target
        $this->discardCard($player_id, $target_card_id, false);

        // Get ignored dice from params
        $ignored_dice = $params['ignored_dice'] ?? [];

        if (!empty($ignored_dice)) {
            // Uther: can ignore 3 dice per missing hordier
            $missing_count = $this->getMissingHordiersCount($player_id);
            $max_ignore = self::UTHER_IGNORE_DICE * $missing_count;

            // Validate not ignoring more than allowed
            if (count($ignored_dice) > $max_ignore) {
                throw new BgaUserException(sprintf($this->_("You can only ignore %d dice"), $max_ignore));
            }

            // Get current ignored dice and merge with new ones (to support multiple ignore powers)
            $current_ignored = json_decode($this->getGlobalVariable('card_ignored_dice') ?? '[]', true);
            $current_ignored = array_merge($current_ignored, $ignored_dice);

            // Store ignored dice IDs for confrontation calculation
            $this->setGlobalVariable('card_ignored_dice', json_encode($current_ignored));

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
        $greenDice = (int) $tile['tile_green_dice'];
        // $this->trace("applySaskiaPower - greenDice: $greenDice");

        if ($greenDice !== 2) {
            throw new BgaUserException(sprintf(
                $this->_("Saskia's power requires exactly 2 green dice (this tile has %d)"),
                $greenDice
            ));
        }

        // Add +2 moral (max 9)
        $this->DbQuery("UPDATE player SET player_moral = LEAST(" . self::MAX_MORAL . ", player_moral + " . self::SASKIA_MORAL_BONUS . ") WHERE player_id = $player_id");

        // Get new moral value
        $newMoral = (int) $this->getUniqueValueFromDB("SELECT player_moral FROM player WHERE player_id = $player_id");

        // Notify
        $this->notifyAllPlayers('moralChanged', clienttranslate('${player_name} gains +${change} moral (Saskia\'s power)'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'moral' => $newMoral,
            'change' => self::SASKIA_MORAL_BONUS
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
        $greenDice = (int) $tile['tile_green_dice'];

        if ($greenDice !== 3) {
            throw new BgaUserException(sprintf(
                $this->_("Osvaldo's power requires exactly 3 green dice (this tile has %d)"),
                $greenDice
            ));
        }

        // Add +3 moral (max 9)
        $this->DbQuery("UPDATE player SET player_moral = LEAST(" . self::MAX_MORAL . ", player_moral + " . self::OSVALDO_MORAL_BONUS . ") WHERE player_id = $player_id");

        // Get new moral value
        $newMoral = (int) $this->getUniqueValueFromDB("SELECT player_moral FROM player WHERE player_id = $player_id");

        // Notify
        $this->notifyAllPlayers('moralChanged', clienttranslate('${player_name} gains +${change} moral (Osvaldo\'s power)'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'moral' => $newMoral,
            'change' => self::OSVALDO_MORAL_BONUS
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
        $windForce = (int) ($tile['tile_wind_force'] ?? 0);

        if ($windForce !== 3) {
            throw new BgaUserException(sprintf(
                $this->_("Baramas's power requires wind force 3 (this tile has force %d)"),
                $windForce
            ));
        }

        // Add +3 moral (max 9)
        $this->DbQuery("UPDATE player SET player_moral = LEAST(" . self::MAX_MORAL . ", player_moral + " . self::BARAMAS_MORAL_BONUS . ") WHERE player_id = $player_id");

        // Get new moral value
        $newMoral = (int) $this->getUniqueValueFromDB("SELECT player_moral FROM player WHERE player_id = $player_id");

        // Notify
        $this->notifyAllPlayers('moralChanged', clienttranslate('${player_name} gains +${change} moral (Baramas\'s power)'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'moral' => $newMoral,
            'change' => self::BARAMAS_MORAL_BONUS
        ]);
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
     * Check if player has another Torantor in their horde (excluding specified card)
     */
    private function hasAnotherTorantor(int $player_id, int $exclude_card_id): bool
    {
        // Get all hordiers in player's horde except the specified card
        $horde = $this->getObjectListFromDB(
            "SELECT card_type_arg FROM card WHERE card_location = 'horde_$player_id' AND card_id != $exclude_card_id"
        );

        foreach ($horde as $card) {
            $char_id = (int) $card['card_type_arg'];
            $char = $this->characters[$char_id] ?? null;
            if ($char && stripos($char['name'], 'Torantor') !== false) {
                return true;
            }
        }
        return false;
    }

    /**
     * Xavio Torantor's power: Roll +1 die, if another Torantor ±1 on 1 die
     */
    private function applyXavioPower(int $player_id, int $card_id, array $params): void
    {
        // Roll +1 blue die when no adjustment specified
        if (!isset($params['adjust_die_id'])) {
            $this->rollExtraDie($player_id, 'blue', 'Xavio Torantor');

            // Store pending state for step 2 if there are other Torantors
            if ($this->hasAnotherTorantor($player_id, $card_id)) {
                $this->setGlobalVariable('card_pending', json_encode([
                    'player_id' => $player_id,
                    'card_id' => $card_id
                ]));
            }
            // If no other Torantor, the power is complete (die was rolled, card already tapped in executeBatchUsePower)
            return;
        }

        // Step 2: Apply ±1 to a die (adjust_die_id provided)
        // Clear pending state
        $this->setGlobalVariable('card_pending', null);

        // Check for another Torantor
        if ($this->hasAnotherTorantor($player_id, $card_id)) {
            $dice_id = $params['dice_id'] ?? null;
            $modifier = $params['modifier'] ?? 0;

            if ($dice_id && ($modifier === 1 || $modifier === -1)) {
                $dice = $this->getObjectFromDB("SELECT * FROM dice_roll WHERE dice_id = $dice_id AND dice_owner = 'player'");
                if ($dice) {
                    $new_value = max(self::MIN_DICE_VALUE, min(self::MAX_DICE_VALUE, $dice['dice_value'] + $modifier));
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
        // Roll +1 blue die when no target specified
        $this->rollExtraDie($player_id, 'blue', 'Yavo Torantor');

        // Check for another Torantor
        if ($this->hasAnotherTorantor($player_id, $card_id)) {
            // Add +1 moral (max 9)
            $this->DbQuery("UPDATE player SET player_moral = LEAST(" . self::MAX_MORAL . ", player_moral + 1) WHERE player_id = $player_id");

            // Get new moral value
            $newMoral = (int) $this->getUniqueValueFromDB("SELECT player_moral FROM player WHERE player_id = $player_id");

            $this->notifyAllPlayers('moralChanged', clienttranslate('${player_name} gains +1 moral (Yavo Torantor bonus)'), [
                'player_id' => $player_id,
                'player_name' => $this->getActivePlayerName(),
                'moral' => $newMoral,
                'change' => 1
            ]);
        }
    }

    /**
     * Kyo Torantor's power: Roll +1 die, if another Torantor exists, rest another Torantor
     */
    private function applyKyoPower(int $player_id, int $card_id, ?int $target_card_id): void
    {
        // Roll +1 blue die when no target specified
        if (!$target_card_id) {
            $this->rollExtraDie($player_id, 'blue', 'Kyo Torantor');

            // Store pending state for step 2 if there are other Torantors
            if ($this->hasAnotherTorantor($player_id, $card_id)) {
                $this->setGlobalVariable('card_pending', json_encode([
                    'player_id' => $player_id,
                    'card_id' => $card_id
                ]));
            }
            // If no other Torantor, the power is complete (die was rolled, card already tapped in executeBatchUsePower)
            return;
        }

        // Step 2: Rest another Torantor (target_card_id provided)
        // Clear pending state
        $this->setGlobalVariable('card_pending', null);

        // Check for another Torantor and if target was provided
        if ($this->hasAnotherTorantor($player_id, $card_id) && $target_card_id) {
            // Validate target is another Torantor (not Kyo himself)
            if ($target_card_id == $card_id) {
                throw new BgaUserException($this->_("Kyo cannot rest himself"));
            }

            $target = $this->getObjectFromDB("SELECT * FROM card WHERE card_id = $target_card_id AND card_location = 'horde_$player_id'");
            if (!$target) {
                throw new BgaUserException($this->_("Invalid target card"));
            }

            $char_id = (int) $target['card_type_arg'];
            $char = $this->characters[$char_id] ?? null;

            // Check target is a Torantor
            if (!$char || stripos($char['name'], 'Torantor') === false) {
                throw new BgaUserException($this->_("Target must be a Torantor"));
            }

            // Rest the target Torantor (will throw if protected)
            $this->restCard($player_id, $target_card_id, 'Kyo Torantor');
        }
    }

    /**
     * Zaffa Torantor's power: Roll +1 violet die, rest another Torantor
     * This is a 2-step DISCARD power:
     * Step 1: Roll the violet die AND discard Zaffa, store pending state
     * Step 2: Select another Torantor to rest (card already discarded)
     */
    private function applyZaffaPower(int $player_id, int $card_id, ?int $target_card_id): void
    {
        // Step 1: Roll violet die and discard (no target selected yet)
        if (!$target_card_id) {
            $this->rollExtraDie($player_id, 'violet', 'Zaffa Torantor');

            // Discard Card
            $this->discardCard($player_id, $card_id, true);

            // Store pending state for step 2 if there are other Torantors to rest
            if ($this->hasAnotherTorantor($player_id, $card_id)) {
                // Store pending state for step 2
                $this->setGlobalVariable('card_pending', json_encode([
                    'player_id' => $player_id,
                    'card_id' => $card_id
                ]));
            }
            // There are no other Torantors to rest so complete the power immediately
            else {
                $card = $this->getCardDefinition($card_id, $player_id);
                $this->useCardPower($card);
            }
            // If no other Torantor, the power is complete (violet die was rolled, Zaffa discarded)
            return;
        }

        // Step 2: Rest another Torantor (target_card_id)
        // Clear pending state
        $this->setGlobalVariable('card_pending', null);

        $target = $this->getObjectFromDB("SELECT * FROM card WHERE card_id = $target_card_id AND card_location = 'horde_$player_id'");
        if ($target) {
            $char_id = (int) $target['card_type_arg'];
            $char = $this->characters[$char_id] ?? null;

            // Check target is a Torantor
            if ($char && stripos($char['name'], 'Torantor') !== false) {
                // Rest the target (will throw if protected)
                $this->restCard($player_id, $target_card_id, 'Zaffa Torantor');
            } else {
                throw new BgaUserException($this->_("You must select another Torantor to rest"));
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

        if ($dice_value === null || $dice_value < self::MIN_DICE_VALUE || $dice_value > self::MAX_DICE_VALUE) {
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
        $current_ignored = json_decode($this->getGlobalVariable('card_ignored_dice') ?? '[]', true);
        $current_ignored = array_merge($current_ignored, $ignored_dice);
        $this->setGlobalVariable('card_ignored_dice', json_encode($current_ignored));

        $this->notifyAllPlayers('diceIgnored', clienttranslate('${player_name} ignores 1 challenge die (Wanda Pfeffer)'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'ignored_dice' => $ignored_dice,
            'count' => 1
        ]);
    }

    /**
     * Kunigunde Nosske's power: If sum of horde dice >= white+green dice, ignore all white dice
     */
    private function applyKunigundePower(int $player_id): void
    {
        // Get already ignored dice
        $current_ignored = json_decode($this->getGlobalVariable('card_ignored_dice') ?? '[]', true);
        $ignored_ids_str = empty($current_ignored) ? '0' : implode(',', $current_ignored);

        // Get all player dice (blue)
        $player_dice = $this->getObjectListFromDB("SELECT * FROM dice_roll WHERE dice_owner = 'player' AND dice_type = 'blue'");
        $player_sum = 0;
        foreach ($player_dice as $dice) {
            $player_sum += (int) $dice['dice_value'];
        }

        // Get only white + green challenge dice that are NOT already ignored
        $challenge_dice = $this->getObjectListFromDB("SELECT * FROM dice_roll WHERE dice_owner = 'challenge' AND dice_type IN ('white', 'green') AND dice_id NOT IN ($ignored_ids_str)");
        $challenge_sum = 0;
        foreach ($challenge_dice as $dice) {
            $challenge_sum += (int) $dice['dice_value'];
        }

        if ($player_sum <= $challenge_sum) {
            throw new BgaUserException(sprintf(
                $this->_("Kunigunde's power requires horde dice sum (%d) > white+green sum (%d)"),
                $player_sum,
                $challenge_sum
            ));
        }

        // Find all white dice that are NOT already ignored
        $white_dice = $this->getObjectListFromDB("SELECT * FROM dice_roll WHERE dice_owner = 'challenge' AND dice_type = 'white' AND dice_id NOT IN ($ignored_ids_str)");

        if (empty($white_dice)) {
            throw new BgaUserException($this->_("No white dice to ignore"));
        }

        // Build list of white dice IDs to ignore (use actual dice_id from database)
        $ignored_dice = [];
        foreach ($white_dice as $dice) {
            $ignored_dice[] = (int) $dice['dice_id'];
        }

        // Add to ignored dice
        $current_ignored = array_merge($current_ignored, $ignored_dice);
        $this->setGlobalVariable('card_ignored_dice', json_encode($current_ignored));

        $this->notifyAllPlayers('diceIgnored', clienttranslate('${player_name} ignores all white dice (Kunigunde Nosske)'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'ignored_dice' => $ignored_dice,
            'count' => count($ignored_dice)
        ]);
    }

    /**
     * Régitha's power: Ignore ALL challenge dice
     * Once used, Régitha cannot be discarded, replaced, or rested
     */
    private function applyRegithaPower(int $player_id, int $card_id): void
    {
        // Get ALL challenge dice
        $challenge_dice = $this->getObjectListFromDB("SELECT * FROM dice_roll WHERE dice_owner = 'challenge'");

        if (empty($challenge_dice)) {
            throw new BgaUserException($this->_("No challenge dice to ignore"));
        }

        // Build list of all challenge dice IDs to ignore
        $ignored_dice = [];
        foreach ($challenge_dice as $dice) {
            $ignored_dice[] = (int) $dice['dice_id'];
        }

        // Add to ignored dice
        $current_ignored = json_decode($this->getGlobalVariable('card_ignored_dice') ?? '[]', true);
        $current_ignored = array_merge($current_ignored, $ignored_dice);
        $this->setGlobalVariable('card_ignored_dice', json_encode($current_ignored));

        // Mark Régitha as "protected" using global variable
        // She cannot be discarded, replaced, or rested after using her power
        $protected_cards = json_decode($this->getGlobalVariable('protected_cards') ?? '[]', true);
        $protected_cards[] = $card_id;
        $this->setGlobalVariable('protected_cards', json_encode($protected_cards));
        $this->trace("applyRegithaPower - card_id: $card_id, protected_cards after: " . json_encode($protected_cards));

        $this->notifyAllPlayers('diceIgnored', clienttranslate('${player_name} uses Régitha to ignore ALL challenge dice! Régitha cannot be discarded or rested anymore.'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'ignored_dice' => $ignored_dice,
            'count' => count($ignored_dice)
        ]);

        // Notify about Régitha being protected
        $this->notifyAllPlayers('cardProtected', '', [
            'card_id' => $card_id
        ]);
    }

    /**
     * Lyara l'Inspirante's power: Villages are treated as cities
     * :tap:: :tuile: villages = :tuile: villes: Ignorez tous :d6-black-white-green: et vous recrutez tout type de :card:
     * Si :rest-all: gagnez +1 :moral:
     * 
     * When activated on a village:
     * - Ignore ALL challenge dice (like cities have no challenge)
     * - Allow recruiting any card type (flag for recruitment phase)
     * - +1 moral if player does rest-all later (checked in stRest)
     */
    private function applyLyaraPower(int $player_id, int $card_id): void
    {
        // Get the selected tile to check if it's a village
        $tile_id = $this->getGameStateValue('selected_tile');
        if (!$tile_id) {
            throw new BgaUserException($this->_("No tile selected"));
        }

        $tile = $this->getObjectFromDB("SELECT * FROM tile WHERE tile_id = $tile_id");
        if (!$tile) {
            throw new BgaUserException($this->_("Tile not found"));
        }

        // Power only works on villages
        if ($tile['tile_type'] !== 'village') {
            throw new BgaUserException($this->_("This power only works on villages"));
        }

        // Get ALL challenge dice
        $challenge_dice = $this->getObjectListFromDB("SELECT * FROM dice_roll WHERE dice_owner = 'challenge'");

        // Build list of all challenge dice IDs to ignore (if any)
        $ignored_dice = [];
        foreach ($challenge_dice as $dice) {
            $ignored_dice[] = (int) $dice['dice_id'];
        }

        if (!empty($ignored_dice)) {
            // Add to ignored dice
            $current_ignored = json_decode($this->getGlobalVariable('card_ignored_dice') ?? '[]', true);
            $current_ignored = array_merge($current_ignored, $ignored_dice);
            $this->setGlobalVariable('card_ignored_dice', json_encode($current_ignored));
        }

        // Set flag to treat this village as a city for recruitment
        $this->setGlobalVariable('lyara_village_as_city', json_encode([
            'active' => true,
            'tile_id' => $tile_id,
            'player_id' => $player_id
        ]));

        $village_name = $this->village_types[$tile['tile_subtype']]['name'] ?? 'Village';

        $this->notifyAllPlayers('lyaraPowerUsed', clienttranslate('${player_name} uses Lyara\'s power: ${village_name} is treated as a city! All challenge dice ignored, any card type can be recruited.'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'card_id' => $card_id,
            'village_name' => $village_name,
            'ignored_dice' => $ignored_dice,
            'count' => count($ignored_dice)
        ]);
    }

    /**
     * Topilzin's power: Discard to set wind force to 3
     * :discard:: :force-x: ⮕ :force-3:
     */
    private function applyTopilzinPower(int $player_id, int $card_id): void
    {
        // Get the selected tile
        $tile_id = $this->getGameStateValue('selected_tile');
        if (!$tile_id) {
            throw new BgaUserException($this->_("No tile selected"));
        }

        $tile = $this->getObjectFromDB("SELECT * FROM tile WHERE tile_id = $tile_id");
        if (!$tile) {
            throw new BgaUserException($this->_("Tile not found"));
        }

        $old_force = (int) ($tile['tile_wind_force'] ?? 0);
        $new_force = 3;

        // Discard Topilzin using common function
        $this->discardCard($player_id, $card_id, true);

        // Set temporary wind force (stored in global variable for this confrontation)
        $this->setGlobalVariable('modified_wind_force', json_encode([
            'force' => $new_force,
            'original' => $old_force,
            'tile_id' => $tile_id
        ]));

        // Update the tile's wind force temporarily in the DB for this confrontation
        $this->DbQuery("UPDATE tile SET tile_wind_force = $new_force WHERE tile_id = $tile_id");

        $this->notifyAllPlayers('windForceChanged', clienttranslate('${player_name} sacrifices Topilzin: Wind force changes from ${old_force} to ${new_force}!'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'card_id' => $card_id,
            'old_force' => $old_force,
            'new_force' => $new_force,
            'tile_id' => $tile_id,
            'update_tile' => false  // Virtual change for this confrontation only
        ]);
    }

    /**
     * Osuros's power: Discard to set wind force to 6 (FUREVENT)
     * :discard:: :force-x: ⮕ :force-6:
     */
    private function applyOsurosPower(int $player_id, int $card_id): void
    {
        // Get the selected tile
        $tile_id = $this->getGameStateValue('selected_tile');
        if (!$tile_id) {
            throw new BgaUserException($this->_("No tile selected"));
        }

        $tile = $this->getObjectFromDB("SELECT * FROM tile WHERE tile_id = $tile_id");
        if (!$tile) {
            throw new BgaUserException($this->_("Tile not found"));
        }

        $old_force = (int) ($tile['tile_wind_force'] ?? 0);
        $new_force = 6;

        // Discard Osuros using common function
        $this->discardCard($player_id, $card_id, true);

        // Set temporary wind force (stored in global variable for this confrontation)
        $this->setGlobalVariable('modified_wind_force', json_encode([
            'force' => $new_force,
            'original' => $old_force,
            'tile_id' => $tile_id
        ]));

        // Update the tile's wind force in the DB
        $this->DbQuery("UPDATE tile SET tile_wind_force = $new_force WHERE tile_id = $tile_id");

        $this->notifyAllPlayers('windForceChanged', clienttranslate('${player_name} sacrifices Osuros: Wind force changes from ${old_force} to ${new_force} (FUREVENT)!'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'card_id' => $card_id,
            'old_force' => $old_force,
            'new_force' => $new_force,
            'tile_id' => $tile_id,
            'update_tile' => false  // Virtual change for this confrontation only
        ]);
    }

    /**
     * Tula's power: Discard to set wind force to 2
     * :discard:: :force-x: ⮕ :force-2:
     */
    private function applyTulaPower(int $player_id, int $card_id): void
    {
        // Get the selected tile
        $tile_id = $this->getGameStateValue('selected_tile');
        if (!$tile_id) {
            throw new BgaUserException($this->_("No tile selected"));
        }

        $tile = $this->getObjectFromDB("SELECT * FROM tile WHERE tile_id = $tile_id");
        if (!$tile) {
            throw new BgaUserException($this->_("Tile not found"));
        }

        $old_force = (int) ($tile['tile_wind_force'] ?? 0);
        $new_force = 2;

        // Discard Tula using common function
        $this->discardCard($player_id, $card_id, true);

        // Set temporary wind force (stored in global variable for this confrontation)
        $this->setGlobalVariable('modified_wind_force', json_encode([
            'force' => $new_force,
            'original' => $old_force,
            'tile_id' => $tile_id
        ]));

        // Update the tile's wind force in the DB
        $this->DbQuery("UPDATE tile SET tile_wind_force = $new_force WHERE tile_id = $tile_id");

        $this->notifyAllPlayers('windForceChanged', clienttranslate('${player_name} sacrifices Tula: Wind force changes from ${old_force} to ${new_force}!'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'card_id' => $card_id,
            'old_force' => $old_force,
            'new_force' => $new_force,
            'tile_id' => $tile_id,
            'update_tile' => false  // Virtual change for this confrontation only
        ]);
    }

    /**
     * Charlize Soulages's power: Discard to gain +2 moral per black die
     * :discard:: Gagnez +2 :moral: / :d6-black:
     */
    private function applyCharlizePower(int $player_id, int $card_id): void
    {
        // Count black dice in challenge
        $black_dice_count = (int) $this->getUniqueValueFromDB(
            "SELECT COUNT(*) FROM dice_roll WHERE dice_owner = 'challenge' AND dice_type = 'black'"
        );

        if ($black_dice_count == 0) {
            throw new BgaUserException($this->_("No black dice present - cannot use this power"));
        }

        // Discard Charlize using common function
        $this->discardCard($player_id, $card_id, true);

        // Calculate moral gain: +2 per black die
        $moral_gain = $black_dice_count * 2;

        // Apply moral
        $new_moral = $this->modifyPlayerMoral($player_id, $moral_gain);

        $this->notifyAllPlayers('moralChanged', clienttranslate('${player_name} sacrifices Charlize: +${amount} moral (${black_count} black dice × 2)!'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'amount' => $moral_gain,
            'new_moral' => $new_moral,
            'black_count' => $black_dice_count,
            'terrain_name' => 'Charlize'
        ]);
    }

    /**
     * Jonas's power: Choose wind token from bag and place on current tile
     * :discard:: Choisissez le vent dans la pioche (le vôtre ou celui de l'adversaire).
     * Client must pass wind_force = chosen wind force (1-6)
     */
    private function applyJonasPower(int $player_id, int $card_id, array $params): void
    {
        // Get chosen wind force from params
        $chosen_force = (int) ($params['wind_force'] ?? 0);

        if ($chosen_force < 1 || $chosen_force > 6) {
            throw new BgaUserException($this->_("Invalid wind force selected"));
        }

        // Get current tile
        $tile_id = $this->getGameStateValue('selected_tile');
        if (!$tile_id) {
            throw new BgaUserException($this->_("No tile selected"));
        }

        $tile = $this->getObjectFromDB("SELECT * FROM tile WHERE tile_id = $tile_id");
        if (!$tile) {
            throw new BgaUserException($this->_("Tile not found"));
        }

        // Get a token with that force from the bag
        $token = $this->getObjectFromDB(
            "SELECT * FROM wind_token WHERE token_location = 'bag' AND token_force = $chosen_force LIMIT 1"
        );

        if (!$token) {
            throw new BgaUserException(sprintf(
                $this->_("No wind token with force %d available in the bag"),
                $chosen_force
            ));
        }

        // Get old wind force for notification
        $old_force = (int) ($tile['tile_wind_force'] ?? 0);

        // Discard Jonas using common function
        $this->discardCard($player_id, $card_id, true);

        // Place the token on the tile
        $this->DbQuery("UPDATE tile SET tile_wind_force = $chosen_force, tile_discovered = 1 WHERE tile_id = $tile_id");
        $this->DbQuery("UPDATE wind_token SET token_location = 'tile', token_tile_id = $tile_id WHERE token_id = {$token['token_id']}");

        // Store modified wind force for challenge resolution
        $this->setGlobalVariable('modified_wind_force', $chosen_force);

        // Notify all players about wind change
        $this->notifyAllPlayers('windForceChanged', clienttranslate('${player_name} sacrifices Jonas: chooses wind force ${new_force}!'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'tile_id' => $tile_id,
            'old_force' => $old_force,
            'new_force' => $chosen_force,
            'update_tile' => true  // Jonas physically replaces the wind token
        ]);
    }

    /**
     * Lihn's power: Double points gained this turn
     * :discard:: Doublez les points gagnés de ce tour.
     */
    private function applyLihnPower(int $player_id, int $card_id): void
    {
        // Discard Lihn using common function
        $this->discardCard($player_id, $card_id, true);

        // Set the double points flag for this turn
        $this->setGlobalVariable('lihn_double_points', 1);

        // Notify all players
        $this->notifyAllPlayers('lihnPowerActivated', clienttranslate('${player_name} sacrifices Lihn: points gained this turn will be doubled!'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName()
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
            $dice_id = (int) ($mod['dice_id'] ?? 0);
            $modifier = (int) ($mod['modifier'] ?? 0);

            if (!in_array($dice_id, $player_dice_ids)) {
                continue; // Skip invalid dice
            }

            if ($modifier !== 1 && $modifier !== -1) {
                continue; // Skip invalid modifier
            }

            $dice = $this->getObjectFromDB("SELECT * FROM dice_roll WHERE dice_id = $dice_id");
            if ($dice) {
                $new_value = max(self::MIN_DICE_VALUE, min(self::MAX_DICE_VALUE, $dice['dice_value'] + $modifier));
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
     * Client must pass dice_modifiers = array of {dice_id, modifier (+1/-1 or cumulative)}
     */
    private function applyBlanchettePower(int $player_id, array $params): void
    {
        // Get wind force from current tile
        $tile_id = $this->getGameStateValue('selected_tile');
        $tile = $this->getObjectFromDB("SELECT * FROM tile WHERE tile_id = $tile_id");
        $wind_force = (int) ($tile['tile_wind_force'] ?? 0);

        if ($wind_force <= 0) {
            throw new BgaUserException($this->_("No wind force on this tile"));
        }

        $dice_modifiers = $params['dice_modifiers'] ?? [];

        // Count total modifications (sum of absolute values of modifiers)
        $total_modifications = 0;
        foreach ($dice_modifiers as $mod) {
            $total_modifications += abs((int) ($mod['modifier'] ?? 0));
        }

        if ($total_modifications > $wind_force) {
            throw new BgaUserException(sprintf(
                $this->_("You can only apply %d modifications (wind force)"),
                $wind_force
            ));
        }

        // Get only blue player dice
        $player_dice = $this->getObjectListFromDB("SELECT * FROM dice_roll WHERE dice_owner = 'player' AND dice_type = 'blue'");
        $player_dice_ids = array_column($player_dice, 'dice_id');

        // Apply each modifier (can be cumulative now)
        foreach ($dice_modifiers as $mod) {
            $dice_id = (int) ($mod['dice_id'] ?? 0);
            $modifier = (int) ($mod['modifier'] ?? 0);

            if (!in_array($dice_id, $player_dice_ids)) {
                continue;
            }

            if ($modifier === 0) {
                continue;
            }

            $dice = $this->getObjectFromDB("SELECT * FROM dice_roll WHERE dice_id = $dice_id");
            if ($dice) {
                $new_value = max(self::MIN_DICE_VALUE, min(self::MAX_DICE_VALUE, $dice['dice_value'] + $modifier));
                $this->DbQuery("UPDATE dice_roll SET dice_value = $new_value WHERE dice_id = $dice_id");
            }
        }

        $this->notifyAllPlayers('diceModified', clienttranslate('${player_name} modifies ${count} dice (Blanchette de Gaude)'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'dice_modifiers' => $dice_modifiers,
            'count' => $total_modifications
        ]);
    }

    /**
     * Ukkiba Tomoshi's power: -1 moral, then ±1 on blue dice (X = remaining moral)
     * :tap:: Perdez -1 :moral:. Faites ±1 / :moral: restant sur :d6-blue:
     */
    private function applyUkkibaPower(int $player_id, array $params): void
    {
        // Get current moral
        $current_moral = $this->getPlayerMoral($player_id);

        if ($current_moral <= 0) {
            throw new BgaUserException($this->_("You need at least 1 moral to use this power"));
        }

        // Lose 1 moral first
        $new_moral = $this->modifyPlayerMoral($player_id, -1);

        // Notify moral loss
        $this->notifyAllPlayers('moralChanged', clienttranslate('${player_name} loses 1 moral (Ukkiba)'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'new_moral' => $new_moral,
            'amount' => -1
        ]);

        // Max modifications = remaining moral after loss
        $max_modifications = $new_moral;

        $dice_modifiers = $params['dice_modifiers'] ?? [];

        // Count total modifications (absolute values)
        $total_modifications = 0;
        foreach ($dice_modifiers as $mod) {
            $total_modifications += abs((int) ($mod['modifier'] ?? 0));
        }

        if ($total_modifications > $max_modifications) {
            throw new BgaUserException(sprintf(
                $this->_("You can only make %d modifications (remaining moral)"),
                $max_modifications
            ));
        }

        // Get only blue player dice
        $player_dice = $this->getObjectListFromDB("SELECT * FROM dice_roll WHERE dice_owner = 'player' AND dice_type = 'blue'");
        $player_dice_ids = array_column($player_dice, 'dice_id');

        // Apply each modifier (can be cumulative on same die)
        foreach ($dice_modifiers as $mod) {
            $dice_id = (int) ($mod['dice_id'] ?? 0);
            $modifier = (int) ($mod['modifier'] ?? 0);

            if (!in_array($dice_id, $player_dice_ids)) {
                continue;
            }

            if ($modifier == 0) {
                continue;
            }

            $dice = $this->getObjectFromDB("SELECT * FROM dice_roll WHERE dice_id = $dice_id");
            if ($dice) {
                $new_value = max(self::MIN_DICE_VALUE, min(self::MAX_DICE_VALUE, $dice['dice_value'] + $modifier));
                $this->DbQuery("UPDATE dice_roll SET dice_value = $new_value WHERE dice_id = $dice_id");
            }
        }

        if ($total_modifications > 0) {
            $this->notifyAllPlayers('diceModified', clienttranslate('${player_name} modifies dice ${count} times (Ukkiba Tomoshi)'), [
                'player_id' => $player_id,
                'player_name' => $this->getActivePlayerName(),
                'dice_modifiers' => $dice_modifiers,
                'count' => $total_modifications
            ]);
        }
    }

    /**
     * Waldo Waldmann's power: Ignore 1 challenge die per missing hordier
     * :tap:: Ignorez -1 :d6-green: / :missing:
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
            $dice = $this->getObjectFromDB("SELECT * FROM dice_roll WHERE dice_id = " . (int) $dice_id);
            if (!$dice || $dice['dice_type'] !== 'green') {
                throw new BgaUserException($this->_("Waldo can only ignore green terrain dice"));
            }
        }

        // Get current ignored dice and add these
        $current_ignored = json_decode($this->getGlobalVariable('card_ignored_dice') ?? '[]', true);
        $current_ignored = array_merge($current_ignored, $ignored_dice);
        $this->setGlobalVariable('card_ignored_dice', json_encode($current_ignored));

        $this->notifyAllPlayers('diceIgnored', clienttranslate('${player_name} ignores ${count} challenge dice (Waldo Waldmann)'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'ignored_dice' => $ignored_dice,
            'count' => count($ignored_dice)
        ]);
    }

    /**
     * Belkacem's power: Set a green terrain die to a chosen value
     * :tap:: Placez 1 :d6-green: (set value of a green die)
     */
    private function applyBelkacemPower(int $player_id, array $params): void
    {
        $dice_id = $params['dice_id'] ?? null;
        $dice_value = $params['dice_value'] ?? null;

        if ($dice_id === null) {
            throw new BgaUserException($this->_("You must select a green die"));
        }

        if ($dice_value === null || $dice_value < self::MIN_DICE_VALUE || $dice_value > self::MAX_DICE_VALUE) {
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
     * :discard:: Lancez +1 :d6-blue-violet: / :card: <b>PACK</b>.
     */
    private function applyBenelimPower(int $player_id, int $card_id): void
    {
        // Count PACK cards in player's horde (excluding Benelim himself who is TRAINE)
        $pack_cards = $this->getObjectListFromDB(
            "SELECT c.card_id, c.card_type_arg FROM card c 
             WHERE c.card_location = 'horde_$player_id' AND c.card_id != $card_id"
        );

        $pack_count = 0;
        foreach ($pack_cards as $card) {
            $char_id = (int) $card['card_type_arg'];
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

        // Discard Benelim using common function
        $this->discardCard($player_id, $card_id, true);

        // Roll +1 blue die per PACK card
        for ($i = 0; $i < $pack_count; $i++) {
            $this->rollExtraDie($player_id, 'blue', 'Benelim');
        }

        $this->notifyAllPlayers('message', clienttranslate('${player_name} rolls ${count} extra dice thanks to Benelim (${count} PACK cards)'), [
            'player_name' => $this->getActivePlayerName(),
            'count' => $pack_count
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

        // Rest the target (will throw if protected)
        $this->restCard($player_id, $target_card_id, 'Vera');
    }

    /**
     * Dragon's power: Tap another hordier to gain +4 moral
     * :tap:: :tap: 1 autre :card: et gagnez +4 :moral:
     */
    private function applyDragonPower(int $player_id, int $dragon_card_id, ?int $target_card_id): void
    {
        if ($target_card_id === null) {
            throw new BgaUserException($this->_("You must select a Hordier to exhaust"));
        }

        // Can't target itself
        if ($target_card_id === $dragon_card_id) {
            throw new BgaUserException($this->_("Dragon cannot target itself"));
        }

        // Check target is in player's horde
        $target = $this->getObjectFromDB(
            "SELECT * FROM card WHERE card_id = $target_card_id AND card_location = 'horde_$player_id'"
        );

        if (!$target) {
            throw new BgaUserException($this->_("Invalid target"));
        }

        // Check if target is already exhausted
        if ($target['card_power_used']) {
            throw new BgaUserException($this->_("This Hordier is already exhausted"));
        }

        // Exhaust the target
        $this->DbQuery("UPDATE card SET card_power_used = 1 WHERE card_id = $target_card_id");

        // Notify exhaustion
        $target_type_arg = (int) $target['card_type_arg'];
        $target_char = $this->characters[$target_type_arg] ?? ['name' => 'Hordier'];

        $this->notifyAllPlayers('hordierExhausted', clienttranslate('${character_name} is exhausted by Dragon'), [
            'player_id' => $player_id,
            'card_id' => $target_card_id,
            'character_name' => $target_char['name']
        ]);

        // Gain +4 moral
        $this->DbQuery("UPDATE player SET player_moral = LEAST(" . self::MAX_MORAL . ", player_moral + " . self::DRAGON_MORAL_BONUS . ") WHERE player_id = $player_id");
        $newMoral = $this->getUniqueValueFromDB("SELECT player_moral FROM player WHERE player_id = $player_id");

        $this->notifyAllPlayers('moralChanged', clienttranslate('${player_name} gains ${points} moral from Dragon\'s power'), [
            'player_id' => $player_id,
            'player_name' => $this->getPlayerNameById($player_id),
            'moral' => (int) $newMoral,
            'points' => self::DRAGON_MORAL_BONUS,
            'reason' => 'dragon_power'
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

        // Clear any pending multi-step power state from previous confrontation
        $this->setGlobalVariable('card_pending', null);

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
            $whiteDice = (int) ($terrain['white_dice'] ?? 0);
            $greenDice = (int) ($terrain['green_dice'] ?? 0);
            $blackDice = (int) ($terrain['black_dice'] ?? 0);

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
        foreach ($white_dice as &$d) {
            $d['rolled'] = true;
        }
        foreach ($green_dice as &$d) {
            $d['rolled'] = true;
        }
        foreach ($black_dice as &$d) {
            $d['rolled'] = true;
        }

        // Check if this tile is on the edge (< 6 neighbors)
        // If so, cap total challenge dice to 5 maximum (easier for player)
        $is_edge_tile = false;
        $neighbors = $this->getAdjacentTiles((int) $tile['tile_q'], (int) $tile['tile_r'], (int) $tile['tile_chapter']);
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
        $ignored_dice_json = $this->getGlobalVariable('card_ignored_dice');
        // $this->trace("stResolveConfrontation - ignored_dice_json: " . ($ignored_dice_json ?? 'null'));

        if ($ignored_dice_json) {
            $ignored_dice = json_decode($ignored_dice_json, true) ?? [];
            // $this->trace("stResolveConfrontation - ignored_dice decoded: " . json_encode($ignored_dice));

            if (!empty($ignored_dice)) {
                // Convert to integers for comparison
                $ignored_dice_int = array_map('intval', $ignored_dice);
                // $this->trace("stResolveConfrontation - ignored_dice_int: " . json_encode($ignored_dice_int));

                $wind_dice = array_filter($wind_dice, function ($dice) use ($ignored_dice_int) {
                    $dice_id = (int) $dice['dice_id'];
                    $keep = !in_array($dice_id, $ignored_dice_int, true);
                    return $keep;
                });
                // Clear the variable for next confrontation
                $this->setGlobalVariable('card_ignored_dice', null);
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
            $points_earned += self::FUREVENT_SCORE_MULTIPLIER;
        }

        // Porte d'Hurle bonus: +6 points for passing through
        if (isset($tile['tile_subtype']) && $tile['tile_subtype'] === 'portedhurle') {
            $this->incStat(self::PORTEDHURLE_SCORE_MULTIPLIER, 'portedhurle_bonus', $player_id);
            $points_earned += self::PORTEDHURLE_SCORE_MULTIPLIER;
        }

        // Award surpass points (cumulative: 0, 1, 2, 3, 4, 5...)
        $surpass_count = (int) $this->getUniqueValueFromDB("SELECT player_surpass_count FROM player WHERE player_id = $player_id");
        if ($surpass_count > 0) {
            $this->incStat($surpass_count, 'surpass_points', $player_id);
            $points_earned += $surpass_count;
        }

        // Check if Lihn's double points is active
        $lihn_active = (int) ($this->getGlobalVariable('lihn_double_points') ?? 0);
        if ($lihn_active) {
            // Track the bonus points from Lihn (the extra points are equal to original amount)
            $this->incStat($points_earned, 'lihn_bonus_points', $player_id);
            $points_earned *= self::MORAL_SCORE_MULTIPLIER;
        }

        // Increment score directly in player table
        $this->DbQuery("UPDATE player SET player_score = COALESCE(player_score, 0) + $points_earned WHERE player_id = $player_id");

        // Get new score to notify
        $new_score = (int) $this->getUniqueValueFromDB("SELECT player_score FROM player WHERE player_id = $player_id");

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
            'q' => (int) $tile['tile_q'],
            'r' => (int) $tile['tile_r']
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
        $tile = null;
        $wind_force = 0;
        if ($tile_id) {
            $tile = $this->getObjectFromDB("SELECT * FROM tile WHERE tile_id = $tile_id");
            $wind_force = $tile ? (int) $tile['tile_wind_force'] : 0;
        }
        $player = $this->getObjectFromDB("SELECT player_moral FROM player WHERE player_id = $player_id");

        $horde_dice = $this->getCollectionFromDb("SELECT * FROM dice_roll WHERE dice_owner = 'player'");
        $challenge_dice = $this->getCollectionFromDb("SELECT * FROM dice_roll WHERE dice_owner = 'challenge'");

        // Get ignored dice IDs (from powers like Lyara, Uther, Wanda, etc.)
        $ignored_dice_json = $this->getGlobalVariable('card_ignored_dice');
        $ignored_dice = $ignored_dice_json ? json_decode($ignored_dice_json, true) : [];

        // Get protected cards (like Regitha after using her power - can't be rested/discarded)
        $protected_cards_json = $this->getGlobalVariable('protected_cards');
        $protected_cards = $protected_cards_json ? json_decode($protected_cards_json, true) : [];

        return [
            'tile' => $tile,
            'wind_force' => $wind_force,
            'moral' => (int) ($player['player_moral'] ?? 0),
            'horde_dice' => array_values($horde_dice),
            'challenge_dice' => array_values($challenge_dice),
            'horde' => $this->getHordeWithPowerStatus($player_id),
            'ignored_dice' => $ignored_dice,
            'protected_cards' => $protected_cards
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
     * In a village/city: card goes to local recruit pool
     * Elsewhere: card goes to discard
     */
    function actAbandonHordier(int $card_id): void
    {
        $this->checkAction('actAbandonHordier');
        $player_id = $this->getActivePlayerId();

        // Verify the card belongs to the player's horde using our trait method
        $card = $this->getCardDefinition($card_id, $player_id);

        // Get current tile to check if in village/city
        $player = $this->getObjectFromDB("SELECT * FROM player WHERE player_id = $player_id");
        $chapter = $this->getGameStateValue('current_chapter');
        $tile = $this->getTileAt((int) $player['player_position_q'], (int) $player['player_position_r'], $chapter);

        // Add card to recruit pool (village/city) or discard (elsewhere)
        $this->addCardToRecruitPool($card_id, $tile);

        // Mark as exhausted - abandoned cards can't use power if recruited again
        $this->DbQuery("UPDATE card SET card_power_used = 1 WHERE card_id = $card_id");

        $this->incStat(1, 'hordiers_lost', $player_id);

        // Get character info for notification
        $type_arg = (int) $card['card_type_arg'];
        $char_info = $this->characters[$type_arg] ?? ['name' => 'Hordier'];

        // Determine destination for notification
        $isRecruitLocation = $tile && ($tile['tile_type'] == 'village' || $tile['tile_type'] == 'city');
        $destination = $isRecruitLocation ? 'recruit pool' : 'current tile';

        $this->notifyAllPlayers('hordierLost', clienttranslate('${player_name} loses ${character_name} (to ${destination})'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'card_id' => $card_id,
            'character_name' => $char_info['name'],
            'destination' => $destination,
            'tile_type' => $tile ? $tile['tile_type'] : null,
            'card' => $isRecruitLocation ? [
                'card_id' => $card_id,
                'card_type' => $card['card_type'] ?? $card['type'],
                'card_type_arg' => $type_arg,
                'card_power_used' => 1  // Abandoned cards are always exhausted
            ] : null
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
