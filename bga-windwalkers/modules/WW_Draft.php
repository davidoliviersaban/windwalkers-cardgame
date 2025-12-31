<?php
/**
 * WW_Draft - Draft phase logic
 */

trait WW_Draft
{
    /**
     * Horde requirements by type
     */
    function getHordeRequirements(): array
    {
        return [
            'traceur' => 1,
            'fer' => 2,
            'pack' => 3,
            'traine' => 2
        ];
    }

    /**
     * Get horde cards with power_used status (direct SQL query to get all columns)
     */
    function getHordeWithPowerStatus(int $player_id): array
    {
        $location = 'horde_' . $player_id;
        $cards = $this->getCollectionFromDb(
            "SELECT card_id, card_type, card_type_arg, card_location, card_location_arg, card_is_leader, card_power_used 
             FROM card WHERE card_location = '$location'"
        );
        
        // Enrich with character info and normalize keys for JS
        $enriched = [];
        foreach ($cards as $card) {
            $type_arg = $card['card_type_arg'];
            $card_id = $card['card_id'];
            
            $charInfo = $this->characters[$type_arg] ?? [];
            $card['name'] = $charInfo['name'] ?? 'Unknown';
            $card['char_type'] = $charInfo['type'] ?? $card['card_type'];
            $card['is_leader'] = !empty($charInfo['is_leader']);
            $card['power'] = $charInfo['power'] ?? '';
            // Normalize for JS (expects both formats)
            $card['id'] = $card_id;
            $card['type_arg'] = $type_arg;
            $card['power_used'] = (int)$card['card_power_used'];
            $enriched[$card_id] = $card;
        }
        return $enriched;
    }

    //////////////////////////////////////////////////////////////////////////////
    // Draft Actions
    //////////////////////////////////////////////////////////////////////////////
    
    // TODO: REMOVE BEFORE PRODUCTION - Auto-draft for testing
    function autoSelectDefaultTeam(int $player_id): void
    {
        $requirements = $this->getHordeRequirements();
        $selected_cards = [];
        
        // First, recruit 1 traceur (is_leader = 1)
        $traceurs = $this->getCollectionFromDb(
            "SELECT * FROM card WHERE card_type = 'traceur' AND card_location = 'deck' ORDER BY RAND() LIMIT " . $requirements['traceur']
        );
        foreach ($traceurs as $card) {
            $card_id = $card['card_id'] ?? $card['id'];
            $this->cards->moveCard($card_id, 'horde_' . $player_id);
            $selected_cards[] = $card_id;
        }
        
        // Then recruit fer
        $fers = $this->getCollectionFromDb(
            "SELECT * FROM card WHERE card_type = 'fer' AND card_location = 'deck' ORDER BY RAND() LIMIT " . $requirements['fer']
        );
        foreach ($fers as $card) {
            $card_id = $card['card_id'] ?? $card['id'];
            $this->cards->moveCard($card_id, 'horde_' . $player_id);
            $selected_cards[] = $card_id;
        }
        
        // Recruit pack
        $packs = $this->getCollectionFromDb(
            "SELECT * FROM card WHERE card_type = 'pack' AND card_location = 'deck' ORDER BY RAND() LIMIT " . $requirements['pack']
        );
        foreach ($packs as $card) {
            $card_id = $card['card_id'] ?? $card['id'];
            $this->cards->moveCard($card_id, 'horde_' . $player_id);
            $selected_cards[] = $card_id;
        }
        
        // Recruit traine
        $traines = $this->getCollectionFromDb(
            "SELECT * FROM card WHERE card_type = 'traine' AND card_location = 'deck' ORDER BY RAND() LIMIT " . $requirements['traine']
        );
        foreach ($traines as $card) {
            $card_id = $card['card_id'] ?? $card['id'];
            $this->cards->moveCard($card_id, 'horde_' . $player_id);
            $selected_cards[] = $card_id;
        }
        
        // Notify client about auto-selection
        if (count($selected_cards) > 0) {
            $this->notifyAllPlayers('autoSelectTeam', clienttranslate('Default team auto-selected for testing'), [
                'player_id' => $player_id,
                'card_ids' => $selected_cards
            ]);
        }
    }
    
