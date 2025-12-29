<?php
/**
 *------
 * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
 * Windwalkers implementation : © David Saban davidolivier.saban@gmail.com
 * -----
 * 
 * material.inc.php
 *
 * Windwalkers game material description
 * All static game data: characters, terrains, chapters
 * 
 * This file imports all material definitions from modules/material/
 */

// Constants (character type definitions)
require_once(__DIR__ . '/modules/material/constants.inc.php');

// Character types (Traceur, Fer, Pack, Traîne)
require_once(__DIR__ . '/modules/material/character_types.inc.php');

// All characters (hordiers)
require_once(__DIR__ . '/modules/material/characters.inc.php');

// Terrain types
require_once(__DIR__ . '/modules/material/terrains.inc.php');

// Buildings (villages and cities)
require_once(__DIR__ . '/modules/material/buildings.inc.php');

// Wind configuration
require_once(__DIR__ . '/modules/material/wind.inc.php');

// Chapter tile data is embedded (no filesystem access)
require_once(__DIR__ . '/modules/material/chapters.inc.php');
