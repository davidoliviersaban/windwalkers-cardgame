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
        
        disconnect: function(handle) {
            if (handle) dojo.disconnect(handle);
        },
        
        // Store event handles for later disconnection
        _eventHandles: {},
        
        connectWithId: function(id, event, scope, handler) {
            var el = typeof id === 'string' ? $(id) : id;
            if (el) {
                var elId = el.id || id;
                var key = elId + '_' + event;
                // Disconnect existing handler if any
                if (this._eventHandles[key]) {
                    dojo.disconnect(this._eventHandles[key]);
                }
                this._eventHandles[key] = dojo.connect(el, event, scope, handler);
                return this._eventHandles[key];
            }
            return null;
        },
        
        disconnectById: function(id, event) {
            var key = id + '_' + event;
            if (this._eventHandles[key]) {
                dojo.disconnect(this._eventHandles[key]);
                delete this._eventHandles[key];
            }
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
        
        /**
         * Check if horde meets all requirements
         * Returns { valid: bool, canSkip: bool, reason: string, excessTypes: [] }
         */
        checkHordeValidity: function(hordeCount, counts, requirements) {
            var result = {
                valid: true,
                canSkip: true,
                reason: '',
                excessTypes: []
            };
            
            // Check max hordiers
            if (hordeCount > 8) {
                result.valid = false;
                result.canSkip = false;
                result.reason = _('⚠ Must release a Hordier!');
                return result;
            }
            
            // Check maximum requirements (can't exceed type limits)
            if (counts && requirements) {
                for (var type in requirements) {
                    var required = requirements[type];
                    var current = counts[type] || 0;
                    if (current > required) {
                        result.valid = false;
                        result.canSkip = false;
                        result.excessTypes.push((current - required) + ' ' + type);
                    }
                }
                if (result.excessTypes.length > 0) {
                    result.reason = _('⚠ Horde exceeds limits - Must release!');
                }
            }
            
            return result;
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
        MAP_CENTER_X: 1500,  // Center of 3000px scrollable area
        MAP_CENTER_Y: 1500,  // Center of 3000px scrollable area
        
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
            
            if (token) {
                // Use CSS transition for smooth animation
                dojo.style(token, 'transition', 'left 0.5s ease-out, top 0.5s ease-out');
                dojo.style(token, 'left', pos.x + 'px');
                dojo.style(token, 'top', pos.y + 'px');
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
            
            // Update confrontation preview if dice were restored
            if ((gamedatas.horde_dice && Object.keys(gamedatas.horde_dice).length > 0) ||
                (gamedatas.challenge_dice && Object.keys(gamedatas.challenge_dice).length > 0)) {
                this.updateConfrontationPreview();
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
            // Convert to integer - DB returns strings like "0" or "1"
            var powerUsed = parseInt(card.card_power_used || card.power_used || 0, 10);
            
            this.createCard({
                prefix: 'ww_horde_item',
                card: card,
                containerId: 'ww_horde',
                extraClass: 'ww_horde_card_item' + (powerUsed ? ' ww_card_exhausted' : ''),
                onClick: onCardClick
            });
            
            WW_State.addHordeCard(cardId, { id: cardId, type: typeArg, powerUsed: powerUsed });
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
            // Clear any existing handlers first to prevent accumulation
            this.clearHordeSelectable();
            
            for (var cardId in hordeData) {
                var cardEl = $('ww_horde_item_' + cardId);
                if (cardEl) {
                    WW_DOM.addClass(cardEl, 'ww_selectable_card');
                    
                    (function(cid, el) {
                        WW_DOM.connectWithId(el.id, 'onclick', null, function(evt) {
                            WW_DOM.stopEvent(evt);
                            onSelectCard(cid);
                        });
                    })(cardId, cardEl);
                }
            }
        },
        
        clearHordeSelectable: function() {
            WW_DOM.forEach('.ww_horde_card_item', function(cardEl) {
                WW_DOM.removeClass(cardEl, 'ww_selectable_card');
                WW_DOM.disconnectById(cardEl.id, 'onclick');
            });
        },
        
        /**
         * Make horde cards usable (clickable to use power)
         * Only cards that are not exhausted can be clicked
         */
        makeHordeUsable: function(onUsePower) {
            // Clear any existing handlers first to prevent accumulation
            this.clearHordeUsable();
            
            WW_DOM.forEach('.ww_horde_card_item', function(cardEl) {
                // Only make non-exhausted cards usable
                if (!WW_DOM.hasClass(cardEl, 'ww_card_exhausted')) {
                    WW_DOM.addClass(cardEl, 'ww_card_usable');
                    
                    var cardId = cardEl.id.replace('ww_horde_item_', '');
                    WW_DOM.connectWithId(cardEl.id, 'onclick', null, function(evt) {
                        WW_DOM.stopEvent(evt);
                        onUsePower(cardId);
                    });
                }
            });
        },
        
        clearHordeUsable: function() {
            WW_DOM.forEach('.ww_horde_card_item', function(cardEl) {
                WW_DOM.removeClass(cardEl, 'ww_card_usable');
                WW_DOM.disconnectById(cardEl.id, 'onclick');
            });
        },
        
        /**
         * Make horde cards releasable (clickable to release during recruitment)
         */
        makeHordeReleasable: function(hordeData, onReleaseCard) {
            // Clear any existing handlers first to prevent accumulation
            this.clearHordeReleasable();
            
            var count = 0;
            WW_DOM.forEach('.ww_horde_card_item', function(cardEl) {
                WW_DOM.addClass(cardEl, 'ww_card_releasable');
                
                var cardId = cardEl.id.replace('ww_horde_item_', '');
                console.log('[WW] Making card releasable:', cardEl.id, 'cardId:', cardId);
                WW_DOM.connectWithId(cardEl.id, 'onclick', null, function(evt) {
                    console.log('[WW] Card clicked!', cardId);
                    WW_DOM.stopEvent(evt);
                    onReleaseCard(cardId);
                });
                count++;
            });
            console.log('[WW] Made', count, 'cards releasable');
        },
        
        clearHordeReleasable: function() {
            WW_DOM.forEach('.ww_horde_card_item', function(cardEl) {
                WW_DOM.removeClass(cardEl, 'ww_card_releasable');
                WW_DOM.disconnectById(cardEl.id, 'onclick');
            });
        },
        
        /**
         * Update the exhausted visual state of all horde cards based on server data
         */
        updateHordeExhaustedState: function(hordeData) {
            if (!hordeData) return;
            
            for (var cardId in hordeData) {
                var card = hordeData[cardId];
                var powerUsed = parseInt(card.card_power_used || card.power_used || 0, 10);
                this.setCardRested(cardId, !powerUsed);
            }
        },
        
        /**
         * Set a card as rested (power available) or exhausted
         */
        setCardRested: function(cardId, rested) {
            var cardEl = $('ww_horde_item_' + cardId);
            if (cardEl) {
                if (rested) {
                    WW_DOM.removeClass(cardEl, 'ww_card_exhausted');
                    WW_DOM.addClass(cardEl, 'ww_card_rested');
                    // Animation to show power recovered
                    WW_DOM.animateClass(cardEl, 'ww_card_pulse', 500);
                } else {
                    WW_DOM.addClass(cardEl, 'ww_card_exhausted');
                    WW_DOM.removeClass(cardEl, 'ww_card_rested');
                }
            }
        },
        
        /**
         * Set all cards of a player as rested
         */
        setAllCardsRested: function(playerId) {
            var self = this;
            WW_DOM.forEach('.ww_horde_card_item', function(cardEl) {
                WW_DOM.removeClass(cardEl, 'ww_card_exhausted');
                WW_DOM.addClass(cardEl, 'ww_card_rested');
            });
            // Animation for all cards
            WW_DOM.forEach('.ww_horde_card_item', function(cardEl) {
                WW_DOM.animateClass(cardEl, 'ww_card_pulse', 500);
            });
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
            if (titleEl) WW_DOM.setHtml(titleEl, _('Recruitment - Click to recruit or release'));
            
            WW_DOM.hide('ww_draft_selected');
            WW_DOM.forEach('.ww_draft_requirements', function(el) {
                WW_DOM.hide(el);
            });
            
            // All cards are always clickable - player can recruit any character
            for (var cardId in recruitPool) {
                var card = recruitPool[cardId];
                
                this.createCard({
                    prefix: 'recruit_card',
                    card: card,
                    containerId: 'ww_available_characters',
                    extraClass: 'ww_recruit_card',
                    onClick: function(cid) {
                        onRecruitClick(parseInt(cid, 10));
                    }
                });
            }
            
            return { isEmpty: false, count: poolSize, recruitableCount: poolSize };
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
            this.animationSpeed = 500;
            this._lastMessage = '';
            this._lastMessageTime = 0;
            this._actionInProgress = false;
        },
        
        // Override showMessage to debounce duplicate messages
        showMessage: function(msg, type) {
            var now = Date.now();
            // Skip if same message within 2 seconds
            if (msg === this._lastMessage && (now - this._lastMessageTime) < 2000) {
                return;
            }
            this._lastMessage = msg;
            this._lastMessageTime = now;
            this.inherited(arguments);
        },
        
        // Wrapper for bgaPerformAction that prevents double-clicks
        performAction: function(action, args) {
            if (this._actionInProgress) {
                return;
            }
            
            this._actionInProgress = true;
            var self = this;
            
            this.bgaPerformAction(action, args || {}).then(function() {
                self._actionInProgress = false;
            }).catch(function() {
                self._actionInProgress = false;
            });
        },
        
        /*
         * setup: Called on page load
         */
        setup: function(gamedatas) {
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
            var self = this;
            
            // Wait for DOM to be fully rendered
            setTimeout(function() {
                self._doCenterMapOnTiles(tiles);
            }, 100);
        },
        
        _doCenterMapOnTiles: function(tiles) {
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
            var rect = container.getBoundingClientRect();
            var containerWidth = rect.width || container.offsetWidth || 800;
            var containerHeight = rect.height || container.offsetHeight || 600;
            
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
            // Map will be centered on player after setupPlayerTokens
        },
        
        setupPlayerTokens: function(players) {
            for (var player_id in players) {
                WW_Hex.createPlayerToken(player_id, players[player_id]);
            }
            
            // Center map on current player's token
            this.centerMapOnPlayer(players);
        },
        
        centerMapOnPlayer: function(players) {
            var self = this;
            
            // Find current player's position
            var playerData = players[this.player_id];
            
            if (!playerData) {
                // If not found, use first player (spectator mode)
                for (var pid in players) {
                    playerData = players[pid];
                    break;
                }
            }
            
            if (!playerData) return;
            
            // Wait for DOM to be fully rendered
            setTimeout(function() {
                self._doCenterMapOnPlayer(playerData.pos_q, playerData.pos_r);
            }, 500);
        },
        
        _doCenterMapOnPlayer: function(q, r) {
            // Use hexToPixelCenter to get the pixel position, same as createPlayerToken
            var pos = WW_Hex.hexToPixelCenter(q, r);
            var tokenLeft = pos.x;
            var tokenTop = pos.y;
            
            // Get container dimensions
            var container = $('ww_map_container');
            var rect = container.getBoundingClientRect();
            var containerWidth = rect.width || container.offsetWidth || 800;
            var containerHeight = rect.height || container.offsetHeight || 600;
            
            // Calculate scroll position to center the token
            var scrollX = containerWidth / 2 - tokenLeft;
            var scrollY = containerHeight / 2 - tokenTop;
            
            // Directly set the position of both scrollable layers
            var scrollable = $('ww_map_scrollable');
            var oversurface = $('ww_map_scrollable_oversurface');
            
            if (scrollable) {
                dojo.style(scrollable, 'left', scrollX + 'px');
                dojo.style(scrollable, 'top', scrollY + 'px');
            }
            if (oversurface) {
                dojo.style(oversurface, 'left', scrollX + 'px');
                dojo.style(oversurface, 'top', scrollY + 'px');
            }
        },
        
        ///////////////////////////////////////////////////
        //// Game & client states
        
        onEnteringState: function(stateName, args) {
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
                case 'mustReleaseHordier':
                    this.enterMustReleaseHordierState(args.args);
                    break;
            }
        },
        
        onLeavingState: function(stateName) {
            switch (stateName) {
                case 'playerTurn':
                    WW_Hex.clearHighlights();
                    WW_Cards.clearHordeUsable();
                    break;
                case 'confrontation':
                case 'diceResult':
                    WW_Cards.clearHordeUsable();
                    break;
                case 'loseHordier':
                    WW_Cards.clearHordeSelectable();
                    break;
                case 'recruitment':
                    WW_Cards.hideRecruitmentInterface();
                    WW_Cards.clearHordeReleasable();
                    break;
                case 'mustReleaseHordier':
                    WW_Cards.clearHordeReleasable();
                    break;
            }
        },
        
        onUpdateActionButtons: function(stateName, args) {
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
                    // Check confrontation result to set button color
                    var hordeDice = WW_Dice.getHordeDice();
                    var windDice = WW_Dice.getWindDice();
                    var windForce = parseInt(WW_DOM.getHtml('ww_wind_force')) || 0;
                    var buttonColor = 'blue'; // default to success
                    if (hordeDice.length > 0 && windDice.length > 0) {
                        var result = WW_Dice.calculateConfrontationResult(hordeDice, windDice, windForce);
                        buttonColor = (result && result.success) ? 'blue' : 'red';
                    }
                    this.addActionButton('btn_confirm_roll', _('Confirm'), 'onConfirmRoll', null, false, buttonColor);
                    break;
                case 'recruitment':
                    // Can finish recruitment only if horde meets all constraints
                    var validity = WW_State.checkHordeValidity(
                        args ? args.horde_count : 0,
                        args ? args.counts : null,
                        args ? args.requirements : null
                    );
                    
                    if (validity.canSkip) {
                        this.addActionButton('btn_skip_recruit', _('Finish Recruitment'), 'onSkipRecruitment', null, false, 'blue');
                    } else {
                        this.addActionButton('btn_skip_recruit', validity.reason, null, null, false, 'red');
                        dojo.addClass('btn_skip_recruit', 'disabled');
                    }
                    break;
                case 'mustReleaseHordier':
                    // No skip button - player must release a hordier
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
            
            // Make horde cards clickable to use powers
            if (this.isCurrentPlayerActive()) {
                var self = this;
                WW_Cards.makeHordeUsable(function(cardId) {
                    self.onUsePower(cardId);
                });
            }
        },
        
        enterConfrontationState: function(args) {
            WW_Dice.clearDice('horde');
            WW_Dice.clearDice('wind');
            
            var self = this;
            
            // Update horde exhausted state from server data
            if (args.horde) {
                WW_Cards.updateHordeExhaustedState(args.horde);
            }
            
            // Make horde cards clickable to use powers during confrontation
            if (this.isCurrentPlayerActive()) {
                WW_Cards.makeHordeUsable(function(cardId) {
                    self.onUsePower(cardId);
                });
            }
            
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
            
            // Update horde exhausted state from server data
            if (args && args.horde) {
                WW_Cards.updateHordeExhaustedState(args.horde);
            }
            
            // Make horde cards clickable to use powers
            if (this.isCurrentPlayerActive()) {
                var self = this;
                WW_Cards.makeHordeUsable(function(cardId) {
                    self.onUsePower(cardId);
                });
            }
        },
        
        enterLoseHordierState: function(args) {
            if (!args || !args.horde) return;
            
            var self = this;
            WW_Cards.makeHordeSelectable(args.horde, function(cardId) {
                self.onAbandonHordier(cardId);
            });
            
            // Add abandon game button
            if (this.isCurrentPlayerActive()) {
                this.addActionButton('btn_abandon_game', _('Abandon Expedition'), function() {
                    self.onAbandonGame();
                }, null, false, 'red');
            }
            
            this.showMessage(_("You must abandon a Hordier! Click on a card to abandon it."), "info");
        },
        
        enterRecruitmentState: function(args) {
            var self = this;
            var hordeCount = args.horde_count || 0;
            
            // Check horde validity
            var validity = WW_State.checkHordeValidity(hordeCount, args.counts, args.requirements);
            
            var result = WW_Cards.showRecruitmentInterface(args, function(cardId) {
                self.onRecruitCard(cardId);
            });
            
            // Always make horde cards selectable to release (player can always release)
            if (this.isCurrentPlayerActive()) {
                WW_Cards.makeHordeReleasable(args.horde, function(cardId) {
                    self.onReleaseHordier(cardId);
                });
            }
            
            // Show appropriate message based on horde state
            if (hordeCount > 8) {
                this.showMessage(_("Too many Hordiers! Click on a Hordier to release before finishing."), "error");
            } else if (validity.excessTypes.length > 0) {
                this.showMessage(_("Horde exceeds type limits: ") + validity.excessTypes.join(', ') + _(" - Release a Hordier to continue."), "error");
            } else if (result && result.isEmpty) {
                this.showMessage(_("No characters available. Click 'Finish Recruitment' to continue."), "info");
            } else {
                this.showMessage(_("Recruit characters or release Hordiers. Click 'Finish Recruitment' when done."), "info");
            }
        },
        
        enterMustReleaseHordierState: function(args) {
            var self = this;
            
            // Make horde cards selectable for release
            if (this.isCurrentPlayerActive() && args.horde) {
                WW_Cards.clearHordeReleasable();
                WW_Cards.makeHordeReleasable(args.horde, function(cardId) {
                    self.onReleaseHordier(cardId);
                });
            }
            
            this.showMessage(_("You have more than 8 Hordiers! You must release one."), "info");
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
            this.performAction('actSelectTile', { tile_id: tileId });
        },
        
        onDiceClick: function(diceId) {
            WW_Dice.selectDice(diceId);
        },
        
        onDraftCardClick: function(cardId) {
            if (!this.isCurrentPlayerActive()) return;
            
            var cardEl = $('draft_card_' + cardId);
            if (!cardEl) return;
            
            var isSelected = WW_DOM.hasClass(cardEl, 'ww_selected');
            this.performAction('actToggleDraftCard', {
                card_id: cardId,
                select: !isSelected
            });
        },
        
        ///////////////////////////////////////////////////
        //// Action Handlers
        
        onRollDice: function(evt) {
            WW_DOM.stopEvent(evt);
            this.performAction('actRollDice', {});
        },
        
        onMoralPlus: function(evt) {
            WW_DOM.stopEvent(evt);
            
            if (!WW_State.hasSelectedDice()) {
                this.showMessage(_("Please select a die first"), "error");
                return;
            }
            
            this.performAction('actUseMoral', {
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
            
            this.performAction('actUseMoral', {
                dice_id: parseInt(WW_State.getFirstSelectedDice()),
                modifier: -1
            });
        },
        
        onConfirmRoll: function(evt) {
            WW_DOM.stopEvent(evt);
            this.performAction('actConfirmRoll', {});
        },
        
        onRest: function(evt) {
            WW_DOM.stopEvent(evt);
            this.performAction('actRest', {});
        },
        
        onUsePower: function(cardId) {
            this.performAction('actUsePower', { card_id: parseInt(cardId) });
        },
        
        onConfirmDraft: function(evt) {
            WW_DOM.stopEvent(evt);
            this.performAction('actConfirmDraft', {});
        },
        
        onAbandonHordier: function(cardId) {
            this.performAction('actAbandonHordier', { card_id: parseInt(cardId) });
        },
        
        onAbandonGame: function() {
            var self = this;
            this.confirmationDialog(
                _('Are you sure you want to abandon the expedition? This will end the game for you.'),
                function() {
                    self.performAction('actAbandonGame', {});
                }
            );
        },
        
        onRecruitCard: function(cardId) {
            this.performAction('actRecruit', { card_id: parseInt(cardId) });
        },
        
        onReleaseHordier: function(cardId) {
            this.performAction('actReleaseHordier', { card_id: parseInt(cardId) });
        },
        
        onSkipRecruitment: function(evt) {
            WW_DOM.stopEvent(evt);
            WW_Cards.hideRecruitmentInterface();
            this.performAction('actSkipRecruitment', {});
        },
        
        ///////////////////////////////////////////////////
        //// Notifications

        setupNotifications: function() {
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
            
            dojo.subscribe('playerEliminated', this, "notif_playerEliminated");
            this.notifqueue.setSynchronous('playerEliminated', 2000);
            
            dojo.subscribe('hordierRecruited', this, "notif_hordierRecruited");
            this.notifqueue.setSynchronous('hordierRecruited', 500);
            
            dojo.subscribe('hordierReleased', this, "notif_hordierReleased");
            this.notifqueue.setSynchronous('hordierReleased', 500);
            
            dojo.subscribe('scoreUpdate', this, "notif_scoreUpdate");
            
            dojo.subscribe('finalScore', this, "notif_finalScore");
            this.notifqueue.setSynchronous('finalScore', 1000);
            
            dojo.subscribe('chapterComplete', this, "notif_chapterComplete");
            this.notifqueue.setSynchronous('chapterComplete', 1000);
            
            dojo.subscribe('newChapter', this, "notif_newChapter");
            this.notifqueue.setSynchronous('newChapter', 1500);
            
            dojo.subscribe('moralChanged', this, "notif_moralChanged");
            this.notifqueue.setSynchronous('moralChanged', 500);
            
            dojo.subscribe('hordierRested', this, "notif_hordierRested");
            this.notifqueue.setSynchronous('hordierRested', 500);
            
            dojo.subscribe('allHordiersRested', this, "notif_allHordiersRested");
            this.notifqueue.setSynchronous('allHordiersRested', 500);
            
            dojo.subscribe('powerUsed', this, "notif_powerUsed");
            this.notifqueue.setSynchronous('powerUsed', 500);
        },
        
        notif_diceRolled: function(notif) {
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
            WW_Hex.showConfrontationResult(WW_State.getSelectedTile(), true);
            if (notif.args.new_score !== undefined) {
                this.scoreCtrl[notif.args.player_id].toValue(notif.args.new_score);
            }
        },
        
        notif_confrontationFailure: function(notif) {
            WW_Hex.showConfrontationResult(WW_State.getSelectedTile(), false);
        },
        
        notif_moralUsed: function(notif) {
            
            WW_Player.updateMoral(notif.args.player_id, notif.args.new_moral);
            WW_Dice.updateDiceValue(notif.args.dice_id, notif.args.new_value);
            WW_Dice.updateConfrontationPreview();
        },
        
        notif_playerSurpasses: function(notif) {
            var current = WW_Player.getCurrentDiceCount(notif.args.player_id);
            WW_Player.updateDiceCount(notif.args.player_id, current - 1);
        },
        
        notif_playerRests: function(notif) {
            var diceCount = notif.args.dice_count - notif.args.surpass_count;
            WW_Player.updateDiceCount(notif.args.player_id, diceCount);
        },
        
        notif_playerMoves: function(notif) {
            WW_Hex.movePlayerToken(this, notif.args.player_id, notif.args.q, notif.args.r);
            WW_Player.updatePosition(notif.args.player_id, notif.args.q, notif.args.r);
            
            // Center map on player if it's our player moving
            if (notif.args.player_id == this.player_id) {
                var self = this;
                setTimeout(function() {
                    self._doCenterMapOnPlayer(notif.args.q, notif.args.r);
                }, 600); // Wait for move animation to complete
            }
        },
        
        notif_cardToggled: function(notif) {
            WW_Cards.toggleDraftCardSelection(notif.args.card_id, notif.args.selected);
            if (notif.args.counts && notif.args.requirements) {
                WW_Cards.updateDraftCounts(notif.args.counts, notif.args.requirements);
            }
        },
        
        notif_draftComplete: function(notif) {
            WW_Cards.hideDraftPanel();
            if (notif.args.horde) {
                WW_Cards.refreshHorde(notif.args.horde);
            }
        },
        
        notif_autoSelectTeam: function(notif) {
            // Auto-select handled server-side
        },
        
        notif_hordierLost: function(notif) {
            WW_Cards.removeHordeCard(notif.args.card_id, true);
        },
        
        notif_playerEliminated: function(notif) {
            // Show elimination message
            this.showMessage(_("Game Over! All hordiers have been lost."), "error");
        },
        
        notif_hordierRecruited: function(notif) {
            // Add the recruited card to horde if it's our player
            if (notif.args.player_id == this.player_id) {
                // Card data should be in notification
                var card = notif.args.card || {
                    card_id: notif.args.card_id,
                    card_type: notif.args.card_type,
                    card_type_arg: notif.args.card_type_arg
                };
                WW_Cards.addHordeCard(card);
            }
            // Remove from recruitment panel
            var recruitCard = $('recruit_card_' + notif.args.card_id);
            if (recruitCard) {
                WW_DOM.destroy(recruitCard);
            }
            
            // Check if recruitment panel is now empty
            var availableChars = $('ww_available_characters');
            if (availableChars && availableChars.childNodes.length === 0) {
                WW_DOM.hide('ww_draft_panel');
            }
        },
        
        notif_hordierReleased: function(notif) {
            // Remove from horde with animation
            WW_Cards.removeHordeCard(notif.args.card_id, true);
            
            // If released in a village or city, add to recruitment panel
            if ((notif.args.tile_type === 'village' || notif.args.tile_type === 'city') && notif.args.card) {
                var self = this;
                WW_Cards.createCard({
                    prefix: 'recruit_card',
                    card: notif.args.card,
                    containerId: 'ww_available_characters',
                    extraClass: 'ww_recruit_card',
                    onClick: function(cid) {
                        self.onRecruitCard(parseInt(cid, 10));
                    }
                });
            }
        },
        
        notif_scoreUpdate: function(notif) {
            this.scoreCtrl[notif.args.player_id].toValue(notif.args.score);
        },
        
        notif_finalScore: function(notif) {
            this.scoreCtrl[notif.args.player_id].toValue(notif.args.score);
            
            // Display score breakdown
            var breakdown = notif.args.breakdown;
            var msg = _('Score: ') + notif.args.score + ' = ' +
                      breakdown.tiles + _(' (tiles) + ') +
                      breakdown.surpass + _(' (surpass) + ') +
                      breakdown.moral + _(' (moral) + ') +
                      breakdown.hordiers_points + _(' (hordiers) + ') +
                      breakdown.furevents_points + _(' (furevents)');
            this.showMessage(msg, 'info');
        },
        
        notif_chapterComplete: function(notif) {
            this.showMessage(_('Chapter ') + notif.args.chapter_num + _(' complete!'), 'info');
        },
        
        notif_newChapter: function(notif) {
            var self = this;
            
            // Clear existing tiles
            var mapScrollable = $('ww_map_scrollable');
            if (mapScrollable) {
                // Remove all tile elements
                dojo.query('.ww_tile', mapScrollable).forEach(function(node) {
                    dojo.destroy(node);
                });
            }
            
            // Create new tiles
            var tiles = notif.args.tiles;
            for (var tile_id in tiles) {
                var tileEl = WW_Hex.createTile(tiles[tile_id]);
                WW_DOM.connect(tileEl, 'onclick', this, 'onTileClick');
            }
            
            // Update player positions
            var players = notif.args.players;
            for (var player_id in players) {
                var player = players[player_id];
                WW_Hex.movePlayerToken(this, player_id, player.pos_q, player.pos_r);
            }
            
            // Center map on current player
            setTimeout(function() {
                self.centerMapOnPlayer(players);
            }, 500);
            
            // Update chapter number in state
            WW_State.chapter = notif.args.chapter_num;
        },
        
        notif_moralChanged: function(notif) {
            WW_Player.updateMoral(notif.args.player_id, notif.args.new_moral);
        },
        
        notif_hordierRested: function(notif) {
            WW_Cards.setCardRested(notif.args.card_id, true);
        },
        
        notif_allHordiersRested: function(notif) {
            WW_Cards.setAllCardsRested(notif.args.player_id);
        },
        
        notif_powerUsed: function(notif) {
            WW_Cards.setCardRested(notif.args.card_id, false);
        }
   });
});
