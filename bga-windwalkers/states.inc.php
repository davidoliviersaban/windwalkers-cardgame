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

    // The initial state. Please do not modify.
    1 => [
        "name" => "gameSetup",
        "description" => "",
        "type" => "manager",
        "action" => "stGameSetup",
        "transitions" => ["" => 2]
    ],

    // ==================== DRAFT PHASE ====================
    
    2 => [
        "name" => "draftHorde",
        "description" => clienttranslate('${actplayer} must compose their Horde'),
        "descriptionmyturn" => clienttranslate('${you} must select 8 characters: 1 Traceur, 2 Fers, 3 Packs, 2 Traînes'),
        "type" => "activeplayer",
        "possibleactions" => ["actSelectCharacter", "actRemoveCharacter", "actConfirmHorde"],
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

    // Player's turn: must move if first action, can surpass or rest if already moved
    10 => [
        "name" => "playerTurn",
        "description" => clienttranslate('${actplayer} must choose an action'),
        "descriptionmyturn" => clienttranslate('${you} must select a tile to move (or surpass and move, or rest if already moved)'),
        "type" => "activeplayer",
        "possibleactions" => ["actSelectTile", "actRest", "actSurpassAndSelectTile", "actUsePower"],
        "args" => "argPlayerTurn",
        "transitions" => [
            "moveToTile" => 20,
            "rest" => 30,
            "endGame" => 99
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
        "descriptionmyturn" => clienttranslate('${you} must roll dice and overcome the wind'),
        "type" => "activeplayer",
        "possibleactions" => [
            "actRollDice",
            "actUsePower",
            "actUseMoral",      // Modify dice ±1
            "actRerollAll",     // Spend moral to reroll all
            "actConfirmRoll"    // Accept current roll
        ],
        "args" => "argConfrontation",
        "transitions" => [
            "rollAgain" => 25,
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
        "description" => clienttranslate('${actplayer} is resting'),
        "descriptionmyturn" => clienttranslate('${you} are resting - select a Hordier to restore their power'),
        "type" => "activeplayer",
        "possibleactions" => [
            "actSelectHordierToRest", 
            "actUsePower",
            "actRestAll"],
        "args" => "argRest",
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
        "possibleactions" => ["actAbandonHordier"],
        "args" => "argLoseHordier",
        "transitions" => [
            "hordierLost" => 30,  // Rest after failure (no surpass possible)
            "gameOver" => 99
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
            "done" => 70  // After recruitment: go to continueOrRest (surpass or rest)
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
            "gameEnd" => 99
        ]
    ],

    65 => [
        "name" => "setupNextChapter",
        "description" => clienttranslate('Setting up Chapter ${chapter_num}...'),
        "type" => "game",
        "action" => "stSetupNextChapter",
        "transitions" => [
            "chapterReady" => 2  // Back to draft for new chapter
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
            "endRound" => 75,
            "endGame" => 99
        ]
    ],

    75 => [
        "name" => "endRound",
        "description" => clienttranslate('End of round'),
        "type" => "game",
        "action" => "stEndRound",
        "transitions" => [
            "newRound" => 10,
            "endGame" => 99
        ]
    ],

    // ==================== GAME END ====================

    99 => [
        "name" => "gameEnd",
        "description" => clienttranslate("End of game"),
        "type" => "manager",
        "action" => "stGameEnd",
        "args" => "argGameEnd"
    ]

];