    /**
     * Toggle a card selection during draft
     */
    function actToggleDraftCard(int $card_id, bool $select): void
    {
        $this->checkAction('actToggleDraftCard');
        $player_id = $this->getActivePlayerId();
        
        $card = $this->cards->getCard($card_id);
        if (!$card) {
            throw new BgaUserException($this->_("Card not found"));
        }
        
        if ($select) {
            $this->selectDraftCard($player_id, $card);
        } else {
            $this->deselectDraftCard($player_id, $card_id, $card);
        }
        
        // Notify updated counts
        $horde = $this->cards->getCardsInLocation('horde_' . $player_id);
        $counts = $this->countHordeByType($horde);
        
        $this->notifyAllPlayers('cardToggled', '', [
            'player_id' => $player_id,
            'card_id' => $card_id,
            'selected' => $select,
            'counts' => $counts,
            'requirements' => $this->getHordeRequirements()
        ]);
    }

    /**
     * Select a card for draft
     */
    private function selectDraftCard(int $player_id, array $card): void
    {
        $location = $card['card_location'] ?? $card['location'] ?? '';
        if ($location != 'deck') {
            throw new BgaUserException($this->_("This card is not available"));
        }
        
        $horde = $this->cards->getCardsInLocation('horde_' . $player_id);
        $card_type = $card['card_type'] ?? $card['type'] ?? '';
        $card_id = $card['card_id'] ?? $card['id'] ?? 0;
        
        $counts = $this->countHordeByType($horde);
        $requirements = $this->getHordeRequirements();
        
        if (!isset($requirements[$card_type]) || $counts[$card_type] >= $requirements[$card_type]) {
            throw new BgaUserException($this->_("You already have enough characters of this type"));
        }
        
        $this->cards->moveCard($card_id, 'horde_' . $player_id);
        $this->trackHordierSelection($card_id);
    }

    /**
     * Deselect a card from draft
     */
    private function deselectDraftCard(int $player_id, int $card_id, array $card): void
    {
        $location = $card['card_location'] ?? $card['location'] ?? '';
        if ($location != 'horde_' . $player_id) {
            throw new BgaUserException($this->_("This card is not in your horde"));
        }
        
        $this->cards->moveCard($card_id, 'deck');
    }
    
    /**
     * Confirm the drafted horde
     */
    function actConfirmDraft(): void
    {
        $this->checkAction('actConfirmDraft');
        $player_id = $this->getActivePlayerId();
        
        $horde = $this->cards->getCardsInLocation('horde_' . $player_id);
        $counts = $this->countHordeByType($horde);
        $requirements = $this->getHordeRequirements();
        
        $this->validateHordeComplete($counts, $requirements);
        
        $this->notifyAllPlayers('draftComplete', clienttranslate('${player_name} has completed their horde'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'horde' => $horde
        ]);
        
        $this->gamestate->nextState('hordeComplete');
    }

    /**
     * Validate horde is complete
     */
    private function validateHordeComplete(array $counts, array $requirements): void
    {
        foreach ($requirements as $type => $required) {
            if ($counts[$type] < $required) {
                throw new BgaUserException(sprintf(
                    $this->_("You need %d %s, but only have %d"),
                    $required,
                    $type,
                    $counts[$type]
                ));
            }
        }
    }
    
    //////////////////////////////////////////////////////////////////////////////
    // Horde Utilities
    //////////////////////////////////////////////////////////////////////////////
    
