-- ------
-- BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
-- Windwalkers implementation : © David Saban davidolivier.saban@gmail.com
-- 
-- This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
-- See http://en.boardgamearena.com/#!doc/Studio for more information.
-- -----

-- Note: The database schema is automatically generated from this file
-- Do NOT rename this file

-- Extended player table
ALTER TABLE `player` ADD `player_moral` SMALLINT UNSIGNED NOT NULL DEFAULT '9';
ALTER TABLE `player` ADD `player_position_q` SMALLINT NOT NULL DEFAULT '3';
ALTER TABLE `player` ADD `player_position_r` SMALLINT NOT NULL DEFAULT '17';
ALTER TABLE `player` ADD `player_chapter` TINYINT UNSIGNED NOT NULL DEFAULT '1';
ALTER TABLE `player` ADD `player_day` SMALLINT UNSIGNED NOT NULL DEFAULT '0';
ALTER TABLE `player` ADD `player_has_moved` TINYINT UNSIGNED NOT NULL DEFAULT '0' COMMENT 'Number of movements this turn (0 = must move, >0 = can surpass or rest)';
ALTER TABLE `player` ADD `player_surpass_count` TINYINT UNSIGNED NOT NULL DEFAULT '0' COMMENT 'Total number of surpass this chapter (for scoring)';
ALTER TABLE `player` ADD `player_dice_count` TINYINT UNSIGNED NOT NULL DEFAULT '6';

-- Cards table (using Deck component)
CREATE TABLE IF NOT EXISTS `card` (
    `card_id` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
    `card_is_leader` TINYINT(1) UNSIGNED NOT NULL DEFAULT '0' COMMENT '1 = traceur (leader)',
    `card_type` VARCHAR(16) NOT NULL COMMENT 'fer, pack, traine',
    `card_type_arg` INT(11) NOT NULL COMMENT 'Character ID from material.inc.php',
    `card_location` VARCHAR(32) NOT NULL COMMENT 'deck, horde_PLAYER, discard, recruit_VILLAGE, recruit_CITY, recruit_SINGLE_VILLAGE',
    `card_location_arg` INT(11) NOT NULL DEFAULT '0' COMMENT 'PLAYER ID or VILLAGE/CITY ID',
    `card_power_used` TINYINT(1) UNSIGNED NOT NULL DEFAULT '0',
    PRIMARY KEY (`card_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 AUTO_INCREMENT=1;

-- Hex tiles table
CREATE TABLE IF NOT EXISTS `tile` (
    `tile_id` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
    `tile_q` SMALLINT NOT NULL COMMENT 'Hex coordinate Q',
    `tile_r` SMALLINT NOT NULL COMMENT 'Hex coordinate R',
    `tile_type` VARCHAR(16) NOT NULL COMMENT 'city, village, terrain, special',
    `tile_subtype` VARCHAR(32) NOT NULL COMMENT 'aberlaas, mountain, forest, etc.',
    `tile_chapter` TINYINT UNSIGNED NOT NULL DEFAULT '1',
    `tile_wind_force` TINYINT UNSIGNED DEFAULT NULL COMMENT 'Revealed wind force 1-6',
    `tile_discovered` TINYINT(1) UNSIGNED NOT NULL DEFAULT '1',
    `tile_white_dice` TINYINT UNSIGNED NOT NULL DEFAULT '0',
    `tile_green_dice` TINYINT UNSIGNED NOT NULL DEFAULT '0',
    `tile_black_dice` TINYINT UNSIGNED NOT NULL DEFAULT '0',
    `tile_moral_effect` SMALLINT NOT NULL DEFAULT '0',
    PRIMARY KEY (`tile_id`),
    UNIQUE KEY `coords_chapter` (`tile_q`, `tile_r`, `tile_chapter`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 AUTO_INCREMENT=1;

-- Wind tokens bag
CREATE TABLE IF NOT EXISTS `wind_token` (
    `token_id` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
    `token_force` TINYINT UNSIGNED NOT NULL COMMENT 'Wind force 1-6',
    `token_location` VARCHAR(16) NOT NULL DEFAULT 'bag' COMMENT 'bag, tile, revealed',
    `token_tile_id` INT(10) UNSIGNED DEFAULT NULL COMMENT 'Tile ID if token_location = tile',
    `token_player_id` INT(10) UNSIGNED DEFAULT NULL COMMENT 'Player ID if token_location = revealed (player deciding placement)',
    PRIMARY KEY (`token_id`),
    KEY `fk_tile` (`token_tile_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 AUTO_INCREMENT=1;

-- Dice rolls (for current challenge resolution)
CREATE TABLE IF NOT EXISTS `dice_roll` (
    `dice_id` INT(10) UNSIGNED NOT NULL AUTO_INCREMENT,
    `dice_type` VARCHAR(8) NOT NULL COMMENT 'blue, white, green, black, violet',
    `dice_value` TINYINT UNSIGNED DEFAULT NULL COMMENT '1-6',
    `dice_owner` VARCHAR(16) NOT NULL COMMENT 'player (horde), challenge (wind/terrain/fate), dice_on_card',
    `dice_card_id` INT(10) UNSIGNED DEFAULT NULL COMMENT 'Card ID if dice_owner = dice_on_card',
    `dice_locked` TINYINT(1) UNSIGNED NOT NULL DEFAULT '0',
    PRIMARY KEY (`dice_id`),
    KEY `fk_card` (`dice_card_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 AUTO_INCREMENT=1;

-- Game state variables (for complex state tracking)
CREATE TABLE IF NOT EXISTS `global_var` (
    `var_name` VARCHAR(32) NOT NULL,
    `var_value` TEXT,
    PRIMARY KEY (`var_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
