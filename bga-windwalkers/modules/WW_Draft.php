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

    //////////////////////////////////////////////////////////////////////////////
    // Draft Actions
    //////////////////////////////////////////////////////////////////////////////
    
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
        
        $this->notify->all('cardToggled', '', [
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
        if ($card['location'] != 'deck') {
            throw new BgaUserException($this->_("This card is not available"));
        }
        
        $horde = $this->cards->getCardsInLocation('horde_' . $player_id);
        $char_info = $this->characters[$card['type_arg']] ?? [];
        $card_type = $char_info['type'] ?? $card['type'];
        $is_leader = !empty($char_info['is_leader']);
        
        $counts = $this->countHordeByType($horde);
        $requirements = $this->getHordeRequirements();
        
        $type_key = $is_leader ? 'traceur' : $card_type;
        
        if ($counts[$type_key] >= $requirements[$type_key]) {
            throw new BgaUserException($this->_("You already have enough characters of this type"));
        }
        
        $this->cards->moveCard($card['id'], 'horde_' . $player_id);
        $this->trackHordierSelection($card['id']);
    }

    /**
     * Deselect a card from draft
     */
    private function deselectDraftCard(int $player_id, int $card_id, array $card): void
    {
        if ($card['location'] != 'horde_' . $player_id) {
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
        
        $this->notify->all('draftComplete', clienttranslate('${player_name} has completed their horde'), [
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
            $char_info = $this->characters[$card['type_arg']] ?? [];
            $card_type = $char_info['type'] ?? $card['type'];
            $is_leader = !empty($char_info['is_leader']);
            
            if ($is_leader) {
                $counts['traceur']++;
            } else if (isset($counts[$card_type])) {
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
        
        $available = $this->getEnrichedCards($this->cards->getCardsInLocation('deck'));
        $selected = $this->getEnrichedCards($this->cards->getCardsInLocation('horde_' . $player_id));
        
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
            $charInfo = $this->characters[$card['type_arg']] ?? [];
            $card['name'] = $charInfo['name'] ?? 'Unknown';
            $card['char_type'] = $charInfo['type'] ?? $card['type'];
            $card['is_leader'] = !empty($charInfo['is_leader']);
            $card['power'] = $charInfo['power'] ?? '';
            $enriched[$card['id']] = $card;
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
        if ($type == 'traceur') {
            $cards = $this->getCollectionFromDb(
                "SELECT * FROM card WHERE card_type = 'fer' AND card_is_leader = 1 AND card_location = 'deck'"
            );
        } else if ($type == 'fer') {
            $cards = $this->getCollectionFromDb(
                "SELECT * FROM card WHERE card_type = 'fer' AND card_is_leader = 0 AND card_location = 'deck' LIMIT 1"
            );
        } else {
            $cards = $this->cards->getCardsOfTypeInLocation($type, null, 'deck');
        }
        
        if (empty($cards)) {
            return false;
        }
        
        $card = array_shift($cards);
        $this->cards->moveCard($card['card_id'] ?? $card['id'], 'horde_' . $player_id);
        $this->trackHordierSelection($card['card_id'] ?? $card['id']);
        $counts[$type]++;
        
        return true;
    }
}