    /**
     * Count cards in horde by type
     * card_type is directly 'traceur', 'fer', 'pack', or 'traine'
     */
    function countHordeByType(array $horde): array
    {
        $counts = [
            'traceur' => 0,
            'fer' => 0,
            'pack' => 0,
            'traine' => 0
        ];
        
        foreach ($horde as $card) {
            $card_type = $card['card_type'] ?? $card['type'] ?? null;
            
            if ($card_type && isset($counts[$card_type])) {
                $counts[$card_type]++;
            }
        }
        
        return $counts;
    }

    /**
     * Track hordier selection statistics
     */
    function trackHordierSelection(int $card_id): void
    {
        $this->incStat(1, 'hordier_selections');
    }

    //////////////////////////////////////////////////////////////////////////////
    // Draft State Arguments
    //////////////////////////////////////////////////////////////////////////////
    
    /**
     * Get draft horde state arguments
     */
    function argDraftHorde(): array
    {
        $player_id = $this->getActivePlayerId();
        
        // TODO: REMOVE BEFORE PRODUCTION - Auto-select default team for testing
        $selected = $this->getEnrichedCards($this->cards->getCardsInLocation('horde_' . $player_id));
        if (count($selected) == 0) {
            $this->autoSelectDefaultTeam($player_id);
            $selected = $this->getEnrichedCards($this->cards->getCardsInLocation('horde_' . $player_id));
        }
        
        $available = $this->getEnrichedCards($this->cards->getCardsInLocation('deck'));
        $counts = $this->countHordeByType($selected);
        
        return [
            'available' => $available,
            'selected' => $selected,
            'counts' => $counts,
            'requirements' => $this->getHordeRequirements()
        ];
    }

    /**
     * Enrich card data with character info
     */
    private function getEnrichedCards(array $cards): array
    {
        $enriched = [];
        foreach ($cards as $card) {
            // BGA Deck returns card_type_arg and card_id, but we also handle id/type_arg
            $type_arg = $card['card_type_arg'] ?? $card['type_arg'] ?? null;
            $card_id = $card['card_id'] ?? $card['id'] ?? null;
            
            $charInfo = $this->characters[$type_arg] ?? [];
            $card['name'] = $charInfo['name'] ?? 'Unknown';
            $card['char_type'] = $charInfo['type'] ?? ($card['card_type'] ?? $card['type']);
            $card['is_leader'] = !empty($charInfo['is_leader']);
            $card['power'] = $charInfo['power'] ?? '';
            // Ensure we have consistent keys
            $card['id'] = $card_id;
            $card['type_arg'] = $type_arg;
            $enriched[$card_id] = $card;
        }
        return $enriched;
    }

    //////////////////////////////////////////////////////////////////////////////
    // Zombie Draft
    //////////////////////////////////////////////////////////////////////////////
    
    /**
     * Auto-complete draft for zombie player
     */
    function zombieCompleteDraft(int $player_id): void
    {
        $horde = $this->cards->getCardsInLocation('horde_' . $player_id);
        $counts = $this->countHordeByType($horde);
        $requirements = $this->getHordeRequirements();
        
        // First, recruit traceur (fer with is_leader)
        if ($counts['traceur'] < $requirements['traceur']) {
            $this->zombieRecruitType($player_id, 'traceur', $counts);
        }
        
        // Then recruit other types
        foreach (['fer', 'pack', 'traine'] as $type) {
            while ($counts[$type] < $requirements[$type]) {
                if (!$this->zombieRecruitType($player_id, $type, $counts)) {
                    break;
                }
            }
        }
        
        $this->gamestate->nextState('hordeComplete');
    }

    /**
     * Recruit a single card of type for zombie
     */
    private function zombieRecruitType(int $player_id, string $type, array &$counts): bool
    {
        // All types use their actual card_type value
        $cards = $this->getCollectionFromDb(
            "SELECT * FROM card WHERE card_type = '$type' AND card_location = 'deck' ORDER BY RAND() LIMIT 1"
        );
        
        if (empty($cards)) {
            return false;
        }
        
        $card = array_shift($cards);
        $this->cards->moveCard($card['card_id'] ?? $card['id'], 'horde_' . $player_id);
        $this->trackHordierSelection($card['card_id'] ?? $card['id']);
        $counts[$type]++;
        
        return true;
    }

