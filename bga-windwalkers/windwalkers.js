/**
 *------
 * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
 * Windwalkers implementation : © David Saban davidolivier.saban@gmail.com
 * -----
 *
 * windwalkers.js
 *
 * Windwalkers user interface script
 */

define([
    "dojo","dojo/_base/declare",
    "ebg/core/gamegui",
    "ebg/counter",
    "ebg/scrollmap",
    "ebg/stock",
    "ebg/zone"
],
function (dojo, declare) {
    return declare("bgagame.windwalkers", ebg.core.gamegui, {
        constructor: function(){
            console.log('windwalkers constructor');
            
            // Hex grid settings - FLAT-TOP orientation
            this.hexSize = 50; // Distance from center to corner
            this.hexWidth = this.hexSize * 2; // 100px
            this.hexHeight = Math.sqrt(3) * this.hexSize; // ~86.6px
            
            // Dice display
            this.diceSize = 50;
            
            // Animation speeds
            this.animationSpeed = 500;
            this.diceRollSpeed = 150;
            
            // Current game state
            this.selectedTile = null;
            this.selectedDice = [];
            
            // Player info
            this.playerMoral = {};
            this.playerDice = {};
        },
        
        /*
         * setup:
         * Called on page load, initialize game components
         */
        setup: function(gamedatas)
        {
            console.log("Starting game setup");
            console.log("Game data:", gamedatas);
            console.log("Current chapter:", gamedatas.current_chapter);
            console.log("Tiles received:", gamedatas.tiles);
            console.log("Number of tiles:", Object.keys(gamedatas.tiles || {}).length);
            
            // Setting up player boards
            for (var player_id in gamedatas.players) {
                var player = gamedatas.players[player_id];
                
                // Setup player panel
                this.setupPlayerPanel(player_id, player);
                
                // Store moral value
                this.playerMoral[player_id] = player.moral;
                this.playerDice[player_id] = player.dice_count;
            }
            
            // Setup hex map using scrollmap
            this.setupHexMap();
            
            // Place tiles on map
            this.setupTiles(gamedatas.tiles);
            
            // Place player tokens
            this.setupPlayerTokens(gamedatas.players);
            
            // Setup horde display
            this.setupHorde(gamedatas.myHorde);
            
            // Setup dice zone
            this.setupDiceZone();
            
            // Store material data
            this.characters = gamedatas.characters;
            this.characterTypes = gamedatas.character_types;
            this.terrainTypes = gamedatas.terrain_types;
            
            // Setup notifications
            this.setupNotifications();
            
            console.log("Game setup complete");
        },
        
        /**
         * Setup player panel with moral counter and info
         */
        setupPlayerPanel: function(player_id, player)
        {
            var panel = $('player_board_' + player_id);
            
            // Add moral display
            var moralHtml = '<div class="ww_player_info">' +
                '<div class="ww_moral_container">' +
                    '<span class="ww_moral_icon"></span>' +
                    '<span id="moral_counter_' + player_id + '" class="ww_moral_value">' + player.moral + '</span>' +
                '</div>' +
                '<div class="ww_dice_container">' +
                    '<span class="ww_dice_icon"></span>' +
                    '<span id="dice_counter_' + player_id + '" class="ww_dice_value">' + 
                        (player.dice_count - player.surpass) + '</span>' +
                '</div>' +
                '<div class="ww_position">' +
                    '<span>Position: </span>' +
                    '<span id="position_' + player_id + '">(' + player.pos_q + ',' + player.pos_r + ')</span>' +
                '</div>' +
            '</div>';
            
            dojo.place(moralHtml, panel);
        },
        
        /**
         * Setup scrollable hex map
         */
        setupHexMap: function()
        {
            this.scrollmap = new ebg.scrollmap();
            this.scrollmap.create(
                $('ww_map_container'),
                $('ww_map_scrollable'),
                $('ww_map_surface'),
                $('ww_map_scrollable_oversurface')
            );
            
            this.scrollmap.setupOnScreenArrows(150);
            
            // Center the scrollmap on the middle of the map
            // Scroll to show the center area where tiles are placed
            this.scrollmap.scrollto(-100, -100);
        },
        
        /**
         * Setup tiles on the hex map
         */
        setupTiles: function(tiles)
        {
            console.log('Setting up tiles:', tiles);
            var tileCount = 0;
            for (var tile_id in tiles) {
                var tile = tiles[tile_id];
                console.log('Creating tile:', tile_id, tile);
                this.createTile(tile);
                tileCount++;
            }
            console.log('Total tiles created:', tileCount);
        },
        
        /**
         * Create a single tile on the map
         */
        createTile: function(tile)
        {
            var pos = this.hexToPixel(tile.q, tile.r);
            
            var tileClass = 'ww_tile ww_tile_' + tile.type + ' ww_tile_' + tile.subtype;
            if (tile.discovered) {
                tileClass += ' ww_discovered';
            }
            
            var windHtml = '';
            if (tile.wind_force !== null && tile.discovered) {
                windHtml = '<div class="ww_wind_token ww_wind_' + tile.wind_force + '">' + 
                           (tile.wind_force == 6 ? 'F' : tile.wind_force) + '</div>';
            }
            
            var tileHtml = '<div id="tile_' + tile.id + '" class="' + tileClass + '" ' +
                           'style="left:' + pos.x + 'px; top:' + pos.y + 'px;">' +
                           '<div class="ww_tile_name">' + this.getTerrainName(tile.subtype) + '</div>' +
                           windHtml +
                           '</div>';
            
            dojo.place(tileHtml, 'ww_map_scrollable');
            
            // Add click handler
            dojo.connect($('tile_' + tile.id), 'onclick', this, 'onTileClick');
        },
        
        /**
         * Convert hex coordinates to pixel position (FLAT-TOP axial coordinates)
         */
        hexToPixel: function(q, r)
        {
            // Ensure q and r are numbers
            q = parseInt(q);
            r = parseInt(r);
            
            // FLAT-TOP hex layout using axial coordinates
            // Offset to center around q=3, r=14 (middle of chapter 1)
            var qOffset = q - 3;
            var rOffset = r - 14;
            
            // Flat-top formulas:
            // x = size * (3/2 * q)
            // y = size * (sqrt(3)/2 * q + sqrt(3) * r)
            var x = this.hexSize * (3/2 * qOffset);
            var y = this.hexSize * (Math.sqrt(3)/2 * qOffset + Math.sqrt(3) * rOffset);
            
            // Center in the map area
            x += 400;
            y += 350;
            
            return {x: Math.round(x), y: Math.round(y)};
        },
        
        /**
         * Setup player tokens on map
         */
        setupPlayerTokens: function(players)
        {
            for (var player_id in players) {
                var player = players[player_id];
                this.createPlayerToken(player_id, player);
            }
        },
        
        /**
         * Create a player token
         */
        createPlayerToken: function(player_id, player)
        {
            var pos = this.hexToPixel(player.pos_q, player.pos_r);
            
            var tokenHtml = '<div id="player_token_' + player_id + '" class="ww_player_token" ' +
                            'style="left:' + pos.x + 'px; top:' + pos.y + 'px; background-color:#' + player.color + ';">' +
                            '</div>';
            
            dojo.place(tokenHtml, 'ww_map_scrollable_oversurface');
        },
        
        /**
         * Setup the horde display (player's characters)
         */
        setupHorde: function(horde)
        {
            this.hordeStock = new ebg.stock();
            this.hordeStock.create(this, $('ww_horde'), 80, 120);
            this.hordeStock.setSelectionMode(0); // No selection by default
            this.hordeStock.setSelectionAppearance('class');
            
            // Add character card types
            for (var char_id in this.characters) {
                var char = this.characters[char_id];
                var typeId = parseInt(char_id);
                this.hordeStock.addItemType(typeId, typeId, 
                    g_gamethemeurl + 'img/characters.png', typeId - 1);
            }
            
            // Add player's cards
            for (var card_id in horde) {
                var card = horde[card_id];
                this.hordeStock.addToStockWithId(card.type_arg, card.id);
            }
        },
        
        /**
         * Setup dice display zone
         */
        setupDiceZone: function()
        {
            // Horde dice zone
            this.hordeDiceZone = new ebg.zone();
            this.hordeDiceZone.create(this, 'ww_horde_dice', 60, 60);
            this.hordeDiceZone.setPattern('diagonal');
            
            // Wind dice zone
            this.windDiceZone = new ebg.zone();
            this.windDiceZone.create(this, 'ww_wind_dice', 60, 60);
            this.windDiceZone.setPattern('diagonal');
        },
        
        ///////////////////////////////////////////////////
        //// Game & client states
        
        onEnteringState: function(stateName, args)
        {
            console.log('Entering state: ' + stateName, args);
            
            switch (stateName) {
                case 'draftHorde':
                    // Hide other panels during draft
                    dojo.style('ww_map_container', 'display', 'none');
                    dojo.style('ww_dice_panel', 'display', 'none');
                    this.showDraftInterface(args.args);
                    break;
                    
                case 'playerTurn':
                    // Show game panels
                    dojo.style('ww_map_container', 'display', 'block');
                    dojo.style('ww_dice_panel', 'display', 'block');
                    dojo.style('ww_draft_panel', 'display', 'none');
                    
                    if (this.isCurrentPlayerActive()) {
                        this.highlightAdjacentTiles(args.args.adjacent);
                    }
                    break;
                    
                case 'confrontation':
                    this.showConfrontation(args.args);
                    break;
                    
                case 'continueOrSurpass':
                    this.showSurpassChoice(args.args);
                    break;
            }
        },

        onLeavingState: function(stateName)
        {
            console.log('Leaving state: ' + stateName);
            
            switch (stateName) {
                case 'playerTurn':
                    this.clearTileHighlights();
                    break;
                    
                case 'confrontation':
                    this.clearDice();
                    break;
            }
        },
        
        onUpdateActionButtons: function(stateName, args)
        {
            console.log('onUpdateActionButtons: ' + stateName);
            
            if (this.isCurrentPlayerActive()) {
                switch (stateName) {
                    case 'draftHorde':
                        this.addActionButton('btn_confirm_draft', _('Confirm Horde'), 'onConfirmDraft');
                        break;
                        
                    case 'playerTurn':
                        this.addActionButton('btn_rest', _('Rest'), 'onRest', null, false, 'gray');
                        break;
                        
                    case 'confrontation':
                        this.addActionButton('btn_roll', _('Roll Dice'), 'onRollDice');
                        break;
                        
                    case 'diceResult':
                        this.addActionButton('btn_moral_plus', _('+1 (spend moral)'), 'onMoralPlus');
                        this.addActionButton('btn_moral_minus', _('-1 (spend moral)'), 'onMoralMinus');
                        this.addActionButton('btn_confirm_roll', _('Confirm'), 'onConfirmRoll');
                        break;
                        
                    case 'continueOrSurpass':
                        if (args.can_surpass) {
                            this.addActionButton('btn_surpass', _('Surpass (-1 die)'), 'onSurpass');
                        }
                        this.addActionButton('btn_end_turn', _('End Turn'), 'onEndTurn');
                        break;
                }
            }
        },
        
        ///////////////////////////////////////////////////
        //// Utility methods
        
        /**
         * Show draft interface
         */
        showDraftInterface: function(args)
        {
            console.log('Draft interface:', args);
            
            if (!args) {
                console.error('No draft args provided');
                return;
            }
            
            // Show draft panel
            dojo.style('ww_draft_panel', 'display', 'block');
            
            // Clear previous content
            var poolContainer = $('ww_available_characters');
            if (poolContainer) {
                poolContainer.innerHTML = '';
            }
            
            // Store draft state
            this.draftArgs = args;
            this.draftSelected = args.selected || {};
            
            // Create character cards for each available character
            if (args.available) {
                for (var cardId in args.available) {
                    var card = args.available[cardId];
                    this.createDraftCard(card, 'ww_available_characters');
                }
            }
            
            // Display already selected cards in the horde panel
            if (args.selected) {
                for (var cardId in args.selected) {
                    var card = args.selected[cardId];
                    this.createDraftCard(card, 'ww_horde', true);
                }
            }
            
            // Update counts
            this.updateDraftCounts(args.counts, args.requirements);
        },
        
        /**
         * Create a card element for draft
         */
        createDraftCard: function(card, containerId, isSelected)
        {
            // Use enriched data from server if available, fallback to local characters data
            var charType = card.char_type || card.type;
            var isLeader = card.is_leader || false;
            var charName = card.name || 'Card ' + card.id;
            var charPower = card.power || '';
            
            // Fallback: try to get info from local characters data
            if (this.characters && this.characters[card.type_arg]) {
                var charInfo = this.characters[card.type_arg];
                charType = charInfo.type || charType;
                isLeader = charInfo.is_leader || isLeader;
                charName = charInfo.name || charName;
                charPower = charInfo.power || charPower;
            }
            
            // Determine display type
            var displayType = isLeader ? 'traceur' : charType;
            
            var cardHtml = '<div id="draft_card_' + card.id + '" ' +
                           'class="ww_draft_card' + (isSelected ? ' ww_selected' : '') + '" ' +
                           'data-card-id="' + card.id + '" ' +
                           'data-type="' + displayType + '" ' +
                           'data-type-arg="' + card.type_arg + '">' +
                           '<div class="ww_draft_card_name">' + charName + '</div>' +
                           '<div class="ww_draft_card_type">' + this.capitalizeFirst(displayType) + '</div>' +
                           '<div class="ww_draft_card_power">' + charPower + '</div>' +
                           '</div>';
            
            dojo.place(cardHtml, containerId);
            
            // Add click handler
            var self = this;
            dojo.connect($('draft_card_' + card.id), 'onclick', function(evt) {
                dojo.stopEvent(evt);
                self.onDraftCardClick(card.id);
            });
        },
        
        /**
         * Update draft requirement counts display
         */
        updateDraftCounts: function(counts, requirements)
        {
            if (!counts || !requirements) return;
            
            var types = ['traceur', 'fer', 'pack', 'traine'];
            for (var i = 0; i < types.length; i++) {
                var type = types[i];
                var countEl = $('count_' + type);
                if (countEl) {
                    countEl.innerHTML = counts[type] || 0;
                }
                
                var reqEl = $('req_' + type);
                if (reqEl) {
                    var current = counts[type] || 0;
                    var required = requirements[type] || 0;
                    
                    dojo.removeClass(reqEl, 'ww_complete ww_incomplete');
                    dojo.addClass(reqEl, current >= required ? 'ww_complete' : 'ww_incomplete');
                }
            }
        },
        
        /**
         * Handle draft card click
         */
        onDraftCardClick: function(cardId)
        {
            console.log('Draft card clicked:', cardId);
            
            if (!this.isCurrentPlayerActive()) {
                return;
            }
            
            var cardEl = $('draft_card_' + cardId);
            if (!cardEl) return;
            
            var isSelected = dojo.hasClass(cardEl, 'ww_selected');
            
            if (isSelected) {
                // Deselect - remove from horde
                this.bgaPerformAction('actToggleDraftCard', {
                    card_id: cardId,
                    select: false
                });
            } else {
                // Select - add to horde
                this.bgaPerformAction('actToggleDraftCard', {
                    card_id: cardId,
                    select: true
                });
            }
        },
        
        /**
         * Capitalize first letter
         */
        capitalizeFirst: function(str)
        {
            if (!str) return '';
            return str.charAt(0).toUpperCase() + str.slice(1);
        },
        
        /**
         * Get localized terrain name
         */
        getTerrainName: function(subtype)
        {
            var names = {
                'plain': _('Plain'),
                'forest': _('Forest'),
                'mountain': _('Mountain'),
                'hut': _('Hut'),
                'cemetery': _('Cemetery'),
                'lake': _('Lake'),
                'swamp': _('Swamp'),
                'cliff': _('Cliff'),
                'village_green': _('Village'),
                'village_blue': _('Village'),
                'village_brown': _('Village'),
                'aberlaas': _('Aberlaas'),
                'portchoon': _('Port-Choon'),
                'carthago': _('Carthago'),
                'ker_hoent': _('Ker-Hoent'),
                'barahinn': _('Barahinn')
            };
            return names[subtype] || subtype;
        },
        
        /**
         * Highlight tiles that can be selected
         */
        highlightAdjacentTiles: function(tiles)
        {
            console.log('Highlighting adjacent tiles:', tiles);
            for (var i = 0; i < tiles.length; i++) {
                var tile = tiles[i];
                // Handle both tile_id and id properties
                var tileId = tile.tile_id || tile.id;
                console.log('Adding selectable to tile_' + tileId);
                var tileEl = $('tile_' + tileId);
                if (tileEl) {
                    dojo.addClass(tileEl, 'ww_selectable');
                } else {
                    console.warn('Tile element not found: tile_' + tileId);
                }
            }
        },
        
        /**
         * Clear all tile highlights
         */
        clearTileHighlights: function()
        {
            dojo.query('.ww_selectable').removeClass('ww_selectable');
        },
        
        /**
         * Show dice for confrontation
         */
        showConfrontation: function(args)
        {
            // Display horde dice
            for (var dice_id in args.horde_dice) {
                var dice = args.horde_dice[dice_id];
                this.createDice(dice, 'ww_horde_dice');
            }
            
            // Display wind/terrain dice
            for (var dice_id in args.wind_dice) {
                var dice = args.wind_dice[dice_id];
                this.createDice(dice, 'ww_wind_dice');
            }
            
            // Show wind force
            $('ww_wind_force').innerHTML = args.wind_force;
        },
        
        /**
         * Create a dice element
         */
        createDice: function(dice, container)
        {
            var diceHtml = '<div id="dice_' + dice.dice_id + '" ' +
                           'class="ww_dice ww_dice_' + dice.dice_type + '" ' +
                           'data-value="' + dice.dice_value + '">' +
                           dice.dice_value +
                           '</div>';
            
            dojo.place(diceHtml, container);
            
            // Add to zone
            if (container == 'ww_horde_dice') {
                this.hordeDiceZone.placeInZone('dice_' + dice.dice_id);
            } else {
                this.windDiceZone.placeInZone('dice_' + dice.dice_id);
            }
        },
        
        /**
         * Clear all dice
         */
        clearDice: function()
        {
            dojo.query('.ww_dice').forEach(function(node) {
                dojo.destroy(node);
            });
        },
        
        /**
         * Animate dice roll
         */
        animateDiceRoll: function(dice)
        {
            var self = this;
            var iterations = 10;
            var count = 0;
            
            var rollInterval = setInterval(function() {
                var randomValue = Math.floor(Math.random() * 6) + 1;
                dice.innerHTML = randomValue;
                count++;
                
                if (count >= iterations) {
                    clearInterval(rollInterval);
                    dice.innerHTML = dojo.attr(dice, 'data-value');
                }
            }, this.diceRollSpeed);
        },
        
        /**
         * Move player token to new position
         */
        movePlayerToken: function(player_id, q, r)
        {
            var pos = this.hexToPixel(q, r);
            var token = $('player_token_' + player_id);
            
            this.slideToObjectPos(token, 'ww_map_scrollable', pos.x, pos.y, this.animationSpeed);
            
            // Update position display
            $('position_' + player_id).innerHTML = '(' + q + ',' + r + ')';
        },
        
        /**
         * Update moral display
         */
        updateMoral: function(player_id, new_moral)
        {
            this.playerMoral[player_id] = new_moral;
            $('moral_counter_' + player_id).innerHTML = new_moral;
            
            // Add animation class
            var counter = $('moral_counter_' + player_id);
            dojo.addClass(counter, 'ww_value_changed');
            setTimeout(function() {
                dojo.removeClass(counter, 'ww_value_changed');
            }, 500);
        },
        
        /**
         * Update dice count display
         */
        updateDiceCount: function(player_id, new_count)
        {
            this.playerDice[player_id] = new_count;
            $('dice_counter_' + player_id).innerHTML = new_count;
        },
        
        /**
         * Show wind token reveal animation
         */
        revealWindToken: function(tile_id, force)
        {
            var tile = $('tile_' + tile_id);
            
            var windHtml = '<div class="ww_wind_token ww_wind_' + force + ' ww_wind_reveal">' +
                           (force == 6 ? 'F' : force) + '</div>';
            
            dojo.place(windHtml, tile);
            dojo.addClass(tile, 'ww_discovered');
        },
        
        ///////////////////////////////////////////////////
        //// Player's action handlers
        
        onTileClick: function(evt)
        {
            dojo.stopEvent(evt);
            
            var tile_id = evt.currentTarget.id.split('_')[1];
            console.log('Tile clicked:', tile_id, 'selectable:', dojo.hasClass(evt.currentTarget, 'ww_selectable'));
            
            if (!dojo.hasClass(evt.currentTarget, 'ww_selectable')) {
                this.showMessage(_("You cannot move to this tile"), "info");
                return;
            }
            
            this.selectedTile = tile_id;
            
            this.bgaPerformAction('actSelectTile', {
                tile_id: tile_id
            });
        },
        
        onRollDice: function(evt)
        {
            dojo.stopEvent(evt);
            
            this.bgaPerformAction('actRollDice', {});
        },
        
        onMoralPlus: function(evt)
        {
            dojo.stopEvent(evt);
            
            if (this.selectedDice.length == 0) {
                this.showMessage(_("Please select a die first"), "error");
                return;
            }
            
            this.bgaPerformAction('actUseMoral', {
                dice_id: this.selectedDice[0],
                modifier: 1
            });
        },
        
        onMoralMinus: function(evt)
        {
            dojo.stopEvent(evt);
            
            if (this.selectedDice.length == 0) {
                this.showMessage(_("Please select a die first"), "error");
                return;
            }
            
            this.bgaPerformAction('actUseMoral', {
                dice_id: this.selectedDice[0],
                modifier: -1
            });
        },
        
        onConfirmRoll: function(evt)
        {
            dojo.stopEvent(evt);
            
            this.bgaPerformAction('actConfirmRoll', {});
        },
        
        onSurpass: function(evt)
        {
            dojo.stopEvent(evt);
            
            this.bgaPerformAction('actSurpass', {});
        },
        
        onEndTurn: function(evt)
        {
            dojo.stopEvent(evt);
            
            this.bgaPerformAction('actEndTurn', {});
        },
        
        onRest: function(evt)
        {
            dojo.stopEvent(evt);
            
            this.bgaPerformAction('actRest', {});
        },
        
        onConfirmDraft: function(evt)
        {
            dojo.stopEvent(evt);
            
            this.bgaPerformAction('actConfirmDraft', {});
        },
        
        ///////////////////////////////////////////////////
        //// Reaction to cometD notifications

        setupNotifications: function()
        {
            console.log('Setting up notifications');
            
            dojo.subscribe('diceRolled', this, "notif_diceRolled");
            this.notifqueue.setSynchronous('diceRolled', 1000);
            
            dojo.subscribe('windRevealed', this, "notif_windRevealed");
            this.notifqueue.setSynchronous('windRevealed', 500);
            
            dojo.subscribe('confrontationSuccess', this, "notif_confrontationSuccess");
            this.notifqueue.setSynchronous('confrontationSuccess', 1000);
            
            dojo.subscribe('confrontationFailure', this, "notif_confrontationFailure");
            this.notifqueue.setSynchronous('confrontationFailure', 1000);
            
            dojo.subscribe('moralUsed', this, "notif_moralUsed");
            this.notifqueue.setSynchronous('moralUsed', 300);
            
            dojo.subscribe('playerSurpasses', this, "notif_playerSurpasses");
            
            dojo.subscribe('playerRests', this, "notif_playerRests");
            
            dojo.subscribe('playerMoves', this, "notif_playerMoves");
            this.notifqueue.setSynchronous('playerMoves', 500);
            
            // Draft notifications
            dojo.subscribe('cardToggled', this, "notif_cardToggled");
            this.notifqueue.setSynchronous('cardToggled', 300);
            
            dojo.subscribe('draftComplete', this, "notif_draftComplete");
            this.notifqueue.setSynchronous('draftComplete', 500);
        },
        
        notif_diceRolled: function(notif)
        {
            console.log('notif_diceRolled', notif);
            
            // Clear existing dice
            this.clearDice();
            
            // Create new dice with animation
            var self = this;
            notif.args.dice.forEach(function(dice, index) {
                setTimeout(function() {
                    self.createDice({
                        dice_id: 'horde_' + index,
                        dice_type: dice.type,
                        dice_value: dice.value
                    }, 'ww_horde_dice');
                    
                    self.animateDiceRoll($('dice_horde_' + index));
                }, index * 100);
            });
        },
        
        notif_windRevealed: function(notif)
        {
            console.log('notif_windRevealed', notif);
            
            this.revealWindToken(notif.args.tile_id, notif.args.force);
            
            // Show wind dice (white_dice from PHP)
            var self = this;
            (notif.args.white_dice || []).forEach(function(dice, index) {
                self.createDice({
                    dice_id: 'white_' + index,
                    dice_type: 'white',
                    dice_value: dice.value
                }, 'ww_wind_dice');
            });
            
            (notif.args.green_dice || []).forEach(function(dice, index) {
                self.createDice({
                    dice_id: 'green_' + index,
                    dice_type: 'green',
                    dice_value: dice.value
                }, 'ww_wind_dice');
            });
            
            (notif.args.black_dice || []).forEach(function(dice, index) {
                self.createDice({
                    dice_id: 'black_' + index,
                    dice_type: 'black',
                    dice_value: dice.value
                }, 'ww_wind_dice');
            });
        },
        
        notif_confrontationSuccess: function(notif)
        {
            console.log('notif_confrontationSuccess', notif);
            
            // Show success animation
            var tile = $('tile_' + this.selectedTile);
            if (tile) {
                dojo.addClass(tile, 'ww_confrontation_success');
                setTimeout(function() {
                    dojo.removeClass(tile, 'ww_confrontation_success');
                }, 1000);
            }
        },
        
        notif_confrontationFailure: function(notif)
        {
            console.log('notif_confrontationFailure', notif);
            
            // Show failure animation
            var tile = $('tile_' + this.selectedTile);
            if (tile) {
                dojo.addClass(tile, 'ww_confrontation_failure');
                setTimeout(function() {
                    dojo.removeClass(tile, 'ww_confrontation_failure');
                }, 1000);
            }
        },
        
        notif_moralUsed: function(notif)
        {
            console.log('notif_moralUsed', notif);
            
            // Update moral counter
            this.updateMoral(notif.args.player_id, notif.args.new_moral);
            
            // Update dice value
            var dice = $('dice_' + notif.args.dice_id);
            if (dice) {
                dojo.attr(dice, 'data-value', notif.args.new_value);
                dice.innerHTML = notif.args.new_value;
                
                dojo.addClass(dice, 'ww_dice_modified');
            }
        },
        
        notif_playerSurpasses: function(notif)
        {
            console.log('notif_playerSurpasses', notif);
            
            // Update dice count
            var current = parseInt($('dice_counter_' + notif.args.player_id).innerHTML);
            this.updateDiceCount(notif.args.player_id, current - 1);
        },
        
        notif_playerRests: function(notif)
        {
            console.log('notif_playerRests', notif);
        },
        
        notif_playerMoves: function(notif)
        {
            console.log('notif_playerMoves', notif);
            
            this.movePlayerToken(notif.args.player_id, notif.args.q, notif.args.r);
        },
        
        notif_cardToggled: function(notif)
        {
            console.log('notif_cardToggled', notif);
            
            var cardEl = $('draft_card_' + notif.args.card_id);
            if (!cardEl) return;
            
            if (notif.args.selected) {
                dojo.addClass(cardEl, 'ww_selected');
            } else {
                dojo.removeClass(cardEl, 'ww_selected');
            }
            
            // Update counts
            if (notif.args.counts && notif.args.requirements) {
                this.updateDraftCounts(notif.args.counts, notif.args.requirements);
            }
        },
        
        notif_draftComplete: function(notif)
        {
            console.log('notif_draftComplete', notif);
            
            // Hide draft panel
            dojo.style('ww_draft_panel', 'display', 'none');
            
            // Refresh horde display
            if (notif.args.horde) {
                this.refreshHorde(notif.args.horde);
            }
        },
        
        /**
         * Refresh horde display with new cards
         */
        refreshHorde: function(horde)
        {
            // Clear current horde
            var hordeEl = $('ww_horde');
            if (hordeEl) {
                hordeEl.innerHTML = '';
            }
            
            // Add new cards
            for (var cardId in horde) {
                var card = horde[cardId];
                var charInfo = this.characters[card.type_arg] || {};
                var charType = charInfo.type || card.type;
                var isLeader = charInfo.is_leader;
                var displayType = isLeader ? 'traceur' : charType;
                
                var cardHtml = '<div id="horde_card_' + card.id + '" ' +
                               'class="ww_character_card" ' +
                               'data-type="' + displayType + '">' +
                               '<div class="ww_card_name">' + (charInfo.name || '') + '</div>' +
                               '</div>';
                
                dojo.place(cardHtml, hordeEl);
            }
        }
   });
});
