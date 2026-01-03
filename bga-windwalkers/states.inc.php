<?php
/**
 *------
 * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
 * Windwalkers implementation : © David Saban davidolivier.saban@gmail.com
 * -----
 *
 * states.inc.php
 *
 * Windwalkers game states description
 */

$machinestates = [

    // ==================== DRAFT PHASE ====================
    
    2 => [
        "name" => "draftHorde",
        "description" => clienttranslate('${actplayer} must compose their Horde'),
        "descriptionmyturn" => clienttranslate('${you} must select 8 characters: 1 Traceur, 2 Fers, 3 Packs, 2 Traînes'),
        "type" => "activeplayer",
        "possibleactions" => ["actToggleDraftCard", "actConfirmDraft"],
        "args" => "argDraftHorde",
        "transitions" => [
            "hordeComplete" => 3,
            "selectMore" => 2
        ]
    ],

    3 => [
        "name" => "nextDraft",
        "description" => "",
        "type" => "game",
        "action" => "stNextDraft",
        "transitions" => [
            "nextPlayer" => 2,
            "allDrafted" => 10
        ]
    ],

    // ==================== MAIN GAME LOOP ====================

    // Player's turn: select tile to move (surpass is automatic if already moved)
    10 => [
        "name" => "playerTurn",
        "description" => clienttranslate('${actplayer} must choose an action'),
        "descriptionmyturn" => clienttranslate('${you} must select a tile to move, or rest'),
        "type" => "activeplayer",
        "possibleactions" => ["actSelectTile", "actRest", "actUsePower"],
        "args" => "argPlayerTurn",
        "transitions" => [
            "moveToTile" => 20,
            "rest" => 30
        ]
    ],

    // ==================== MOVEMENT & WIND ====================

    20 => [
        "name" => "revealWind",
        "description" => clienttranslate('Revealing wind force...'),
        "type" => "game",
        "action" => "stRevealWind",
        "transitions" => [
            "windRevealed" => 25,
            "noWind" => 40  // Cities and special locations
        ]
    ],

    25 => [
        "name" => "confrontation",
        "description" => clienttranslate('${actplayer} faces the wind challenge'),
        "descriptionmyturn" => clienttranslate('${you} must roll dice to overcome the wind'),
        "type" => "activeplayer",
        "possibleactions" => [
            "actRollDice",
            "actUsePower"
        ],
        "args" => "argConfrontation",
        "transitions" => [
            "diceRolled" => 26,
            "checkResult" => 35
        ]
    ],

    26 => [
        "name" => "diceResult",
        "description" => clienttranslate('${actplayer} may modify dice or confirm'),
        "descriptionmyturn" => clienttranslate('${you} may spend moral to modify dice, or confirm your roll'),
        "type" => "activeplayer",
        "possibleactions" => [
            "actUseMoral",
            "actRerollAll",
            "actConfirmRoll",
            "actUsePower",
            "actBatchActions"
        ],
        "args" => "argConfrontation",
        "transitions" => [
            "modified" => 26,
            "checkResult" => 35
        ]
    ],

    35 => [
        "name" => "resolveConfrontation",
        "description" => clienttranslate('Resolving confrontation...'),
        "type" => "game",
        "action" => "stResolveConfrontation",
        "transitions" => [
            "success" => 40,
            "failure" => 45
        ]
    ],

    // ==================== REST ====================

    30 => [
        "name" => "rest",
        "description" => clienttranslate('Processing rest...'),
        "type" => "game",
        "action" => "stRest",
        "transitions" => [
            "restComplete" => 70  // Skip recruitment, go directly to nextPlayer
        ]
    ],

    // ==================== SUCCESS PATH ====================

    40 => [
        "name" => "applyTileEffect",
        "description" => clienttranslate('Applying tile effects...'),
        "type" => "game",
        "action" => "stApplyTileEffect",
        "transitions" => [
            "continue" => 70,   // After success: go to continueOrRest (surpass or rest)
            "recruit" => 55,    // Village/City: recruit first, then continueOrRest
            "endChapter" => 60
        ]
    ],

    // ==================== FAILURE PATH ====================

    45 => [
        "name" => "loseHordier",
        "description" => clienttranslate('${actplayer} must abandon a Hordier'),
        "descriptionmyturn" => clienttranslate('${you} must choose any Hordier to abandon'),
        "type" => "activeplayer",
        "possibleactions" => ["actAbandonHordier", "actAbandonGame"],
        "args" => "argLoseHordier",
        "transitions" => [
            "hordierLost" => 30,  // Rest after failure (no surpass possible)
            "eliminate" => 46    // Player will be eliminated
        ]
    ],

    // Player elimination (game state to properly eliminate active player)
    46 => [
        "name" => "playerElimination",
        "description" => clienttranslate('Processing elimination...'),
        "type" => "game",
        "action" => "stPlayerElimination",
        "transitions" => [
            "finalScoring" => 98  // Go to final scoring before gameEnd
        ]
    ],

    // ==================== RECRUITMENT ====================

    55 => [
        "name" => "recruitment",
        "description" => clienttranslate('${actplayer} may recruit new Hordiers'),
        "descriptionmyturn" => clienttranslate('${you} may recruit new characters or skip'),
        "type" => "activeplayer",
        "possibleactions" => ["actRecruit", "actReleaseHordier", "actSkipRecruitment"],
        "args" => "argRecruitment",
        "transitions" => [
            "recruited" => 55,  // Can recruit multiple
            "mustRelease" => 56,  // Over 8 hordiers, must release
            "done" => 70  // After recruitment: go to continueOrRest (surpass or rest)
        ]
    ],

    56 => [
        "name" => "mustReleaseHordier",
        "description" => clienttranslate('${actplayer} must release a Hordier (max 8)'),
        "descriptionmyturn" => clienttranslate('${you} must release a Hordier to stay under 8'),
        "type" => "activeplayer",
        "possibleactions" => ["actReleaseHordier"],
        "args" => "argMustReleaseHordier",
        "transitions" => [
            "released" => 55  // Back to recruitment after releasing
        ]
    ],

    // ==================== CHAPTER END ====================

    60 => [
        "name" => "endChapter",
        "description" => clienttranslate('Chapter ${chapter_num} complete!'),
        "type" => "game",
        "action" => "stEndChapter",
        "args" => "argEndChapter",
        "transitions" => [
            "nextChapter" => 65,
            "finalScoring" => 98,
            "gameEnd" => 99
        ]
    ],

    65 => [
        "name" => "setupNextChapter",
        "description" => clienttranslate('Setting up Chapter ${chapter_num}...'),
        "type" => "game",
        "action" => "stSetupNextChapter",
        "args" => "argSetupNextChapter",
        "transitions" => [
            "chapterDraft" => 66,  // Go to chapter draft phase
            "chapterReady" => 10   // Legacy: skip draft for existing games
        ]
    ],

    // ==================== CHAPTER DRAFT ====================

    66 => [
        "name" => "chapterDraft",
        "description" => clienttranslate('${actplayer} may recruit or release characters'),
        "descriptionmyturn" => clienttranslate('${you} may recruit or release characters. Click pool cards to recruit, horde cards to release.'),
        "type" => "activeplayer",
        "possibleactions" => ["actChapterDraftRecruit", "actChapterDraftRelease", "actChapterDraftDone"],
        "args" => "argChapterDraft",
        "transitions" => [
            "recruited" => 66,  // Stay in same state to recruit more
            "released" => 66,   // Stay in same state after releasing
            "mustRelease" => 66, // Must release (too many hordiers)
            "done" => 67  // Player finished drafting
        ]
    ],

    67 => [
        "name" => "nextChapterDraft",
        "description" => "",
        "type" => "game",
        "action" => "stNextChapterDraft",
        "transitions" => [
            "nextPlayer" => 66,  // Next player drafts
            "allDrafted" => 10   // All players done, start chapter
        ]
    ],

    // ==================== NEXT PLAYER ====================

    70 => [
        "name" => "nextPlayer",
        "description" => "",
        "type" => "game",
        "action" => "stNextPlayer",
        "transitions" => [
            "nextTurn" => 10,  // After rest: next player must move
            "endRound" => 75
        ]
    ],

    75 => [
        "name" => "endRound",
        "description" => clienttranslate('End of round'),
        "type" => "game",
        "action" => "stEndRound",
        "transitions" => [
            "newRound" => 10
        ]
    ],
            
    // ==================== FINAL SCORING BRIDGE ====================

    98 => [
        "name" => "finalScoring",
        "description" => clienttranslate('Computing final scores...'),
        "type" => "game",
        "action" => "stFinalScoring",
        "transitions" => [
            "gameEnd" => 99
        ]
    ],
    
    // ==================== GAME END ====================

    99 => [
        "name" => "gameEnd",
        "description" => clienttranslate('Game Over'),
        "type" => "manager",
        "action" => "stGameEnd",
        "args" => "argGameEnd"
    ]

];
