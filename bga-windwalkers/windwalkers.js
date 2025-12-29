/**
 *------
 * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
 * Windwalkers implementation : © David Saban davidolivier.saban@gmail.com
 * -----
 *
 * windwalkers.js
 *
 * Windwalkers user interface script
 * 
 * Architecture (internal modules):
 * - WW_DOM    : Technical layer for DOM manipulation
 * - WW_State  : Client-side state management
 * - WW_Hex    : Hex grid utilities
 * - WW_Dice   : Dice display and confrontation logic
 * - WW_Cards  : Card and horde management
 * - WW_Player : Player UI management
 */

define([
    "dojo", "dojo/_base/declare",
    "ebg/core/gamegui",
    "ebg/counter",
    "ebg/scrollmap",
    "ebg/stock",
    "ebg/zone"
],
function (dojo, declare) {
    
    // ============================================================
    // WW_DOM - Technical layer for DOM manipulation
    // ============================================================
    var WW_DOM = {
        get: function(id) {
            return $(id);
        },
        
        setHtml: function(id, html) {
            var el = typeof id === 'string' ? $(id) : id;
            if (el) el.innerHTML = html;
            return el;
        },
        
        getHtml: function(id) {
            var el = typeof id === 'string' ? $(id) : id;
            return el ? el.innerHTML : '';
        },
        
        place: function(html, containerId, position) {
            return dojo.place(html, containerId, position || 'last');
        },
        
        destroy: function(id) {
            var el = typeof id === 'string' ? $(id) : id;
            if (el) dojo.destroy(el);
        },
        
        clear: function(id) {
            this.setHtml(id, '');
        },
        
        addClass: function(id, className) {
            var el = typeof id === 'string' ? $(id) : id;
            if (el) dojo.addClass(el, className);
            return el;
        },
        
        removeClass: function(id, className) {
            var el = typeof id === 'string' ? $(id) : id;
            if (el) dojo.removeClass(el, className);
            return el;
        },
        
        toggleClass: function(id, className, condition) {
            var el = typeof id === 'string' ? $(id) : id;
            if (el) dojo.toggleClass(el, className, condition);
            return el;
        },
        
        hasClass: function(id, className) {
            var el = typeof id === 'string' ? $(id) : id;
            return el ? dojo.hasClass(el, className) : false;
        },
        
        setStyle: function(id, prop, value) {
            var el = typeof id === 'string' ? $(id) : id;
            if (el) dojo.style(el, prop, value);
            return el;
        },
        
        show: function(id) {
            return this.setStyle(id, 'display', 'block');
        },
        
        hide: function(id) {
            return this.setStyle(id, 'display', 'none');
        },
        
        setAttr: function(id, attr, value) {
            var el = typeof id === 'string' ? $(id) : id;
            if (el) dojo.attr(el, attr, value);
            return el;
        },
        
        getAttr: function(id, attr) {
            var el = typeof id === 'string' ? $(id) : id;
            return el ? dojo.attr(el, attr) : null;
        },
        
        getData: function(id, dataName) {
            return this.getAttr(id, 'data-' + dataName);
        },
        
        setData: function(id, dataName, value) {
            return this.setAttr(id, 'data-' + dataName, value);
        },
        
        connect: function(id, event, scope, handler) {
            var el = typeof id === 'string' ? $(id) : id;
            if (el) return dojo.connect(el, event, scope, handler);
            return null;
        },
        
        stopEvent: function(evt) {
            dojo.stopEvent(evt);
        },
        
        animateClass: function(id, className, duration) {
            var self = this;
            var el = this.addClass(id, className);
            if (el) {
                setTimeout(function() {
                    self.removeClass(el, className);
                }, duration || 500);
            }
            return el;
        },
        
        forEach: function(selector, callback) {
            dojo.query(selector).forEach(callback);
        },
        
        removeClassFromAll: function(selector, className) {
            dojo.query(selector).removeClass(className);
        }
    };
    
    // ============================================================
    // WW_State - Client-side state management
    // ============================================================
    var WW_State = {
        // Private state
        _data: {
            characters: {},
            playerMoral: {},
            playerDice: {},
            selectedTile: null,
            selectedDice: [],
            hordeCards: {},
            currentState: null
        },
        
        init: function(gamedatas) {
            this._data.characters = gamedatas.characters || {};
        },
        
        // Characters
        getCharacter: function(typeArg) {
            return this._data.characters[typeArg] || { name: 'Unknown', type: 'pack' };
        },
        
        getCharacters: function() {
            return this._data.characters;
        },
        
        // Player data
        setPlayerMoral: function(playerId, moral) {
            this._data.playerMoral[playerId] = moral;
        },
        
        setPlayerDice: function(playerId, count) {
            this._data.playerDice[playerId] = count;
        },
        
        // Selection
        setSelectedTile: function(tileId) {
            this._data.selectedTile = tileId;
        },
        
        getSelectedTile: function() {
            return this._data.selectedTile;
        },
        
        setSelectedDice: function(diceIds) {
            this._data.selectedDice = diceIds || [];
        },
        
        getSelectedDice: function() {
            return this._data.selectedDice;
        },
        
        clearSelectedDice: function() {
            this._data.selectedDice = [];
        },
        
        hasSelectedDice: function() {
            return this._data.selectedDice.length > 0;
        },
        
        getFirstSelectedDice: function() {
            return this._data.selectedDice[0] || null;
        },
        
        // Horde
        setHordeCards: function(cards) {
            this._data.hordeCards = cards || {};
        },
        
        addHordeCard: function(cardId, cardData) {
            this._data.hordeCards[cardId] = cardData;
        },
        
        removeHordeCard: function(cardId) {
            delete this._data.hordeCards[cardId];
        },
        
        // State
        setCurrentState: function(stateName) {
            this._data.currentState = stateName;
        },
        
        // Utilities
        getTerrainName: function(subtype) {
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
                'village_red': _('Village'),
                'city': _('City'),
                'aberlaas': _('Aberlaas'),
                'portchoon': _('Port-Choon'),
                'carthago': _('Carthago'),
                'ker_hoent': _('Ker-Hoent'),
                'barahinn': _('Barahinn')
            };
            return names[subtype] || subtype;
        },
        
        capitalizeFirst: function(str) {
            if (!str) return '';
            return str.charAt(0).toUpperCase() + str.slice(1);
        },
        
        getDisplayType: function(typeArg) {
            var charInfo = this.getCharacter(typeArg);
            return charInfo.is_leader ? 'traceur' : (charInfo.type || 'pack');
        }
    };
    
    // ============================================================
    // WW_Hex - Hex grid utilities
    // ============================================================
    var WW_Hex = {
        HEX_SIZE: 50,
        HEX_WIDTH: 100,
        HEX_HEIGHT: 86.6,
        Q_OFFSET: 3,
        R_OFFSET: 14,
        MAP_CENTER_X: 0,
        MAP_CENTER_Y: 0,
        
        /**
         * Create HTML for a wind token (always shows number, never 'F')
         */
        createWindTokenHtml: function(force, extraClass) {
            var cls = 'ww_wind_token ww_wind_' + force;
            if (extraClass) cls += ' ' + extraClass;
            return '<div class="' + cls + '">' + force + '</div>';
        },
        
        hexToPixel: function(q, r) {
            q = parseInt(q);
            r = parseInt(r);
            
            var qOffset = q - this.Q_OFFSET;
            var rOffset = r - this.R_OFFSET;
            
            var x = this.HEX_SIZE * (3/2 * qOffset);
            var y = this.HEX_SIZE * (Math.sqrt(3)/2 * qOffset + Math.sqrt(3) * rOffset);
            
            x += this.MAP_CENTER_X;
            y += this.MAP_CENTER_Y;
            
            return { x: Math.round(x), y: Math.round(y) };
        },
        
        hexToPixelCenter: function(q, r) {
            var pos = this.hexToPixel(q, r);
            pos.x += this.HEX_WIDTH / 2;
            pos.y += this.HEX_HEIGHT / 2;
            return pos;
        },
        
        createTile: function(tile) {
            var pos = this.hexToPixel(tile.q, tile.r);
            
            var tileClass = 'ww_tile ww_tile_' + tile.type + ' ww_tile_' + tile.subtype;
            if (tile.discovered) tileClass += ' ww_discovered';
            
            var windHtml = '';
            if (tile.wind_force !== null && tile.discovered) {
                windHtml = this.createWindTokenHtml(tile.wind_force);
            }
            
            var terrainName = WW_State.getTerrainName(tile.subtype);
            
            var tileHtml = '<div id="tile_' + tile.id + '" class="' + tileClass + '" ' +
                           'style="left:' + pos.x + 'px; top:' + pos.y + 'px;">' +
                           '<div class="ww_tile_name">' + terrainName + '</div>' +
                           windHtml + '</div>';
            
            WW_DOM.place(tileHtml, 'ww_map_scrollable');
            return $('tile_' + tile.id);
        },
        
        createPlayerToken: function(playerId, player) {
            var pos = this.hexToPixelCenter(player.pos_q, player.pos_r);
            
            var tokenHtml = '<div id="player_token_' + playerId + '" class="ww_player_token" ' +
                            'style="left:' + pos.x + 'px; top:' + pos.y + 'px; background-color:#' + player.color + ';">' +
                            '</div>';
            
            WW_DOM.place(tokenHtml, 'ww_map_scrollable_oversurface');
            return $('player_token_' + playerId);
        },
        
        movePlayerToken: function(gameGui, playerId, q, r) {
            var pos = this.hexToPixelCenter(q, r);
            var token = $('player_token_' + playerId);
            
            if (token && gameGui.slideToObjectPos) {
                gameGui.slideToObjectPos(token, 'ww_map_scrollable', pos.x, pos.y, 500);
            }
        },
        
        highlightTiles: function(tiles) {
            for (var i = 0; i < tiles.length; i++) {
                var tileId = tiles[i].tile_id || tiles[i].id;
                WW_DOM.addClass('tile_' + tileId, 'ww_selectable');
            }
        },
        
        clearHighlights: function() {
            WW_DOM.removeClassFromAll('.ww_selectable', 'ww_selectable');
        },
        
        revealWindToken: function(tileId, force) {
            var tile = $('tile_' + tileId);
            if (!tile) return;
            
            WW_DOM.place(this.createWindTokenHtml(force, 'ww_wind_reveal'), tile);
            WW_DOM.addClass(tile, 'ww_discovered');
        },
        
        showConfrontationResult: function(tileId, success) {
            var className = success ? 'ww_confrontation_success' : 'ww_confrontation_failure';
            WW_DOM.animateClass('tile_' + tileId, className, 1000);
        }
    };
    
    // ============================================================
    // WW_Dice - Dice display and confrontation logic
    // ============================================================
    var WW_Dice = {
        ROLL_SPEED: 150,
        
        createDice: function(dice, containerId, onClick) {
            var diceId = dice.dice_id || dice.id || ('dice_' + Math.random().toString(36).substr(2, 9));
            var diceType = dice.dice_type || dice.type || 'blue';
            var diceValue = dice.dice_value || dice.value || '?';
            
            var diceHtml = '<div id="dice_' + diceId + '" ' +
                           'class="ww_dice ww_dice_' + diceType + '" ' +
                           'data-dice-id="' + diceId + '" ' +
                           'data-value="' + diceValue + '">' +
                           diceValue + '</div>';
            
            WW_DOM.place(diceHtml, containerId);
            
            if (onClick) {
                WW_DOM.connect('dice_' + diceId, 'onclick', null, function(evt) {
                    WW_DOM.stopEvent(evt);
                    onClick(diceId);
                });
            }
            
            return $('dice_' + diceId);
        },
        
        createDiceSorted: function(diceArray, containerId, onClick) {
            var self = this;
            var arr = Array.isArray(diceArray) ? diceArray : Object.values(diceArray);
            
            arr.sort(function(a, b) {
                var valA = parseInt(a.dice_value || a.value) || 0;
                var valB = parseInt(b.dice_value || b.value) || 0;
                return valA - valB;
            });
            
            arr.forEach(function(dice) {
                self.createDice(dice, containerId, onClick);
            });
        },
        
        clearDice: function(type) {
            if (type === 'horde') {
                WW_DOM.clear('ww_horde_dice');
                WW_State.clearSelectedDice();
            } else if (type === 'wind') {
                WW_DOM.clear('ww_wind_dice');
            } else {
                WW_DOM.clear('ww_horde_dice');
                WW_DOM.clear('ww_wind_dice');
                WW_State.clearSelectedDice();
            }
        },
        
        selectDice: function(diceId) {
            WW_DOM.removeClassFromAll('#ww_horde_dice .ww_dice', 'ww_selected');
            WW_DOM.addClass('dice_' + diceId, 'ww_selected');
            WW_State.setSelectedDice([diceId]);
        },
        
        updateDiceValue: function(diceId, newValue) {
            var diceEl = $('dice_' + diceId);
            if (diceEl) {
                WW_DOM.setData(diceEl, 'value', newValue);
                WW_DOM.setHtml(diceEl, newValue);
                WW_DOM.addClass(diceEl, 'ww_dice_modified');
            }
        },
        
        animateDiceRoll: function(diceEl, finalValue) {
            var iterations = 10;
            var count = 0;
            var speed = this.ROLL_SPEED;
            
            var rollInterval = setInterval(function() {
                diceEl.innerHTML = Math.floor(Math.random() * 6) + 1;
                count++;
                if (count >= iterations) {
                    clearInterval(rollInterval);
                    diceEl.innerHTML = finalValue || WW_DOM.getData(diceEl, 'value');
                }
            }, speed);
        },
        
        getHordeDice: function() {
            var dice = [];
            WW_DOM.forEach('#ww_horde_dice .ww_dice', function(diceEl) {
                dice.push({
                    value: parseInt(WW_DOM.getAttr(diceEl, 'data-value')) || 0,
                    type: 'blue'
                });
            });
            return dice;
        },
        
        getWindDice: function() {
            var dice = [];
            WW_DOM.forEach('#ww_wind_dice .ww_dice', function(diceEl) {
                var value = parseInt(WW_DOM.getAttr(diceEl, 'data-value')) || 0;
                var type = 'white';
                if (WW_DOM.hasClass(diceEl, 'ww_dice_green')) type = 'green';
                else if (WW_DOM.hasClass(diceEl, 'ww_dice_black')) type = 'black';
                dice.push({ value: value, type: type });
            });
            return dice;
        },
        
        calculateConfrontationResult: function(hordeDice, windDice, windForce) {
            var hordeSum = hordeDice.reduce(function(sum, d) { return sum + d.value; }, 0);
            var windSum = windDice.reduce(function(sum, d) { return sum + d.value; }, 0);
            
            var hordeCounts = {};
            for (var i = 1; i <= 6; i++) hordeCounts[i] = 0;
            hordeDice.forEach(function(d) { hordeCounts[d.value] = (hordeCounts[d.value] || 0) + 1; });
            
            var availableCounts = Object.assign({}, hordeCounts);
            
            var windByType = { green: [], white: [], black: [] };
            windDice.forEach(function(d) {
                if (windByType[d.type]) windByType[d.type].push(d.value);
            });
            
            var greenResult = this._matchDice(windByType.green, availableCounts);
            var greenOk = greenResult.matched >= greenResult.required || greenResult.matched >= windForce;
            var reducedForce = Math.max(0, windForce - greenResult.matched);
            
            var whiteResult = this._matchDice(windByType.white, availableCounts);
            var whiteOk = whiteResult.matched >= reducedForce;
            
            var blackResult = this._matchDice(windByType.black, availableCounts);
            var blackOk = blackResult.matched >= blackResult.required;
            
            return {
                success: (hordeSum >= windSum) && greenOk && whiteOk && blackOk,
                hordeSum: hordeSum,
                windSum: windSum,
                greenRequired: greenResult.required,
                greenMatched: greenResult.matched,
                greenOk: greenOk,
                whiteRequired: reducedForce,
                whiteMatched: whiteResult.matched,
                whiteOk: whiteOk,
                blackRequired: blackResult.required,
                blackMatched: blackResult.matched,
                blackOk: blackOk
            };
        },
        
        _matchDice: function(challengeValues, availableCounts) {
            var matched = 0;
            challengeValues.forEach(function(value) {
                if (availableCounts[value] > 0) {
                    availableCounts[value]--;
                    matched++;
                }
            });
            return { required: challengeValues.length, matched: matched };
        },
        
        updateConfrontationPreview: function() {
            var preview = $('ww_confrontation_preview');
            if (!preview) return;
            
            var hordeDice = this.getHordeDice();
            var windDice = this.getWindDice();
            
            if (hordeDice.length === 0 || windDice.length === 0) {
                WW_DOM.hide(preview);
                WW_DOM.setHtml('ww_horde_sum', '');
                WW_DOM.setHtml('ww_wind_sum', '');
                return;
            }
            
            var hordeSum = hordeDice.reduce(function(sum, d) { return sum + d.value; }, 0);
            var windSum = windDice.reduce(function(sum, d) { return sum + d.value; }, 0);
            
            WW_DOM.setHtml('ww_horde_sum', '= ' + hordeSum);
            WW_DOM.setHtml('ww_wind_sum', '= ' + windSum);
            
            WW_DOM.removeClass('ww_horde_sum', 'ww_sum_winning ww_sum_losing');
            WW_DOM.removeClass('ww_wind_sum', 'ww_sum_winning ww_sum_losing');
            
            if (hordeSum >= windSum) {
                WW_DOM.addClass('ww_horde_sum', 'ww_sum_winning');
                WW_DOM.addClass('ww_wind_sum', 'ww_sum_losing');
            } else {
                WW_DOM.addClass('ww_horde_sum', 'ww_sum_losing');
                WW_DOM.addClass('ww_wind_sum', 'ww_sum_winning');
            }
            
            var windForce = parseInt(WW_DOM.getHtml('ww_wind_force')) || 0;
            var result = this.calculateConfrontationResult(hordeDice, windDice, windForce);
            
            WW_DOM.show(preview);
            WW_DOM.removeClass(preview, 'ww_preview_success ww_preview_failure');
            WW_DOM.addClass(preview, result.success ? 'ww_preview_success' : 'ww_preview_failure');
            
            var statusEl = $('ww_preview_status');
            WW_DOM.setHtml(statusEl, result.success ? '✓ SUCCESS' : '✗ FAILURE');
            WW_DOM.removeClass(statusEl, 'ww_status_success ww_status_failure');
            WW_DOM.addClass(statusEl, result.success ? 'ww_status_success' : 'ww_status_failure');
            
            var detailsHtml = '<div class="ww_match_row"><span>Sum: ' + hordeSum + ' vs ' + windSum + '</span>' +
                              '<span class="' + (hordeSum >= windSum ? 'ww_match_ok' : 'ww_match_fail') + '">' +
                              (hordeSum >= windSum ? '✓' : '✗') + '</span></div>';
            
            if (result.greenRequired > 0) {
                detailsHtml += '<div class="ww_match_row"><span>Green: ' + result.greenMatched + '/' + result.greenRequired + '</span>' +
                               '<span class="' + (result.greenOk ? 'ww_match_ok' : 'ww_match_fail') + '">' +
                               (result.greenOk ? '✓' : '✗') + '</span></div>';
            }
            if (result.whiteRequired > 0) {
                detailsHtml += '<div class="ww_match_row"><span>White: ' + result.whiteMatched + '/' + result.whiteRequired + '</span>' +
                               '<span class="' + (result.whiteOk ? 'ww_match_ok' : 'ww_match_fail') + '">' +
                               (result.whiteOk ? '✓' : '✗') + '</span></div>';
            }
            if (result.blackRequired > 0) {
                detailsHtml += '<div class="ww_match_row"><span>Black: ' + result.blackMatched + '/' + result.blackRequired + '</span>' +
                               '<span class="' + (result.blackOk ? 'ww_match_ok' : 'ww_match_fail') + '">' +
                               (result.blackOk ? '✓' : '✗') + '</span></div>';
            }
            
            WW_DOM.setHtml('ww_matching_details', detailsHtml);
        },
        
        restoreDice: function(gamedatas, onDiceClick) {
            if (gamedatas.horde_dice && Object.keys(gamedatas.horde_dice).length > 0) {
                this.createDiceSorted(gamedatas.horde_dice, 'ww_horde_dice', onDiceClick);
            }
            if (gamedatas.challenge_dice && Object.keys(gamedatas.challenge_dice).length > 0) {
                this.createDiceSorted(gamedatas.challenge_dice, 'ww_wind_dice');
            }
            if (gamedatas.selected_tile && gamedatas.selected_tile.tile_wind_force !== null) {
                WW_DOM.setHtml('ww_wind_force', gamedatas.selected_tile.tile_wind_force);
            }
        }
    };
    
    // ============================================================
    // WW_Cards - Card and Horde management
    // ============================================================
    var WW_Cards = {
        createCard: function(options) {
            var card = options.card;
            var typeArg = card.card_type_arg || card.type_arg;
            var cardId = card.card_id || card.id;
            
            var charInfo = WW_State.getCharacter(typeArg);
            var displayType = WW_State.getDisplayType(typeArg);
            
            var cardHtml = '<div id="' + options.prefix + '_' + cardId + '" ' +
                           'class="ww_draft_card ' + (options.extraClass || '') + '" ' +
                           'data-card-id="' + cardId + '" ' +
                           'data-type="' + displayType + '" ' +
                           'data-type-arg="' + typeArg + '">' +
                           '<div class="ww_draft_card_name">' + (charInfo.name || 'Unknown') + '</div>' +
                           '<div class="ww_draft_card_type">' + WW_State.capitalizeFirst(displayType) + '</div>' +
                           '<div class="ww_draft_card_power">' + (charInfo.power || '') + '</div>' +
                           '</div>';
            
            WW_DOM.place(cardHtml, options.containerId);
            
            if (options.onClick) {
                WW_DOM.connect(options.prefix + '_' + cardId, 'onclick', null, function(evt) {
                    WW_DOM.stopEvent(evt);
                    options.onClick(cardId, card);
                });
            }
            
            return $(options.prefix + '_' + cardId);
        },
        
        // Horde Management
        setupHorde: function(hordeData, onCardClick) {
            WW_DOM.clear('ww_horde');
            WW_State.setHordeCards({});
            
            for (var cardId in hordeData) {
                this.addHordeCard(hordeData[cardId], onCardClick);
            }
        },
        
        addHordeCard: function(card, onCardClick) {
            var cardId = card.card_id || card.id;
            var typeArg = card.card_type_arg || card.type_arg;
            
            this.createCard({
                prefix: 'ww_horde_item',
                card: card,
                containerId: 'ww_horde',
                extraClass: 'ww_horde_card_item',
                onClick: onCardClick
            });
            
            WW_State.addHordeCard(cardId, { id: cardId, type: typeArg });
        },
        
        removeHordeCard: function(cardId, animate) {
            var cardEl = $('ww_horde_item_' + cardId);
            if (!cardEl) return;
            
            if (animate) {
                WW_DOM.addClass(cardEl, 'ww_card_lost');
                setTimeout(function() {
                    WW_DOM.destroy(cardEl);
                }, 500);
            } else {
                WW_DOM.destroy(cardEl);
            }
            
            WW_State.removeHordeCard(cardId);
        },
        
        makeHordeSelectable: function(hordeData, onSelectCard) {
            for (var cardId in hordeData) {
                var cardEl = $('ww_horde_item_' + cardId);
                if (cardEl) {
                    WW_DOM.addClass(cardEl, 'ww_selectable_card');
                    
                    (function(cid) {
                        WW_DOM.connect(cardEl, 'onclick', null, function(evt) {
                            WW_DOM.stopEvent(evt);
                            onSelectCard(cid);
                        });
                    })(cardId);
                }
            }
        },
        
        clearHordeSelectable: function() {
            WW_DOM.removeClassFromAll('.ww_horde_card_item', 'ww_selectable_card');
        },
        
        // Draft Management
        showDraftInterface: function(args, onCardClick) {
            if (!args) return;
            
            WW_DOM.show('ww_draft_panel');
            WW_DOM.clear('ww_available_characters');
            WW_DOM.clear('ww_draft_selected');
            
            var self = this;
            if (args.available) {
                for (var cardId in args.available) {
                    this.createCard({
                        prefix: 'draft_card',
                        card: args.available[cardId],
                        containerId: 'ww_available_characters',
                        onClick: function(cid) { onCardClick(cid); }
                    });
                }
            }
            
            if (args.selected) {
                for (var cardId in args.selected) {
                    this.createCard({
                        prefix: 'draft_card',
                        card: args.selected[cardId],
                        containerId: 'ww_draft_selected',
                        extraClass: 'ww_selected',
                        onClick: function(cid) { onCardClick(cid); }
                    });
                }
            }
            
            this.updateDraftCounts(args.counts, args.requirements);
        },
        
        toggleDraftCardSelection: function(cardId, selected) {
            WW_DOM.toggleClass('draft_card_' + cardId, 'ww_selected', selected);
        },
        
        updateDraftCounts: function(counts, requirements) {
            if (!counts || !requirements) return;
            
            var types = ['traceur', 'fer', 'pack', 'traine'];
            for (var i = 0; i < types.length; i++) {
                var type = types[i];
                var countEl = $('count_' + type);
                if (countEl) WW_DOM.setHtml(countEl, counts[type] || 0);
                
                var reqEl = $('req_' + type);
                if (reqEl) {
                    var current = counts[type] || 0;
                    var required = requirements[type] || 0;
                    WW_DOM.removeClass(reqEl, 'ww_complete ww_incomplete');
                    WW_DOM.addClass(reqEl, current >= required ? 'ww_complete' : 'ww_incomplete');
                }
            }
        },
        
        hideDraftPanel: function() {
            WW_DOM.hide('ww_draft_panel');
        },
        
        // Recruitment Management
        showRecruitmentInterface: function(args, onRecruitClick) {
            if (!args) return { isEmpty: true };
            
            var recruitPool = args.recruitPool || {};
            // Handle both array and object formats from PHP
            var poolSize = Array.isArray(recruitPool) ? recruitPool.length : Object.keys(recruitPool).length;
            
            // If pool is empty, don't show the panel
            if (poolSize === 0) {
                WW_DOM.hide('ww_draft_panel');
                return { isEmpty: true };
            }
            
            WW_DOM.show('ww_draft_panel');
            WW_DOM.clear('ww_available_characters');
            
            var titleEl = dojo.query('#ww_draft_panel h3')[0];
            if (titleEl) WW_DOM.setHtml(titleEl, _('Recruitment - Click a character to recruit'));
            
            WW_DOM.hide('ww_draft_selected');
            WW_DOM.forEach('.ww_draft_requirements', function(el) {
                WW_DOM.hide(el);
            });
            
            for (var cardId in recruitPool) {
                this.createCard({
                    prefix: 'recruit_card',
                    card: recruitPool[cardId],
                    containerId: 'ww_available_characters',
                    extraClass: 'ww_recruit_card',
                    onClick: function(cid) {
                        onRecruitClick(parseInt(cid, 10));
                    }
                });
            }
            
            return { isEmpty: false, count: poolSize };
        },
        
        hideRecruitmentInterface: function() {
            WW_DOM.hide('ww_draft_panel');
            WW_DOM.setStyle('ww_draft_selected', 'display', 'flex');
            WW_DOM.forEach('.ww_draft_requirements', function(el) {
                WW_DOM.setStyle(el, 'display', 'flex');
            });
        },
        
        refreshHorde: function(hordeData) {
            WW_DOM.clear('ww_horde');
            WW_State.setHordeCards({});
            
            for (var cardId in hordeData) {
                this.addHordeCard(hordeData[cardId]);
            }
        }
    };
    
    // ============================================================
    // WW_Player - Player UI management
    // ============================================================
    var WW_Player = {
        setupPlayerPanel: function(playerId, player) {
            var panel = $('player_board_' + playerId);
            if (!panel) return;
            
            var moralHtml = '<div class="ww_player_info">' +
                '<div class="ww_moral_container">' +
                    '<span class="ww_moral_icon"></span>' +
                    '<span id="moral_counter_' + playerId + '" class="ww_moral_value">' + player.moral + '</span>' +
                '</div>' +
                '<div class="ww_dice_container">' +
                    '<span class="ww_dice_icon"></span>' +
                    '<span id="dice_counter_' + playerId + '" class="ww_dice_value">' + 
                        (player.dice_count - player.surpass) + '</span>' +
                '</div>' +
                '<div class="ww_position">' +
                    '<span>Position: </span>' +
                    '<span id="position_' + playerId + '">(' + player.pos_q + ',' + player.pos_r + ')</span>' +
                '</div>' +
            '</div>';
            
            WW_DOM.place(moralHtml, panel);
            
            WW_State.setPlayerMoral(playerId, player.moral);
            WW_State.setPlayerDice(playerId, player.dice_count);
        },
        
        updateMoral: function(playerId, newMoral) {
            WW_State.setPlayerMoral(playerId, newMoral);
            WW_DOM.setHtml('moral_counter_' + playerId, newMoral);
            WW_DOM.animateClass('moral_counter_' + playerId, 'ww_value_changed', 500);
        },
        
        updateDiceCount: function(playerId, newCount) {
            WW_State.setPlayerDice(playerId, newCount);
            WW_DOM.setHtml('dice_counter_' + playerId, newCount);
        },
        
        updatePosition: function(playerId, q, r) {
            WW_DOM.setHtml('position_' + playerId, '(' + q + ',' + r + ')');
        },
        
        getCurrentDiceCount: function(playerId) {
            var countEl = $('dice_counter_' + playerId);
            return countEl ? parseInt(WW_DOM.getHtml(countEl)) : 0;
        }
    };
    
    // ============================================================
    // MAIN GAME CLASS
    // ============================================================
    return declare("bgagame.windwalkers", ebg.core.gamegui, {
        
        constructor: function() {
            console.log('windwalkers constructor');
            this.animationSpeed = 500;
        },
        
        /*
         * setup: Called on page load
         */
        setup: function(gamedatas) {
            console.log("Starting game setup", gamedatas);
            
            // Initialize state
            WW_State.init(gamedatas);
            
            // Setup player boards
            for (var player_id in gamedatas.players) {
                WW_Player.setupPlayerPanel(player_id, gamedatas.players[player_id]);
            }
            
            // Setup hex map
            this.setupHexMap();
            
            // Place tiles and player tokens
            this.setupTiles(gamedatas.tiles);
            this.setupPlayerTokens(gamedatas.players);
            
            // Setup horde display
            WW_Cards.setupHorde(gamedatas.myHorde);
            
            // Setup dice zone
            WW_DOM.clear('ww_horde_dice');
            WW_DOM.clear('ww_wind_dice');
            
            // Restore dice if in confrontation
            var self = this;
            WW_Dice.restoreDice(gamedatas, function(diceId) {
                self.onDiceClick(diceId);
            });
            
            // Setup notifications
            this.setupNotifications();
            
            console.log("Game setup complete");
        },
        
        setupHexMap: function() {
            this.scrollmap = new ebg.scrollmap();
            this.scrollmap.create(
                $('ww_map_container'),
                $('ww_map_scrollable'),
                $('ww_map_surface'),
                $('ww_map_scrollable_oversurface')
            );
            this.scrollmap.setupOnScreenArrows(150);
        },
        
        centerMapOnTiles: function(tiles) {
            if (!tiles || Object.keys(tiles).length === 0) {
                this.scrollmap.scrollto(-100, -100);
                return;
            }
            
            // Calculate bounding box of all tiles
            var minX = Infinity, maxX = -Infinity;
            var minY = Infinity, maxY = -Infinity;
            
            for (var tile_id in tiles) {
                var tile = tiles[tile_id];
                var pos = WW_Hex.hexToPixel(tile.q, tile.r);
                minX = Math.min(minX, pos.x);
                maxX = Math.max(maxX, pos.x + WW_Hex.HEX_WIDTH);
                minY = Math.min(minY, pos.y);
                maxY = Math.max(maxY, pos.y + WW_Hex.HEX_HEIGHT);
            }
            
            // Calculate center of tiles
            var centerX = (minX + maxX) / 2;
            var centerY = (minY + maxY) / 2;
            
            // Get container dimensions
            var container = $('ww_map_container');
            var containerWidth = container.offsetWidth || 800;
            var containerHeight = container.offsetHeight || 600;
            
            // Scroll so center of tiles is in center of viewport
            var scrollX = -(centerX - containerWidth / 2);
            var scrollY = -(centerY - containerHeight / 2);
            
            this.scrollmap.scrollto(scrollX, scrollY);
        },
        
        setupTiles: function(tiles) {
            var self = this;
            for (var tile_id in tiles) {
                var tileEl = WW_Hex.createTile(tiles[tile_id]);
                WW_DOM.connect(tileEl, 'onclick', this, 'onTileClick');
            }
            
            // Center map on tiles after creating them
            this.centerMapOnTiles(tiles);
        },
        
        setupPlayerTokens: function(players) {
            for (var player_id in players) {
                WW_Hex.createPlayerToken(player_id, players[player_id]);
            }
        },
        
        ///////////////////////////////////////////////////
        //// Game & client states
        
        onEnteringState: function(stateName, args) {
            console.log('Entering state: ' + stateName, args);
            
            WW_State.setCurrentState(stateName);
            
            if (stateName !== 'playerTurn') {
                WW_Hex.clearHighlights();
            }
            
            switch (stateName) {
                case 'draftHorde':
                    this.enterDraftState(args.args);
                    break;
                case 'playerTurn':
                    this.enterPlayerTurnState(args.args);
                    break;
                case 'confrontation':
                    this.enterConfrontationState(args.args);
                    break;
                case 'diceResult':
                    this.enterDiceResultState(args.args);
                    break;
                case 'loseHordier':
                    this.enterLoseHordierState(args.args);
                    break;
                case 'recruitment':
                    this.enterRecruitmentState(args.args);
                    break;
            }
        },
        
        onLeavingState: function(stateName) {
            console.log('Leaving state: ' + stateName);
            
            switch (stateName) {
                case 'playerTurn':
                    WW_Hex.clearHighlights();
                    break;
                case 'loseHordier':
                    WW_Cards.clearHordeSelectable();
                    break;
                case 'recruitment':
                    WW_Cards.hideRecruitmentInterface();
                    break;
            }
        },
        
        onUpdateActionButtons: function(stateName, args) {
            console.log('onUpdateActionButtons: ' + stateName);
            
            if (!this.isCurrentPlayerActive()) return;
            
            switch (stateName) {
                case 'draftHorde':
                    this.addActionButton('btn_confirm_draft', _('Confirm Horde'), 'onConfirmDraft');
                    break;
                case 'playerTurn':
                    if (args && args.has_moved > 0) {
                        this.addActionButton('btn_surpass_info', 
                            _('Next move = Surpass (-1 die)'), null, null, false, 'bgabutton_gray');
                        dojo.addClass('btn_surpass_info', 'disabled');
                    }
                    this.addActionButton('btn_rest', _('Rest (end turn)'), 'onRest', null, false, 'gray');
                    break;
                case 'confrontation':
                    this.addActionButton('btn_roll', _('Roll Dice'), 'onRollDice');
                    break;
                case 'diceResult':
                    this.addActionButton('btn_moral_plus', _('+1 (spend moral)'), 'onMoralPlus');
                    this.addActionButton('btn_moral_minus', _('-1 (spend moral)'), 'onMoralMinus');
                    this.addActionButton('btn_confirm_roll', _('Confirm'), 'onConfirmRoll');
                    break;
                case 'recruitment':
                    this.addActionButton('btn_skip_recruit', _('Skip Recruitment'), 'onSkipRecruitment', null, false, 'gray');
                    break;
            }
        },
        
        ///////////////////////////////////////////////////
        //// State Entry Methods
        
        enterDraftState: function(args) {
            WW_DOM.hide('ww_map_container');
            WW_DOM.hide('ww_dice_panel');
            
            var self = this;
            WW_Cards.showDraftInterface(args, function(cardId) {
                self.onDraftCardClick(cardId);
            });
        },
        
        enterPlayerTurnState: function(args) {
            WW_DOM.show('ww_map_container');
            WW_DOM.show('ww_dice_panel');
            WW_DOM.hide('ww_draft_panel');
            
            WW_Dice.clearDice();
            WW_DOM.setHtml('ww_wind_force', '-');
            
            if (this.isCurrentPlayerActive() && args && args.adjacent) {
                WW_Hex.highlightTiles(args.adjacent);
            }
        },
        
        enterConfrontationState: function(args) {
            WW_Dice.clearDice('horde');
            WW_Dice.clearDice('wind');
            
            var self = this;
            
            if (args.horde_dice) {
                WW_Dice.createDiceSorted(args.horde_dice, 'ww_horde_dice', function(diceId) {
                    self.onDiceClick(diceId);
                });
            }
            
            if (args.challenge_dice) {
                WW_Dice.createDiceSorted(args.challenge_dice, 'ww_wind_dice');
            }
            
            if (args.wind_force !== null && args.wind_force !== undefined) {
                WW_DOM.setHtml('ww_wind_force', args.wind_force);
            }
        },
        
        enterDiceResultState: function(args) {
            if (args && args.wind_force !== null && args.wind_force !== undefined) {
                WW_DOM.setHtml('ww_wind_force', args.wind_force);
            }
        },
        
        enterLoseHordierState: function(args) {
            console.log('Lose hordier state:', args);
            
            if (!args || !args.horde) return;
            
            var self = this;
            WW_Cards.makeHordeSelectable(args.horde, function(cardId) {
                self.onAbandonHordier(cardId);
            });
            
            this.showMessage(_("You must abandon a Hordier! Click on a card to abandon it."), "info");
        },
        
        enterRecruitmentState: function(args) {
            console.log('Recruitment state:', args);
            
            var self = this;
            var result = WW_Cards.showRecruitmentInterface(args, function(cardId) {
                self.onRecruitCard(cardId);
            });
            
            if (result && result.isEmpty) {
                this.showMessage(_("No characters available for recruitment at this location."), "info");
            } else {
                this.showMessage(_("You may recruit new characters. Click on a card to recruit or Skip."), "info");
            }
        },
        
        ///////////////////////////////////////////////////
        //// Click Handlers
        
        onTileClick: function(evt) {
            WW_DOM.stopEvent(evt);
            
            var tileId = evt.currentTarget.id.split('_')[1];
            
            if (!this.checkAction('actSelectTile', true)) return;
            
            if (!WW_DOM.hasClass(evt.currentTarget, 'ww_selectable')) {
                this.showMessage(_("You cannot move to this tile"), "info");
                return;
            }
            
            WW_State.setSelectedTile(tileId);
            this.bgaPerformAction('actSelectTile', { tile_id: tileId });
        },
        
        onDiceClick: function(diceId) {
            console.log('Dice clicked:', diceId);
            WW_Dice.selectDice(diceId);
        },
        
        onDraftCardClick: function(cardId) {
            console.log('Draft card clicked:', cardId);
            
            if (!this.isCurrentPlayerActive()) return;
            
            var cardEl = $('draft_card_' + cardId);
            if (!cardEl) return;
            
            var isSelected = WW_DOM.hasClass(cardEl, 'ww_selected');
            this.bgaPerformAction('actToggleDraftCard', {
                card_id: cardId,
                select: !isSelected
            });
        },
        
        ///////////////////////////////////////////////////
        //// Action Handlers
        
        onRollDice: function(evt) {
            WW_DOM.stopEvent(evt);
            this.bgaPerformAction('actRollDice', {});
        },
        
        onMoralPlus: function(evt) {
            WW_DOM.stopEvent(evt);
            
            if (!WW_State.hasSelectedDice()) {
                this.showMessage(_("Please select a die first"), "error");
                return;
            }
            
            this.bgaPerformAction('actUseMoral', {
                dice_id: parseInt(WW_State.getFirstSelectedDice()),
                modifier: 1
            });
        },
        
        onMoralMinus: function(evt) {
            WW_DOM.stopEvent(evt);
            
            if (!WW_State.hasSelectedDice()) {
                this.showMessage(_("Please select a die first"), "error");
                return;
            }
            
            this.bgaPerformAction('actUseMoral', {
                dice_id: parseInt(WW_State.getFirstSelectedDice()),
                modifier: -1
            });
        },
        
        onConfirmRoll: function(evt) {
            WW_DOM.stopEvent(evt);
            this.bgaPerformAction('actConfirmRoll', {});
        },
        
        onRest: function(evt) {
            WW_DOM.stopEvent(evt);
            this.bgaPerformAction('actRest', {});
        },
        
        onConfirmDraft: function(evt) {
            WW_DOM.stopEvent(evt);
            this.bgaPerformAction('actConfirmDraft', {});
        },
        
        onAbandonHordier: function(cardId) {
            console.log('Abandoning hordier:', cardId);
            this.bgaPerformAction('actAbandonHordier', {
                card_id: parseInt(cardId)
            });
        },
        
        onRecruitCard: function(cardId) {
            console.log('Recruiting card:', cardId);
            this.bgaPerformAction('actRecruit', {
                card_id: parseInt(cardId)
            });
        },
        
        onSkipRecruitment: function(evt) {
            WW_DOM.stopEvent(evt);
            WW_Cards.hideRecruitmentInterface();
            this.bgaPerformAction('actSkipRecruitment', {});
        },
        
        ///////////////////////////////////////////////////
        //// Notifications

        setupNotifications: function() {
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
            
            dojo.subscribe('cardToggled', this, "notif_cardToggled");
            this.notifqueue.setSynchronous('cardToggled', 300);
            
            dojo.subscribe('draftComplete', this, "notif_draftComplete");
            this.notifqueue.setSynchronous('draftComplete', 500);
            
            dojo.subscribe('autoSelectTeam', this, "notif_autoSelectTeam");
            
            dojo.subscribe('hordierLost', this, "notif_hordierLost");
            this.notifqueue.setSynchronous('hordierLost', 500);
        },
        
        notif_diceRolled: function(notif) {
            console.log('notif_diceRolled', notif);
            
            WW_Dice.clearDice('horde');
            
            var self = this;
            var sortedDice = notif.args.dice.slice().sort(function(a, b) {
                return (a.value || 0) - (b.value || 0);
            });
            
            sortedDice.forEach(function(dice) {
                WW_Dice.createDice({
                    dice_id: dice.id,
                    dice_type: dice.type,
                    dice_value: dice.value
                }, 'ww_horde_dice', function(diceId) {
                    self.onDiceClick(diceId);
                });
            });
            
            WW_Dice.updateConfrontationPreview();
            
            var animationDelay = 0;
            sortedDice.forEach(function(dice) {
                setTimeout(function() {
                    var diceEl = $('dice_' + dice.id);
                    if (diceEl) WW_Dice.animateDiceRoll(diceEl, dice.value);
                }, animationDelay);
                animationDelay += 100;
            });
        },
        
        notif_windRevealed: function(notif) {
            console.log('notif_windRevealed', notif);
            
            WW_Hex.revealWindToken(notif.args.tile_id, notif.args.force);
            WW_Dice.clearDice('wind');
            
            var allWindDice = [];
            (notif.args.white_dice || []).forEach(function(dice, index) {
                allWindDice.push({ type: 'white', value: dice.value, dice_id: 'white_' + index });
            });
            (notif.args.green_dice || []).forEach(function(dice, index) {
                allWindDice.push({ type: 'green', value: dice.value, dice_id: 'green_' + index });
            });
            (notif.args.black_dice || []).forEach(function(dice, index) {
                allWindDice.push({ type: 'black', value: dice.value, dice_id: 'black_' + index });
            });
            
            WW_Dice.createDiceSorted(allWindDice, 'ww_wind_dice');
            WW_Dice.updateConfrontationPreview();
        },
        
        notif_confrontationSuccess: function(notif) {
            console.log('notif_confrontationSuccess', notif);
            WW_Hex.showConfrontationResult(WW_State.getSelectedTile(), true);
        },
        
        notif_confrontationFailure: function(notif) {
            console.log('notif_confrontationFailure', notif);
            WW_Hex.showConfrontationResult(WW_State.getSelectedTile(), false);
        },
        
        notif_moralUsed: function(notif) {
            console.log('notif_moralUsed', notif);
            
            WW_Player.updateMoral(notif.args.player_id, notif.args.new_moral);
            WW_Dice.updateDiceValue(notif.args.dice_id, notif.args.new_value);
            WW_Dice.updateConfrontationPreview();
        },
        
        notif_playerSurpasses: function(notif) {
            console.log('notif_playerSurpasses', notif);
            var current = WW_Player.getCurrentDiceCount(notif.args.player_id);
            WW_Player.updateDiceCount(notif.args.player_id, current - 1);
        },
        
        notif_playerRests: function(notif) {
            console.log('notif_playerRests', notif);
            var diceCount = notif.args.dice_count - notif.args.surpass_count;
            WW_Player.updateDiceCount(notif.args.player_id, diceCount);
        },
        
        notif_playerMoves: function(notif) {
            console.log('notif_playerMoves', notif);
            WW_Hex.movePlayerToken(this, notif.args.player_id, notif.args.q, notif.args.r);
            WW_Player.updatePosition(notif.args.player_id, notif.args.q, notif.args.r);
        },
        
        notif_cardToggled: function(notif) {
            console.log('notif_cardToggled', notif);
            WW_Cards.toggleDraftCardSelection(notif.args.card_id, notif.args.selected);
            if (notif.args.counts && notif.args.requirements) {
                WW_Cards.updateDraftCounts(notif.args.counts, notif.args.requirements);
            }
        },
        
        notif_draftComplete: function(notif) {
            console.log('notif_draftComplete', notif);
            WW_Cards.hideDraftPanel();
            if (notif.args.horde) {
                WW_Cards.refreshHorde(notif.args.horde);
            }
        },
        
        notif_autoSelectTeam: function(notif) {
            console.log('notif_autoSelectTeam', notif);
        },
        
        notif_hordierLost: function(notif) {
            console.log('notif_hordierLost', notif);
            WW_Cards.removeHordeCard(notif.args.card_id, true);
        }
   });
});
