<?php
/**
 * WW_Dice - Dice rolling and matching utilities
 */

trait WW_Dice
{
    /**
     * Roll dice and return results
     */
    function rollDice(int $count, string $type, string $owner): array
    {
        $results = [];
        for ($i = 0; $i < $count; $i++) {
            $results[] = [
                'type' => $type,
                'value' => bga_rand(1, 6),
                'owner' => $owner
            ];
        }
        return $results;
    }
    
    /**
     * Store dice rolls in database and return dice with their DB IDs
     */
    function storeDiceRolls(array $dice_list): array
    {
        $result = [];
        foreach ($dice_list as $dice) {
            $this->DbQuery(
                "INSERT INTO dice_roll (dice_type, dice_value, dice_owner) 
                 VALUES ('{$dice['type']}', {$dice['value']}, '{$dice['owner']}')"
            );
            $dice_id = $this->DbGetLastId();
            $result[] = [
                'id' => $dice_id,
                'type' => $dice['type'],
                'value' => $dice['value'],
                'owner' => $dice['owner']
            ];
        }
        return $result;
    }
    
    /**
     * Clear all dice rolls from database
     */
    function clearDiceRolls(): void
    {
        $this->DbQuery("DELETE FROM dice_roll");
    }
    
    /**
     * Count occurrences of each face (1-6) in a dice array
     */
    function countFaceOccurrences(array $dice_list, ?string $filter_type = null, ?string $filter_owner = null): array
    {
        $counts = array_fill(1, 6, 0);
        foreach ($dice_list as $d) {
            if (($filter_type === null || $d['dice_type'] == $filter_type) &&
                ($filter_owner === null || $d['dice_owner'] == $filter_owner)) {
                $v = (int) $d['dice_value'];
                if ($v >= 1 && $v <= 6) {
                    $counts[$v]++;
                }
            }
        }
        return $counts;
    }
    
    /**
     * Match challenge dice against player dice, consuming matched dice
     * @param array $challenge_dice Challenge dice to match against
     * @param array &$available_counts Player dice counts (mutated)
     * @param string $dimension Dice type to match (green, white, black)
     */
    function matchAndConsumeDice(array $challenge_dice, array &$available_counts, string $dimension): array
    {
        $challenge_counts = $this->countFaceOccurrences($challenge_dice, $dimension, 'challenge');
        $player_before = $available_counts;

        $required = array_sum($challenge_counts);
        $matched = 0;
        $consumed = array_fill(1, 6, 0);

        for ($v = 1; $v <= 6; $v++) {
            $consumed[$v] = min($available_counts[$v], $challenge_counts[$v]);
            $matched += $consumed[$v];
            $available_counts[$v] -= $consumed[$v];
        }

        return [
            'required' => $required,
            'available_before' => array_sum($player_before),
            'available_after' => array_sum($available_counts),
            'matched' => $matched,
            'ok' => ($matched >= $required),
            'consumed' => $consumed
        ];
    }
}