    //////////////////////////////////////////////////////////////////////////////
    // Recruitment Actions (during game, at villages/cities)
    //////////////////////////////////////////////////////////////////////////////

    /**
     * Recruit a character from the recruit pool
     */
    function actRecruit(int $card_id): void
    {
        $this->checkAction('actRecruit');
        $player_id = $this->getActivePlayerId();
        
        // Verify the card is in the recruit pool for this location
        $card = $this->cards->getCard($card_id);
        if (!$card) {
            throw new BgaUserException($this->_("This card does not exist"));
        }
        
        // Get current recruit pool and verify card is in it
        $recruitPool = $this->getRecruitPool($player_id);
        
        // Check if card_id is in the pool (keys can be card_id directly or string)
        $found = false;
        foreach ($recruitPool as $key => $poolCard) {
            $poolCardId = $poolCard['card_id'] ?? $key;
            if ($poolCardId == $card_id) {
                $found = true;
                break;
            }
        }
        
        if (!$found) {
            throw new BgaUserException($this->_("This card is not available for recruitment"));
        }
        
        // Move card to player's horde
        $this->cards->moveCard($card_id, 'horde_' . $player_id);
        
        $type_arg = $card['card_type_arg'] ?? $card['type_arg'] ?? null;
        $card_type = $card['card_type'] ?? $card['type'] ?? 'character';
        $char_info = $this->characters[$type_arg] ?? ['name' => 'Hordier'];
        
        $this->notifyAllPlayers('hordierRecruited', clienttranslate('${player_name} recruits ${character_name}'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'card_id' => $card_id,
            'card_type' => $card_type,
            'card_type_arg' => $type_arg,
            'character_name' => $char_info['name'],
            'card' => [
                'card_id' => $card_id,
                'card_type' => $card_type,
                'card_type_arg' => $type_arg
            ]
        ]);
        
        // Check if player now has more than 8 hordiers
        $hordeCount = count($this->cards->getCardsInLocation('horde_' . $player_id));
        if ($hordeCount > 8) {
            $this->gamestate->nextState('mustRelease');
        } else {
            $this->gamestate->nextState('recruited');
        }
    }

    /**
     * Release a hordier (during recruitment to make room)
     * In a village: card goes to village recruit pool
     * Elsewhere: card goes to discard
     */
    function actReleaseHordier(int $card_id): void
    {
        $this->checkAction('actReleaseHordier');
        $player_id = $this->getActivePlayerId();
        
        $card = $this->cards->getCard($card_id);
        $location = $card['card_location'] ?? $card['location'] ?? '';
        if (!$card || $location != 'horde_' . $player_id) {
            throw new BgaUserException($this->_("This card is not in your horde"));
        }
        
        // Get current tile to check if in village
        $player = $this->getObjectFromDB("SELECT * FROM player WHERE player_id = $player_id");
        $chapter = $this->getGameStateValue('current_chapter');
        $tile = $this->getTileAt((int)$player['player_position_q'], (int)$player['player_position_r'], $chapter);
        
        // Add card to recruit pool or discard
        $this->addCardToRecruitPool($card_id, $tile);
        
        $type_arg = $card['card_type_arg'] ?? $card['type_arg'] ?? null;
        $char_info = $this->characters[$type_arg] ?? ['name' => 'Hordier'];
        
        $destination = ($tile && ($tile['tile_type'] == 'village' || $tile['tile_type'] == 'city')) ? 'recruit pool' : 'discard';
        $isRecruitLocation = $tile && ($tile['tile_type'] == 'village' || $tile['tile_type'] == 'city');
        
        $this->notifyAllPlayers('hordierReleased', clienttranslate('${player_name} releases ${character_name} to ${destination}'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'card_id' => $card_id,
            'character_name' => $char_info['name'],
            'destination' => $destination,
            'tile_type' => $tile ? $tile['tile_type'] : null,
            'card' => $isRecruitLocation ? [
                'card_id' => $card_id,
                'card_type' => $card['card_type'] ?? $card['type'],
                'card_type_arg' => $type_arg
            ] : null
        ]);
        
        // Determine which transition to use based on current state
        $stateName = $this->gamestate->state()['name'];
        if ($stateName == 'mustReleaseHordier') {
            $this->gamestate->nextState('released');
        } else {
            $this->gamestate->nextState('recruited');
        }
    }

