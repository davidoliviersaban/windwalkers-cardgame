<?php
/**
 * Local game test - Simulate a confrontation scenario
 * Run with: php tests/LocalGameTest.php
 */

// Don't load the game class, we'll mock it instead

class LocalGameTest {
    private $game;

    public function __construct() {
        echo "=== Windwalkers - Local Game Test ===\n\n";
        
        // Create a mock of Windwalkers for testing
        $this->game = new class {
            /**
             * Count occurrences of each face (1-6) in a dice array, with optional filters.
             */
            function countFaceOccurrences($dice_list, $filter_type = null, $filter_owner = null)
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
             * Match challenge dice against an available pool of player dice counts, consuming used dice.
             */
            function matchAndConsumeDice($challenge_dice, &$available_counts, $dimension)
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
                    'remainingPerFaceChallenge' => $challenge_counts,
                    'remainingPerFacePlayerBefore' => $player_before,
                    'remainingPerFacePlayerAfter' => $available_counts,
                    'consumed' => $consumed
                ];
            }
        };
    }

    public function testConfrontation1_Victory() {
        echo "TEST 1: Player Victory\n";
        echo "───────────────────────────────────────\n";

        // Setup
        $wind_force = 2;
        $horde_dice = [
            ['dice_value' => 5, 'dice_type' => 'blue', 'dice_owner' => 'player'],
            ['dice_value' => 4, 'dice_type' => 'blue', 'dice_owner' => 'player'],
            ['dice_value' => 3, 'dice_type' => 'blue', 'dice_owner' => 'player'],
            ['dice_value' => 2, 'dice_type' => 'blue', 'dice_owner' => 'player'],
            ['dice_value' => 1, 'dice_type' => 'blue', 'dice_owner' => 'player'],
        ];

        $wind_dice = [
            ['dice_value' => 1, 'dice_type' => 'green', 'dice_owner' => 'challenge'],
            ['dice_value' => 2, 'dice_type' => 'green', 'dice_owner' => 'challenge'],
            ['dice_value' => 3, 'dice_type' => 'white', 'dice_owner' => 'challenge'],
            ['dice_value' => 4, 'dice_type' => 'white', 'dice_owner' => 'challenge'],
            ['dice_value' => 5, 'dice_type' => 'black', 'dice_owner' => 'challenge'],
        ];

        $horde_sum = array_sum(array_column($horde_dice, 'dice_value'));
        $wind_sum = array_sum(array_column($wind_dice, 'dice_value'));

        echo "Horde: " . implode(', ', array_column($horde_dice, 'dice_value')) . " (sum: $horde_sum)\n";
        echo "Wind:  " . implode(', ', array_column($wind_dice, 'dice_value')) . " (sum: $wind_sum)\n";
        echo "Wind force: $wind_force\n\n";

        // Get available counts
        $available_counts = $this->game->countFaceOccurrences($horde_dice, null, 'player');
        echo "Available player counts: ";
        for ($i = 1; $i <= 6; $i++) {
            if ($available_counts[$i] > 0) echo "$i:$available_counts[$i] ";
        }
        echo "\n\n";

        // Greens
        $green_match = $this->game->matchAndConsumeDice($wind_dice, $available_counts, 'green');
        $greens_ok = ($green_match['matched'] >= $green_match['required'] || $green_match['matched'] >= $wind_force);
        echo "GREENS (terrain):\n";
        echo "  Required: {$green_match['required']}, Matched: {$green_match['matched']}, OK: " . ($greens_ok ? "YES" : "NO") . "\n";
        echo "  After greens, available: ";
        for ($i = 1; $i <= 6; $i++) {
            if ($available_counts[$i] > 0) echo "$i:$available_counts[$i] ";
        }
        echo "\n\n";

        // Reduce wind force
        $wind_force = max(0, $wind_force - $green_match['matched']);
        echo "  Wind force reduced to: $wind_force\n\n";

        // Whites
        $white_match = $this->game->matchAndConsumeDice($wind_dice, $available_counts, 'white');
        $whites_ok = ($white_match['matched'] >= $wind_force);
        echo "WHITES (wind):\n";
        echo "  Required: $wind_force, Matched: {$white_match['matched']}, OK: " . ($whites_ok ? "YES" : "NO") . "\n";
        echo "  After whites, available: ";
        for ($i = 1; $i <= 6; $i++) {
            if ($available_counts[$i] > 0) echo "$i:$available_counts[$i] ";
        }
        echo "\n\n";

        // Blacks
        $black_match = $this->game->matchAndConsumeDice($wind_dice, $available_counts, 'black');
        $blacks_ok = ($black_match['matched'] >= $black_match['required']);
        echo "BLACKS (fate):\n";
        echo "  Required: {$black_match['required']}, Matched: {$black_match['matched']}, OK: " . ($blacks_ok ? "YES" : "NO") . "\n\n";

        // Result
        $success = ($horde_sum >= $wind_sum) && $greens_ok && $whites_ok && $blacks_ok;
        echo "RESULT: " . ($success ? "✅ VICTORY" : "❌ DEFEAT") . "\n";
        echo "  Sum check: $horde_sum >= $wind_sum = " . ($horde_sum >= $wind_sum ? "YES" : "NO") . "\n";
        echo "  All conditions: greens_ok=$greens_ok, whites_ok=$whites_ok, blacks_ok=$blacks_ok\n";
        echo "\n";

        return $success;
    }

    public function testConfrontation2_Defeat_NotEnoughGreens() {
        echo "TEST 2: Player Defeat - Not Enough Greens\n";
        echo "───────────────────────────────────────\n";

        // Setup
        $wind_force = 2;
        $horde_dice = [
            ['dice_value' => 2, 'dice_type' => 'blue', 'dice_owner' => 'player'],
            ['dice_value' => 2, 'dice_type' => 'blue', 'dice_owner' => 'player'],
            ['dice_value' => 2, 'dice_type' => 'blue', 'dice_owner' => 'player'],
        ];

        $wind_dice = [
            ['dice_value' => 1, 'dice_type' => 'green', 'dice_owner' => 'challenge'],
            ['dice_value' => 2, 'dice_type' => 'green', 'dice_owner' => 'challenge'],
            ['dice_value' => 3, 'dice_type' => 'green', 'dice_owner' => 'challenge'],  // Can't match face 3
            ['dice_value' => 4, 'dice_type' => 'white', 'dice_owner' => 'challenge'],
        ];

        $horde_sum = array_sum(array_column($horde_dice, 'dice_value'));
        $wind_sum = array_sum(array_column($wind_dice, 'dice_value'));

        echo "Horde: " . implode(', ', array_column($horde_dice, 'dice_value')) . " (sum: $horde_sum)\n";
        echo "Wind:  " . implode(', ', array_column($wind_dice, 'dice_value')) . " (sum: $wind_sum)\n";
        echo "Wind force: $wind_force\n\n";

        // Get available counts
        $available_counts = $this->game->countFaceOccurrences($horde_dice, null, 'player');

        // Greens
        $green_match = $this->game->matchAndConsumeDice($wind_dice, $available_counts, 'green');
        $greens_ok = ($green_match['matched'] >= $green_match['required'] || $green_match['matched'] >= $wind_force);
        echo "GREENS:\n";
        echo "  Required: {$green_match['required']}, Matched: {$green_match['matched']}, OK: " . ($greens_ok ? "YES" : "NO") . "\n\n";

        // Result
        $success = ($horde_sum >= $wind_sum) && $greens_ok;
        echo "RESULT: " . ($success ? "✅ VICTORY" : "❌ DEFEAT") . "\n";
        echo "  Greens failed - not all terrain dice matched\n";
        echo "\n";

        return !$success;  // We expect defeat
    }

    public function testConfrontation3_GreensReduceWindForce() {
        echo "TEST 3: Greens Reduce Wind Force\n";
        echo "───────────────────────────────────────\n";

        // Setup
        $wind_force = 4;
        $horde_dice = [
            ['dice_value' => 1, 'dice_type' => 'blue', 'dice_owner' => 'player'],
            ['dice_value' => 1, 'dice_type' => 'blue', 'dice_owner' => 'player'],
            ['dice_value' => 1, 'dice_type' => 'blue', 'dice_owner' => 'player'],
            ['dice_value' => 2, 'dice_type' => 'blue', 'dice_owner' => 'player'],
            ['dice_value' => 2, 'dice_type' => 'blue', 'dice_owner' => 'player'],
        ];

        $wind_dice = [
            ['dice_value' => 1, 'dice_type' => 'green', 'dice_owner' => 'challenge'],
            ['dice_value' => 1, 'dice_type' => 'green', 'dice_owner' => 'challenge'],
            ['dice_value' => 2, 'dice_type' => 'white', 'dice_owner' => 'challenge'],
            ['dice_value' => 2, 'dice_type' => 'white', 'dice_owner' => 'challenge'],
        ];

        $horde_sum = array_sum(array_column($horde_dice, 'dice_value'));
        $wind_sum = array_sum(array_column($wind_dice, 'dice_value'));

        echo "Horde sum: $horde_sum\n";
        echo "Wind sum: $wind_sum\n";
        echo "Initial wind force: $wind_force\n";
        echo "Wind dice: 2x green 1, 2x white 2\n\n";

        // Get available counts
        $available_counts = $this->game->countFaceOccurrences($horde_dice, null, 'player');

        // Greens
        $green_match = $this->game->matchAndConsumeDice($wind_dice, $available_counts, 'green');
        echo "Greens matched: {$green_match['matched']} (all required: {$green_match['required']})\n";

        $wind_force = max(0, $wind_force - $green_match['matched']);
        echo "Wind force REDUCED: 4 - 2 = $wind_force\n\n";

        // Whites
        $white_match = $this->game->matchAndConsumeDice($wind_dice, $available_counts, 'white');
        $whites_ok = ($white_match['matched'] >= $wind_force);
        echo "Whites needed to match: $wind_force\n";
        echo "Whites matched: {$white_match['matched']}\n";
        echo "Whites OK: " . ($whites_ok ? "YES" : "NO") . "\n\n";

        $success = ($horde_sum >= $wind_sum) && $whites_ok;
        echo "RESULT: " . ($success ? "✅ VICTORY" : "❌ DEFEAT") . "\n";
        echo "\n";

        return $success;
    }

    public function run() {
        $results = [];
        
        $results[] = ['Test 1: Victory', $this->testConfrontation1_Victory()];
        $results[] = ['Test 2: Defeat (No Greens)', $this->testConfrontation2_Defeat_NotEnoughGreens()];
        $results[] = ['Test 3: Greens Reduce Wind', $this->testConfrontation3_GreensReduceWindForce()];

        echo "\n";
        echo "=== SUMMARY ===\n";
        $passed = 0;
        foreach ($results as [$name, $result]) {
            $status = $result ? "✅ PASS" : "❌ FAIL";
            echo "$status - $name\n";
            if ($result) $passed++;
        }
        echo "\nTotal: $passed/" . count($results) . " passed\n";
    }
}

$test = new LocalGameTest();
$test->run();
