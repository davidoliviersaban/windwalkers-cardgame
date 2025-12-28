<?php
/**
 * Unit tests for dice matching and consumption logic
 * Tests countFaceOccurrences and matchAndConsumeDice functions
 */

use PHPUnit\Framework\TestCase;

class DiceMatchingTest extends TestCase
{
    private $game;

    protected function setUp(): void
    {
        // Create a mock of the Windwalkers game class for testing
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
             * The $available_counts array (face => count) is mutated to reflect dice spent on this dimension.
             */
            function matchAndConsumeDice($challenge_dice, &$available_counts, $dimension, $force = 0)
            {
                $challenge_counts = $this->countFaceOccurrences($challenge_dice, $dimension, 'challenge');
                $player_before = $available_counts; // snapshot before consumption

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

    // ============ countFaceOccurrences Tests ============

    public function testCountFaceOccurrences_EmptyDiceList()
    {
        $counts = $this->game->countFaceOccurrences([], null, null);
        $this->assertEquals([1=>0, 2=>0, 3=>0, 4=>0, 5=>0, 6=>0], $counts);
    }

    public function testCountFaceOccurrences_AllFaces()
    {
        $dice = [
            ['dice_value' => 1, 'dice_type' => 'blue', 'dice_owner' => 'player'],
            ['dice_value' => 2, 'dice_type' => 'blue', 'dice_owner' => 'player'],
            ['dice_value' => 3, 'dice_type' => 'blue', 'dice_owner' => 'player'],
            ['dice_value' => 4, 'dice_type' => 'blue', 'dice_owner' => 'player'],
            ['dice_value' => 5, 'dice_type' => 'blue', 'dice_owner' => 'player'],
            ['dice_value' => 6, 'dice_type' => 'blue', 'dice_owner' => 'player'],
        ];
        $counts = $this->game->countFaceOccurrences($dice, null, 'player');
        $this->assertEquals([1=>1, 2=>1, 3=>1, 4=>1, 5=>1, 6=>1], $counts);
    }

    public function testCountFaceOccurrences_DuplicateFaces()
    {
        $dice = [
            ['dice_value' => 1, 'dice_type' => 'blue', 'dice_owner' => 'player'],
            ['dice_value' => 1, 'dice_type' => 'blue', 'dice_owner' => 'player'],
            ['dice_value' => 1, 'dice_type' => 'blue', 'dice_owner' => 'player'],
            ['dice_value' => 6, 'dice_type' => 'blue', 'dice_owner' => 'player'],
            ['dice_value' => 6, 'dice_type' => 'blue', 'dice_owner' => 'player'],
        ];
        $counts = $this->game->countFaceOccurrences($dice, null, 'player');
        $this->assertEquals([1=>3, 2=>0, 3=>0, 4=>0, 5=>0, 6=>2], $counts);
    }

    public function testCountFaceOccurrences_FilterByType()
    {
        $dice = [
            ['dice_value' => 1, 'dice_type' => 'green', 'dice_owner' => 'challenge'],
            ['dice_value' => 2, 'dice_type' => 'green', 'dice_owner' => 'challenge'],
            ['dice_value' => 3, 'dice_type' => 'white', 'dice_owner' => 'challenge'],
            ['dice_value' => 4, 'dice_type' => 'white', 'dice_owner' => 'challenge'],
            ['dice_value' => 5, 'dice_type' => 'black', 'dice_owner' => 'challenge'],
        ];
        
        $green_counts = $this->game->countFaceOccurrences($dice, 'green', 'challenge');
        $this->assertEquals([1=>1, 2=>1, 3=>0, 4=>0, 5=>0, 6=>0], $green_counts);
        
        $white_counts = $this->game->countFaceOccurrences($dice, 'white', 'challenge');
        $this->assertEquals([1=>0, 2=>0, 3=>1, 4=>1, 5=>0, 6=>0], $white_counts);
    }

    public function testCountFaceOccurrences_FilterByOwner()
    {
        $dice = [
            ['dice_value' => 1, 'dice_type' => 'blue', 'dice_owner' => 'player'],
            ['dice_value' => 2, 'dice_type' => 'blue', 'dice_owner' => 'player'],
            ['dice_value' => 1, 'dice_type' => 'green', 'dice_owner' => 'challenge'],
            ['dice_value' => 2, 'dice_type' => 'white', 'dice_owner' => 'challenge'],
        ];
        
        $player_counts = $this->game->countFaceOccurrences($dice, null, 'player');
        $this->assertEquals([1=>1, 2=>1, 3=>0, 4=>0, 5=>0, 6=>0], $player_counts);
        
        $challenge_counts = $this->game->countFaceOccurrences($dice, null, 'challenge');
        $this->assertEquals([1=>1, 2=>1, 3=>0, 4=>0, 5=>0, 6=>0], $challenge_counts);
    }

    // ============ matchAndConsumeDice Tests ============

    public function testMatchAndConsumeDice_PerfectMatch()
    {
        // Challenge: 2x green 1, 1x green 2
        $challenge_dice = [
            ['dice_value' => 1, 'dice_type' => 'green', 'dice_owner' => 'challenge'],
            ['dice_value' => 1, 'dice_type' => 'green', 'dice_owner' => 'challenge'],
            ['dice_value' => 2, 'dice_type' => 'green', 'dice_owner' => 'challenge'],
        ];
        
        // Available: 3x face 1, 2x face 2, 1x face 6
        $available = [1=>3, 2=>2, 3=>0, 4=>0, 5=>0, 6=>1];
        
        $result = $this->game->matchAndConsumeDice($challenge_dice, $available, 'green');
        
        $this->assertEquals(3, $result['required']);
        $this->assertEquals(3, $result['matched']);
        $this->assertTrue($result['ok']);
        
        // Check consumption
        $this->assertEquals([1=>1, 2=>1, 3=>0, 4=>0, 5=>0, 6=>1], $available);
    }

    public function testMatchAndConsumeDice_PartialMatch()
    {
        // Challenge: 3x green 1
        $challenge_dice = [
            ['dice_value' => 1, 'dice_type' => 'green', 'dice_owner' => 'challenge'],
            ['dice_value' => 1, 'dice_type' => 'green', 'dice_owner' => 'challenge'],
            ['dice_value' => 1, 'dice_type' => 'green', 'dice_owner' => 'challenge'],
        ];
        
        // Available: 2x face 1 only
        $available = [1=>2, 2=>0, 3=>0, 4=>0, 5=>0, 6=>0];
        
        $result = $this->game->matchAndConsumeDice($challenge_dice, $available, 'green');
        
        $this->assertEquals(3, $result['required']);
        $this->assertEquals(2, $result['matched']);
        $this->assertFalse($result['ok']);
        
        // Check consumption
        $this->assertEquals([1=>0, 2=>0, 3=>0, 4=>0, 5=>0, 6=>0], $available);
    }

    public function testMatchAndConsumeDice_NoMatch()
    {
        // Challenge: 2x green 1
        $challenge_dice = [
            ['dice_value' => 1, 'dice_type' => 'green', 'dice_owner' => 'challenge'],
            ['dice_value' => 1, 'dice_type' => 'green', 'dice_owner' => 'challenge'],
        ];
        
        // Available: only face 6
        $available = [1=>0, 2=>0, 3=>0, 4=>0, 5=>0, 6=>3];
        
        $result = $this->game->matchAndConsumeDice($challenge_dice, $available, 'green');
        
        $this->assertEquals(2, $result['required']);
        $this->assertEquals(0, $result['matched']);
        $this->assertFalse($result['ok']);
        
        // Check no consumption
        $this->assertEquals([1=>0, 2=>0, 3=>0, 4=>0, 5=>0, 6=>3], $available);
    }

    public function testMatchAndConsumeDice_EmptyChallenge()
    {
        // No challenge dice
        $challenge_dice = [];
        
        $available = [1=>5, 2=>4, 3=>3, 4=>2, 5=>1, 6=>0];
        
        $result = $this->game->matchAndConsumeDice($challenge_dice, $available, 'green');
        
        $this->assertEquals(0, $result['required']);
        $this->assertEquals(0, $result['matched']);
        $this->assertTrue($result['ok']);
        
        // No consumption
        $this->assertEquals([1=>5, 2=>4, 3=>3, 4=>2, 5=>1, 6=>0], $available);
    }

    public function testMatchAndConsumeDice_MultipleConsumption()
    {
        // Challenge: 1x each face 1-3
        $challenge_dice = [
            ['dice_value' => 1, 'dice_type' => 'green', 'dice_owner' => 'challenge'],
            ['dice_value' => 2, 'dice_type' => 'green', 'dice_owner' => 'challenge'],
            ['dice_value' => 3, 'dice_type' => 'green', 'dice_owner' => 'challenge'],
        ];
        
        // Available: 2 each
        $available = [1=>2, 2=>2, 3=>2, 4=>2, 5=>2, 6=>2];
        
        $result = $this->game->matchAndConsumeDice($challenge_dice, $available, 'green');
        
        $this->assertEquals(3, $result['matched']);
        $this->assertTrue($result['ok']);
        
        // Check correct consumption
        $this->assertEquals([1=>1, 2=>1, 3=>1, 4=>2, 5=>2, 6=>2], $available);
    }

    // ============ Sequential Consumption (Chain) Tests ============

    public function testSequentialConsumption_GreenThenWhiteThenBlack()
    {
        // Simulate a full confrontation: greens consumed (reducing wind force), then whites, then blacks

        // Challenge dice: 2x green 1, 2x white 1, 2x black 1
        $challenge_dice = [
            ['dice_value' => 1, 'dice_type' => 'green', 'dice_owner' => 'challenge'],
            ['dice_value' => 1, 'dice_type' => 'green', 'dice_owner' => 'challenge'],
            ['dice_value' => 1, 'dice_type' => 'white', 'dice_owner' => 'challenge'],
            ['dice_value' => 1, 'dice_type' => 'white', 'dice_owner' => 'challenge'],
            ['dice_value' => 1, 'dice_type' => 'black', 'dice_owner' => 'challenge'],
            ['dice_value' => 1, 'dice_type' => 'black', 'dice_owner' => 'challenge'],
        ];

        // Player has 3x face 1, 3x face 2
        $available = [1=>3, 2=>3, 3=>0, 4=>0, 5=>0, 6=>0];

        // Initial wind force
        $wind_force = 2;

        // First: greens consume 2x face 1
        $green_result = $this->game->matchAndConsumeDice($challenge_dice, $available, 'green');
        $this->assertEquals(2, $green_result['matched']);
        $this->assertEquals([1=>1, 2=>3, 3=>0, 4=>0, 5=>0, 6=>0], $available);
        
        // Reduce wind force by matched greens
        $wind_force = max(0, $wind_force - $green_result['matched']); // 2 - 2 = 0
        $this->assertEquals(0, $wind_force);

        // Second: whites need 0 force (already satisfied by greens)
        $white_result = $this->game->matchAndConsumeDice($challenge_dice, $available, 'white');
        $this->assertEquals(1, $white_result['matched']); // Only 1 face 1 left
        $this->assertEquals([1=>0, 2=>3, 3=>0, 4=>0, 5=>0, 6=>0], $available);
        
        // Check whites ok (1 >= 0)
        $whites_ok = $white_result['matched'] >= $wind_force;
        $this->assertTrue($whites_ok);

        // Third: blacks consume 0 face 1 (none left), fail
        $black_result = $this->game->matchAndConsumeDice($challenge_dice, $available, 'black');
        $this->assertEquals(0, $black_result['matched']); // No face 1 left for blacks
        $this->assertFalse($black_result['ok']); // Need 2, got 0
        $this->assertEquals([1=>0, 2=>3, 3=>0, 4=>0, 5=>0, 6=>0], $available);
    }

    public function testSequentialConsumption_AvoidDiceReuse()
    {
        // Test that a die consumed by greens cannot be reused by whites
        $challenge_dice = [
            ['dice_value' => 3, 'dice_type' => 'green', 'dice_owner' => 'challenge'],
            ['dice_value' => 3, 'dice_type' => 'green', 'dice_owner' => 'challenge'],
            ['dice_value' => 3, 'dice_type' => 'white', 'dice_owner' => 'challenge'],
        ];

        // Player has exactly 2x face 3
        $available = [1=>0, 2=>0, 3=>2, 4=>0, 5=>0, 6=>0];

        // Greens: need 2x face 3, match 2
        $green_result = $this->game->matchAndConsumeDice($challenge_dice, $available, 'green');
        $this->assertEquals(2, $green_result['matched']);
        $this->assertEquals([1=>0, 2=>0, 3=>0, 4=>0, 5=>0, 6=>0], $available);

        // Whites: need 1x face 3, but 0 available (already consumed)
        $white_result = $this->game->matchAndConsumeDice($challenge_dice, $available, 'white');
        $this->assertEquals(0, $white_result['matched']);
        $this->assertEquals([1=>0, 2=>0, 3=>0, 4=>0, 5=>0, 6=>0], $available);
    }

    // ============ Edge Cases ============

    public function testMatchAndConsumeDice_InvalidFaceValues()
    {
        $challenge_dice = [
            ['dice_value' => 0, 'dice_type' => 'green', 'dice_owner' => 'challenge'],  // Invalid
            ['dice_value' => 7, 'dice_type' => 'green', 'dice_owner' => 'challenge'],  // Invalid
            ['dice_value' => 3, 'dice_type' => 'green', 'dice_owner' => 'challenge'],  // Valid
        ];

        $available = [1=>0, 2=>0, 3=>2, 4=>0, 5=>0, 6=>0];

        $result = $this->game->matchAndConsumeDice($challenge_dice, $available, 'green');
        
        // Only the valid face 3 should be counted
        $this->assertEquals(1, $result['required']);
        $this->assertEquals(1, $result['matched']);
    }

    public function testMatchAndConsumeDice_ZeroAvailable()
    {
        $challenge_dice = [
            ['dice_value' => 1, 'dice_type' => 'green', 'dice_owner' => 'challenge'],
        ];

        $available = [1=>0, 2=>0, 3=>0, 4=>0, 5=>0, 6=>0];

        $result = $this->game->matchAndConsumeDice($challenge_dice, $available, 'green');
        
        $this->assertEquals(1, $result['required']);
        $this->assertEquals(0, $result['matched']);
        $this->assertFalse($result['ok']);
    }

    public function testMatchAndConsumeDice_AllFacesRequired()
    {
        // Challenge all faces 1-6
        $challenge_dice = [
            ['dice_value' => 1, 'dice_type' => 'green', 'dice_owner' => 'challenge'],
            ['dice_value' => 2, 'dice_type' => 'green', 'dice_owner' => 'challenge'],
            ['dice_value' => 3, 'dice_type' => 'green', 'dice_owner' => 'challenge'],
            ['dice_value' => 4, 'dice_type' => 'green', 'dice_owner' => 'challenge'],
            ['dice_value' => 5, 'dice_type' => 'green', 'dice_owner' => 'challenge'],
            ['dice_value' => 6, 'dice_type' => 'green', 'dice_owner' => 'challenge'],
        ];

        // Available exactly match
        $available = [1=>1, 2=>1, 3=>1, 4=>1, 5=>1, 6=>1];

        $result = $this->game->matchAndConsumeDice($challenge_dice, $available, 'green');
        
        $this->assertEquals(6, $result['required']);
        $this->assertEquals(6, $result['matched']);
        $this->assertTrue($result['ok']);
        $this->assertEquals([1=>0, 2=>0, 3=>0, 4=>0, 5=>0, 6=>0], $available);
    }
}