    /**
     * Skip recruitment
     */
    function actSkipRecruitment(): void
    {
        $this->checkAction('actSkipRecruitment');
        $this->gamestate->nextState('done');
    }

    /**
     * Use a character power
     */
    function actUsePower(int $card_id): void
    {
        $this->checkAction('actUsePower');
        $player_id = $this->getActivePlayerId();
        
        $card = $this->cards->getCard($card_id);
        $location = $card['card_location'] ?? $card['location'] ?? '';
        if (!$card || $location != 'horde_' . $player_id) {
            throw new BgaUserException($this->_("This card is not in your horde"));
        }
        
        // Check if power already used
        $power_used = $card['card_power_used'] ?? $card['power_used'] ?? 0;
        if ($power_used) {
            throw new BgaUserException($this->_("This power has already been used"));
        }
        
        // Mark power as used
        $this->DbQuery("UPDATE card SET card_power_used = 1 WHERE card_id = $card_id");
        
        $type_arg = $card['card_type_arg'] ?? $card['type_arg'] ?? null;
        $char_info = $this->characters[$type_arg] ?? ['name' => 'Hordier', 'power' => ''];
        
        $this->notifyAllPlayers('powerUsed', clienttranslate('${player_name} uses ${character_name}\'s power'), [
            'player_id' => $player_id,
            'player_name' => $this->getActivePlayerName(),
            'card_id' => $card_id,
            'character_name' => $char_info['name'],
            'power' => $char_info['power'] ?? ''
        ]);
        
        // TODO: Implement specific power effects based on character
        // For now, just stay in current state
    }
    
    /**
     * Rest one exhausted Hordier (reactivate power)
     * If card_id is provided, rest that specific card. Otherwise, rest the first exhausted one.
     * Returns the rested card or null if none available
     */
    function restOneHordier(int $player_id, ?int $card_id = null): ?array
    {
        // Find exhausted Hordier (specific or first available)
        if ($card_id !== null) {
            $exhausted_card = $this->getObjectFromDB(
                "SELECT * FROM card WHERE card_id = $card_id AND card_location = 'horde_$player_id' AND card_power_used = 1 LIMIT 1"
            );
        } else {
            $exhausted_card = $this->getObjectFromDB(
                "SELECT * FROM card WHERE card_location = 'horde_$player_id' AND card_power_used = 1 LIMIT 1"
            );
        }
        
        if (!$exhausted_card) {
            return null;
        }
        
        // Reactivate power
        $this->DbQuery("UPDATE card SET card_power_used = 0 WHERE card_id = " . $exhausted_card['card_id']);
        
        return $exhausted_card;
    }
    
    /**
     * Rest all Hordiers (reactivate all powers) - used in cities
     * Returns the number of Hordiers rested
     */
    function restAllHordiers(int $player_id): int
    {
        // Count exhausted Hordiers
        $count = (int)$this->getUniqueValueFromDB(
            "SELECT COUNT(*) FROM card WHERE card_location = 'horde_$player_id' AND card_power_used = 1"
        );
        
        if ($count > 0) {
            // Reactivate all powers
            $this->DbQuery("UPDATE card SET card_power_used = 0 WHERE card_location = 'horde_$player_id'");
        }
        
        return $count;
    }
}
