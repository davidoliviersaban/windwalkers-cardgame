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
            currentState: null,
            powerTargetMode: null,  // { card_id, power_code, callback }
            utherDiceMode: null     // { source_card_id, target_card_id, max_ignore, selected_dice }
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
        
        // Power target selection mode
        setPowerTargetMode: function(mode) {
            this._data.powerTargetMode = mode;
        },
        
        getPowerTargetMode: function() {
            return this._data.powerTargetMode;
        },
        
        clearPowerTargetMode: function() {
            this._data.powerTargetMode = null;
        },
        
        isInPowerTargetMode: function() {
            return this._data.powerTargetMode !== null;
        },
        
        // Uther dice selection mode
        setUtherDiceMode: function(mode) {
            this._data.utherDiceMode = mode;
        },
        
        getUtherDiceMode: function() {
            return this._data.utherDiceMode;
        },
        
        clearUtherDiceMode: function() {
            this._data.utherDiceMode = null;
        },
        
        isInUtherDiceMode: function() {
            return this._data.utherDiceMode !== null;
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
        
        getHordeCards: function() {
            return this._data.hordeCards || {};
        },
        
        getHordeCard: function(cardId) {
            return this._data.hordeCards[cardId] || null;
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
        },
        
        /**
         * Get card image URL based on character ID
         * Images follow naming convention: {ID}.{Type}.{Name}.T{tier}.{index}.png
         * Example: 001.Traceur.Uther le Fonceur.T3.00.png
         */
        getCardImageUrl: function(charId) {
            var basePath = (typeof g_gamethemeurl !== 'undefined' ? g_gamethemeurl : '') + 'img/cards/';
            var charInfo = this.getCharacter(charId);
            if (!charInfo) return basePath + 'card_back.png';
            
            // Pad ID to 3 digits
            var paddedId = String(charId).padStart(3, '0');
            
            // Get type name (capitalized)
            var typeName = charInfo.position || 'Pack';
            typeName = typeName.charAt(0).toUpperCase() + typeName.slice(1);
            
            // Get character name
            var charName = charInfo.name || 'Unknown';
            
            // Get tier
            var tier = charInfo.tier || 2;
            
            // Index is charId - 1 (0-based)
            var index = String(parseInt(charId) - 1).padStart(2, '0');
            
            return basePath + paddedId + '.' + typeName + '.' + charName + '.T' + tier + '.' + index + '.png';
        }
    };
    
    // ============================================================
    // WW_CardPreview - Card preview tooltip on hover
    // ============================================================
    var WW_CardPreview = {
        hoverTimer: null,
        previewVisible: false,
        HOVER_DELAY: 1000, // 1 second
        
        init: function() {
            // Create overlay if not exists
            if (!$('ww_card_preview_overlay')) {
                var overlayHtml = '<div id="ww_card_preview_overlay" class="ww_card_preview_overlay">' +
                                  '<img id="ww_card_preview_image" class="ww_card_preview" src="" />' +
                                  '<div id="ww_card_preview_info" class="ww_card_preview_info">' +
                                  '<div id="ww_card_preview_name" class="ww_card_preview_name"></div>' +
                                  '<div id="ww_card_preview_type" class="ww_card_preview_type"></div>' +
                                  '<div id="ww_card_preview_power" class="ww_card_preview_power"></div>' +
                                  '</div>' +
                                  '</div>';
                WW_DOM.place(overlayHtml, document.body, 'last');
                
                // Click on overlay to close
                WW_DOM.connect('ww_card_preview_overlay', 'onclick', null, function() {
                    WW_CardPreview.hide();
                });
            }
        },
        
        setupHover: function(cardEl, typeArg) {
            var self = this;
            
            // Mouse enter - start timer
            dojo.connect(cardEl, 'onmouseenter', function() {
                self.cancelTimer();
                self.hoverTimer = setTimeout(function() {
                    self.show(typeArg);
                }, self.HOVER_DELAY);
            });
            
            // Mouse leave - cancel timer
            dojo.connect(cardEl, 'onmouseleave', function() {
                self.cancelTimer();
            });
            
            // Click - cancel timer (don't show preview on click)
            dojo.connect(cardEl, 'onclick', function() {
                self.cancelTimer();
            });
        },
        
        cancelTimer: function() {
            if (this.hoverTimer) {
                clearTimeout(this.hoverTimer);
                this.hoverTimer = null;
            }
        },
        
        show: function(typeArg) {
            this.init(); // Ensure overlay exists
            
            var charInfo = WW_State.getCharacter(typeArg);
            var cardImageUrl = WW_State.getCardImageUrl(typeArg);
            var displayType = WW_State.getDisplayType(typeArg);
            
            $('ww_card_preview_image').src = cardImageUrl;
            WW_DOM.setHtml('ww_card_preview_name', charInfo.name || 'Unknown');
            WW_DOM.setHtml('ww_card_preview_type', WW_State.capitalizeFirst(displayType));
            WW_DOM.setHtml('ww_card_preview_power', charInfo.power || '');
            
            WW_DOM.addClass('ww_card_preview_overlay', 'ww_visible');
            this.previewVisible = true;
        },
        
        hide: function() {
            WW_DOM.removeClass('ww_card_preview_overlay', 'ww_visible');
            this.previewVisible = false;
        }
    };
    
    // ============================================================
    // WW_PendingActions - Client-side action queue with undo
    // Actions are stored locally and sent to server on confirm
    // ============================================================
    var WW_PendingActions = {
        actions: [],           // Queue of pending actions
        originalState: null,   // Snapshot of state before any action
        gameInstance: null,    // Reference to main game object
        enabled: false,        // Whether pending mode is active
        
        /**
         * Initialize pending actions system
         */
        init: function(gameInstance) {
            this.gameInstance = gameInstance;
            this.clear();
        },
        
        /**
         * Enable pending mode and save current state
         */
        enable: function(initialState) {
            this.enabled = true;
            this.originalState = JSON.parse(JSON.stringify(initialState));
            this.actions = [];
            this.updateUI();
        },
        
        /**
         * Disable pending mode
         */
        disable: function() {
            this.enabled = false;
            this.clear();
            this.updateUI();
        },
        
        /**
         * Check if pending mode is active
         */
        isEnabled: function() {
            return this.enabled;
        },
        
        /**
         * Add an action to the queue
         * @param {string} type - Action type (e.g., 'modifyDice', 'usePower')
         * @param {object} params - Action parameters
         * @param {object} visualEffect - How to show this action in UI
         */
        push: function(type, params, visualEffect) {
            if (!this.enabled) return false;
            
            var action = {
                id: Date.now() + '_' + this.actions.length,
                type: type,
                params: params,
                visual: visualEffect || {}
            };
            
            this.actions.push(action);
            this.applyVisualEffect(action, true);
            this.updateUI();
            this.updateConfrontationStatus();
            
            return action.id;
        },
        
        /**
         * Undo the last action
         */
        undo: function() {
            if (this.actions.length === 0) return false;
            
            var action = this.actions.pop();
            this.applyVisualEffect(action, false);
            this.updateUI();
            this.updateConfrontationStatus();
            
            return action;
        },
        
        /**
         * Undo all actions (restore original state)
         */
        undoAll: function() {
            while (this.actions.length > 0) {
                this.undo();
            }
            this.restoreOriginalVisual();
            this.updateConfrontationStatus();
        },
        
        /**
         * Clear all pending actions without undoing visuals
         */
        clear: function() {
            this.actions = [];
            this.originalState = null;
            this.updateUI();
        },
        
        /**
         * Get all pending actions for server submission
         */
        getActions: function() {
            return this.actions.map(function(a) {
                return { type: a.type, params: a.params };
            });
        },
        
        /**
         * Check if there are pending actions
         */
        hasPending: function() {
            return this.actions.length > 0;
        },
        
        /**
         * Get count of pending actions
         */
        count: function() {
            return this.actions.length;
        },
        
        /**
         * Get computed state after all pending actions
         */
        getComputedState: function() {
            if (!this.originalState) return null;
            
            var state = JSON.parse(JSON.stringify(this.originalState));
            
            for (var i = 0; i < this.actions.length; i++) {
                var action = this.actions[i];
                this.applyActionToState(state, action);
            }
            
            return state;
        },
        
        /**
         * Apply an action to state object (for local computation)
         */
        applyActionToState: function(state, action) {
            switch (action.type) {
                case 'modifyDice':
                    if (state.dice && state.dice[action.params.dice_id]) {
                        state.dice[action.params.dice_id].value += action.params.modifier;
                        state.dice[action.params.dice_id].value = Math.max(1, Math.min(6, state.dice[action.params.dice_id].value));
                    }
                    if (state.moral !== undefined) {
                        state.moral -= 1;
                    }
                    break;
                    
                case 'usePower':
                    if (state.horde && state.horde[action.params.card_id]) {
                        state.horde[action.params.card_id].power_used = 1;
                    }
                    // Handle powers that affect other cards (like Vera resting a target)
                    if (action.params.target_card_id && state.horde && state.horde[action.params.target_card_id]) {
                        state.horde[action.params.target_card_id].power_used = 0;  // Target is rested
                    }
                    break;
                    
                case 'rerollAll':
                    if (state.moral !== undefined) {
                        state.moral -= 1;
                    }
                    // Dice values would come from server
                    break;
            }
        },
        
        /**
         * Apply visual effect for an action
         */
        applyVisualEffect: function(action, apply) {
            var visual = action.visual;
            
            switch (action.type) {
                case 'modifyDice':
                    var diceEl = $('dice_' + action.params.dice_id);
                    if (diceEl) {
                        if (apply) {
                            var currentValue = parseInt(WW_DOM.getAttr(diceEl, 'data-value')) || parseInt(WW_DOM.getHtml(diceEl)) || 0;
                            var newValue = Math.max(1, Math.min(6, currentValue + action.params.modifier));
                            WW_DOM.setHtml(diceEl, newValue);
                            WW_DOM.setAttr(diceEl, 'data-value', newValue);
                            WW_DOM.addClass(diceEl, 'ww_pending_modified');
                        } else {
                            // Revert to previous value
                            var currentValue = parseInt(WW_DOM.getAttr(diceEl, 'data-value')) || 0;
                            var revertValue = visual.originalValue !== undefined ? visual.originalValue : (currentValue - action.params.modifier);
                            WW_DOM.setHtml(diceEl, revertValue);
                            WW_DOM.setAttr(diceEl, 'data-value', revertValue);
                            // Only remove class if no other modify actions on this dice
                            if (!this.hasPendingForDice(action.params.dice_id)) {
                                WW_DOM.removeClass(diceEl, 'ww_pending_modified');
                            }
                        }
                    }
                    // Update moral display
                    this.updatePendingMoral(apply ? -1 : 1);
                    break;
                    
                case 'usePower':
                    var cardEl = $('ww_horde_item_' + action.params.card_id);
                    if (cardEl) {
                        if (apply) {
                            WW_DOM.addClass(cardEl, 'ww_pending_exhausted');
                        } else {
                            WW_DOM.removeClass(cardEl, 'ww_pending_exhausted');
                        }
                    }
                    // Handle powers that affect other cards
                    if (action.params.target_card_id) {
                        var targetEl = $('ww_horde_item_' + action.params.target_card_id);
                        if (targetEl) {
                            // Get power type from source card
                            var sourceCard = WW_State.getHordeCard(action.params.card_id);
                            var sourceType = sourceCard ? sourceCard.type : null;
                            var charInfo = sourceType ? WW_State.getCharacter(sourceType) : null;
                            var powerCode = charInfo ? charInfo.power_code : null;
                            
                            if (powerCode === 'uther_power') {
                                // Uther sacrifices target - mark as pending discard
                                if (apply) {
                                    WW_DOM.addClass(targetEl, 'ww_pending_discarded');
                                } else {
                                    WW_DOM.removeClass(targetEl, 'ww_pending_discarded');
                                }
                            } else {
                                // Other powers (like Vera) rest the target
                                if (apply) {
                                    WW_DOM.removeClass(targetEl, 'ww_card_exhausted');
                                    WW_DOM.addClass(targetEl, 'ww_pending_rested');
                                } else {
                                    WW_DOM.addClass(targetEl, 'ww_card_exhausted');
                                    WW_DOM.removeClass(targetEl, 'ww_pending_rested');
                                }
                            }
                        }
                    }
                    break;
            }
        },
        
        /**
         * Check if there's a pending action for a specific dice
         */
        hasPendingForDice: function(diceId) {
            return this.actions.some(function(a) {
                return a.type === 'modifyDice' && a.params.dice_id === diceId;
            });
        },
        
        /**
         * Update moral display with pending changes
         */
        updatePendingMoral: function(change) {
            var moralEl = $('ww_player_moral_value');
            if (moralEl) {
                var currentMoral = parseInt(WW_DOM.getHtml(moralEl)) || 0;
                WW_DOM.setHtml(moralEl, currentMoral + change);
                if (this.hasPending()) {
                    WW_DOM.addClass(moralEl, 'ww_pending_changed');
                } else {
                    WW_DOM.removeClass(moralEl, 'ww_pending_changed');
                }
            }
        },
        
        /**
         * Restore all visuals to original state
         */
        restoreOriginalVisual: function() {
            // Remove all pending classes
            dojo.query('.ww_pending_modified').forEach(function(el) {
                WW_DOM.removeClass(el, 'ww_pending_modified');
            });
            dojo.query('.ww_pending_exhausted').forEach(function(el) {
                WW_DOM.removeClass(el, 'ww_pending_exhausted');
            });
            dojo.query('.ww_pending_changed').forEach(function(el) {
                WW_DOM.removeClass(el, 'ww_pending_changed');
            });
            
            // Restore original values if we have them
            if (this.originalState) {
                // Restore moral
                if (this.originalState.moral !== undefined) {
                    var moralEl = $('ww_player_moral_value');
                    if (moralEl) {
                        WW_DOM.setHtml(moralEl, this.originalState.moral);
                    }
                }
                
                // Restore dice values
                if (this.originalState.dice) {
                    for (var diceId in this.originalState.dice) {
                        var diceEl = $('dice_' + diceId);
                        if (diceEl) {
                            var originalValue = this.originalState.dice[diceId].value;
                            WW_DOM.setHtml(diceEl, originalValue);
                            WW_DOM.setAttr(diceEl, 'data-value', originalValue);
                        }
                    }
                }
            }
        },
        
        /**
         * Update undo button visibility
         */
        updateUI: function() {
            var undoBtn = $('btn_undo_action');
            var undoAllBtn = $('btn_undo_all');
            var pendingCount = $('ww_pending_count');
            
            if (undoBtn) {
                WW_DOM.toggleClass(undoBtn, 'disabled', !this.hasPending());
            }
            if (undoAllBtn) {
                WW_DOM.toggleClass(undoAllBtn, 'disabled', !this.hasPending());
            }
            if (pendingCount) {
                WW_DOM.setHtml(pendingCount, this.count() > 0 ? '(' + this.count() + ')' : '');
            }
        },
        
        /**
         * Update confrontation preview and Confirm button color based on current state
         */
        updateConfrontationStatus: function() {
            // Update dice preview
            WW_Dice.updateConfrontationPreview();
            
            // Update Confirm button color based on result
            var confirmBtn = $('btn_confirm_roll');
            if (confirmBtn) {
                var hordeDice = WW_Dice.getHordeDice();
                var windDice = WW_Dice.getWindDice();
                var windForce = parseInt(WW_DOM.getHtml('ww_wind_force')) || 0;
                
                if (hordeDice.length > 0 && windDice.length > 0) {
                    var result = WW_Dice.calculateConfrontationResult(hordeDice, windDice, windForce);
                    
                    // Remove existing color classes and add new one
                    WW_DOM.removeClass(confirmBtn, 'bgabutton_blue bgabutton_red bgabutton_green');
                    WW_DOM.addClass(confirmBtn, result.success ? 'bgabutton_blue' : 'bgabutton_red');
                }
            }
        },
        
        /**
         * Send all pending actions to server
         */
        confirm: function(callback) {
            if (!this.gameInstance) return;
            
            var actions = this.getActions();
            var self = this;
            
            if (actions.length === 0) {
                // No pending actions, just proceed
                if (callback) callback(true);
                return;
            }
            
            // Send batch to server using bgaPerformAction (returns promise)
            var self = this;
            this.gameInstance.bgaPerformAction('actBatchActions', {
                actions: JSON.stringify(actions)
            }).then(function() {
                self.clear();
                if (callback) callback(true);
            }).catch(function() {
                // Server rejected - restore original
                self.undoAll();
                if (callback) callback(false);
            });
        }
    };
    
    // ============================================================
    // WW_Hex - Hex grid utilities
    // ============================================================
    var WW_Hex = {
        HEX_SIZE: 75,
        HEX_WIDTH: 150,
        HEX_HEIGHT: 129,
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
            
            // Build tile image URL based on type/subtype
            var tileImageUrl = this.getTileImageUrl(tile.type, tile.subtype);
            var styleAttr = 'left:' + pos.x + 'px; top:' + pos.y + 'px;';
            if (tileImageUrl) {
                styleAttr += ' background-image: url(' + tileImageUrl + ');';
            }
            
            var tileHtml = '<div id="tile_' + tile.id + '" class="' + tileClass + '" ' +
                           'style="' + styleAttr + '">' +
                           '<div class="ww_tile_name">' + terrainName + '</div>' +
                           windHtml + '</div>';
            
            WW_DOM.place(tileHtml, 'ww_map_scrollable');
            return $('tile_' + tile.id);
        },
        
        /**
         * Get tile image URL based on type and subtype
         * Images follow naming convention:
         * - tile.normal.{terrain}.png (forest, desert, mountain, hut, steppe, swamp, water)
         * - tile.city.{name}.png (aberlaas, alticcio, campboban, chawondasee, portchoon)
         * - tile.village.{color}.png (blue, green, red) or tile.village.png
         * - tile.special.{name}.png (portedhurle, tourfontaine)
         */
        getTileImageUrl: function(type, subtype) {
            // Use BGA's g_gamethemeurl to get the correct path to game resources
            var basePath = (typeof g_gamethemeurl !== 'undefined' ? g_gamethemeurl : '') + 'img/tiles/tile.';
            
            // Normalize subtype (lowercase, keep underscores for village parsing)
            var normalizedSubtype = (subtype || '').toLowerCase();
            
            if (type === 'city') {
                // Cities: tile.city.{name}.png
                return basePath + 'city.' + normalizedSubtype + '.png';
            } else if (type === 'village') {
                // Villages: village_green -> tile.village.green.png
                if (normalizedSubtype.indexOf('village_') === 0) {
                    var color = normalizedSubtype.replace('village_', '');
                    return basePath + 'village.' + color + '.png';
                }
                // Default village
                return basePath + 'village.png';
            } else if (type === 'special' || normalizedSubtype === 'tourfontaine' || normalizedSubtype === 'portedhurle') {
                // Special tiles
                return basePath + 'special.' + normalizedSubtype + '.png';
            } else {
                // Normal terrain tiles: tile.normal.{terrain}.png
                // Map common terrain names to available images
                var terrainMap = {
                    'plain': 'steppe',
                    'steppe': 'steppe',
                    'forest': 'forest',
                    'mountain': 'mountain',
                    'hut': 'hut',
                    'water': 'water',
                    'lake': 'water',
                    'desert': 'desert',
                    'swamp': 'swamp',
                    'marsh': 'swamp',
                    'nordska': 'mountain'  // Use mountain as fallback for nordska
                };
                var mappedTerrain = terrainMap[normalizedSubtype] || normalizedSubtype;
                return basePath + 'normal.' + mappedTerrain + '.png';
            }
        },
        
        createPlayerToken: function(playerId, player) {
            var pos = this.hexToPixelCenter(player.pos_q, player.pos_r);
            
            // Sprite offset: player 1 = 0px, player 2 = -30px, etc.
            var spriteOffset = ((player.player_no || 1) - 1) * 30;
            var tokenHtml = '<div id="player_token_' + playerId + '" class="ww_player_token" ' +
                            'style="left:' + pos.x + 'px; top:' + pos.y + 'px; --sprite-offset: -' + spriteOffset + 'px;">' +
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
        
        deselectAllDice: function() {
            WW_DOM.removeClassFromAll('#ww_horde_dice .ww_dice', 'ww_selected');
            WW_State.clearSelectedDice();
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
                var value = parseInt(WW_DOM.getAttr(diceEl, 'data-value')) || 0;
                var type = 'blue';
                if (WW_DOM.hasClass(diceEl, 'ww_dice_violet')) type = 'violet';
                dice.push({ value: value, type: type });
            });
            return dice;
        },
        
        getWindDice: function() {
            var dice = [];
            WW_DOM.forEach('#ww_wind_dice .ww_dice', function(diceEl) {
                // Skip ignored dice (from Uther's power)
                if (WW_DOM.hasClass(diceEl, 'ww_dice_ignored')) return;
                
                var value = parseInt(WW_DOM.getAttr(diceEl, 'data-value')) || 0;
                var type = 'white';
                if (WW_DOM.hasClass(diceEl, 'ww_dice_green')) type = 'green';
                else if (WW_DOM.hasClass(diceEl, 'ww_dice_black')) type = 'black';
                dice.push({ value: value, type: type });
            });
            return dice;
        },
        
        calculateConfrontationResult: function(hordeDice, windDice, windForce) {
            // If no wind dice remain (all ignored), automatic success
            if (windDice.length === 0) {
                var hordeSum = hordeDice.reduce(function(sum, d) { return sum + d.value; }, 0);
                return {
                    success: true,
                    hordeSum: hordeSum,
                    windSum: 0,
                    greenRequired: 0,
                    greenMatched: 0,
                    greenOk: true,
                    whiteRequired: 0,
                    whiteMatched: 0,
                    whiteOk: true,
                    blackRequired: 0,
                    blackMatched: 0,
                    blackOk: true
                };
            }
            
            // 1. Separate dice by type
            var blueDice = hordeDice.filter(function(d) { return d.type === 'blue'; });
            var violetDice = hordeDice.filter(function(d) { return d.type === 'violet'; });
            
            var greenDice = windDice.filter(function(d) { return d.type === 'green'; });
            var whiteDice = windDice.filter(function(d) { return d.type === 'white'; });
            var blackDice = windDice.filter(function(d) { return d.type === 'black'; });
            var nonBlackWind = windDice.filter(function(d) { return d.type !== 'black'; });
            
            // 2. FIRST: Match violet vs black (separate channel, independent of wind force)
            var violetCounts = {};
            for (var i = 1; i <= 6; i++) violetCounts[i] = 0;
            violetDice.forEach(function(d) { violetCounts[d.value]++; });
            
            var blackValues = blackDice.map(function(d) { return d.value; });
            var blackResult = this._matchDice(blackValues, violetCounts);
            var blackOk = blackResult.matched >= blackResult.required;
            
            // 3. THEN: Match blue vs green/white
            var blueCounts = {};
            for (var i = 1; i <= 6; i++) blueCounts[i] = 0;
            blueDice.forEach(function(d) { blueCounts[d.value]++; });
            
            // Wind force cannot exceed the number of available challenge dice (green + white)
            var effectiveWindForce = Math.min(windForce, greenDice.length + whiteDice.length);
            
            // If no green dice, green matching is automatically OK
            var greenResult, greenOk;
            if (greenDice.length === 0) {
                greenResult = { required: 0, matched: 0 };
                greenOk = true;
            } else {
                var greenValues = greenDice.map(function(d) { return d.value; });
                greenResult = this._matchDice(greenValues, blueCounts);
                greenOk = greenResult.matched >= greenResult.required || greenResult.matched >= effectiveWindForce;
            }
            
            // Reduced force cannot exceed the number of white dice available
            var reducedForce = Math.max(0, effectiveWindForce - greenResult.matched);
            reducedForce = Math.min(reducedForce, whiteDice.length);
            
            // If no white dice, white matching is automatically OK
            var whiteResult, whiteOk;
            if (whiteDice.length === 0) {
                whiteResult = { required: 0, matched: reducedForce };
                whiteOk = true;
            } else {
                var whiteValues = whiteDice.map(function(d) { return d.value; });
                whiteResult = this._matchDice(whiteValues, blueCounts);
                whiteOk = whiteResult.matched >= reducedForce;
            }
            
            // 4. Sum check: blue vs non-black
            var hordeSum = blueDice.reduce(function(sum, d) { return sum + d.value; }, 0);
            var windSum = nonBlackWind.reduce(function(sum, d) { return sum + d.value; }, 0);
            
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
            var cardImageUrl = WW_State.getCardImageUrl(typeArg);
            
            var cardHtml = '<div id="' + options.prefix + '_' + cardId + '" ' +
                           'class="ww_draft_card ' + (options.extraClass || '') + '" ' +
                           'data-card-id="' + cardId + '" ' +
                           'data-type="' + displayType + '" ' +
                           'data-type-arg="' + typeArg + '" ' +
                           'style="background-image: url(\'' + cardImageUrl + '\');">' +
                           '<div class="ww_draft_card_overlay">' +
                           '<div class="ww_draft_card_name">' + (charInfo.name || 'Unknown') + '</div>' +
                           '<div class="ww_draft_card_type">' + WW_State.capitalizeFirst(displayType) + '</div>' +
                           '</div>' +
                           '</div>';
            
            WW_DOM.place(cardHtml, options.containerId);
            
            var cardEl = $(options.prefix + '_' + cardId);
            
            // Setup hover preview (1 second delay)
            WW_CardPreview.setupHover(cardEl, typeArg);
            
            if (options.onClick) {
                WW_DOM.connect(options.prefix + '_' + cardId, 'onclick', null, function(evt) {
                    WW_DOM.stopEvent(evt);
                    options.onClick(cardId, card);
                });
            }
            
            return cardEl;
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
                // Always remove pending visual classes
                WW_DOM.removeClass(cardEl, 'ww_pending_rested');
                WW_DOM.removeClass(cardEl, 'ww_pending_exhausted');
                
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
        
        // Chapter Draft Interface (like village recruitment)
        showChapterDraftInterface: function(args, onRecruitClick, onReleaseClick) {
            if (!args) return;
            
            WW_DOM.show('ww_draft_panel');
            WW_DOM.clear('ww_available_characters');
            WW_DOM.clear('ww_draft_selected');
            
            var titleEl = dojo.query('#ww_draft_panel h3')[0];
            if (titleEl) WW_DOM.setHtml(titleEl, _('Chapter ') + (args.chapter || 1) + _(' - Click pool cards to recruit, horde cards to release'));
            
            var self = this;
            var hordeCounts = args.horde_counts || {};
            var hordeRequirements = args.horde_requirements || { 'traceur': 1, 'fer': 2, 'pack': 3, 'traine': 2 };
            var hordeTotal = args.horde_total || 0;
            var hordeMax = args.horde_max || 8;
            
            // Show recruit pool (available cards)
            if (args.recruitPool) {
                var typeOrder = { 'fer': 1, 'pack': 2, 'traine': 3 };
                var sortedCards = Object.values(args.recruitPool).sort(function(a, b) {
                    var typeA = a.char_type || a.type || 'traine';
                    var typeB = b.char_type || b.type || 'traine';
                    return (typeOrder[typeA] || 4) - (typeOrder[typeB] || 4);
                });
                
                sortedCards.forEach(function(card) {
                    var cardId = card.id || card.card_id;
                    self.createCard({
                        prefix: 'chapter_draft_card',
                        card: card,
                        containerId: 'ww_available_characters',
                        extraClass: '',
                        onClick: function(cid) { onRecruitClick(cid); }
                    });
                });
            }
            
            // Show current horde (can click to release)
            if (args.horde) {
                for (var cardId in args.horde) {
                    var card = args.horde[cardId];
                    var cardType = card.char_type || card.type || '';
                    var isTraceur = cardType === 'traceur';
                    
                    this.createCard({
                        prefix: 'chapter_draft_horde',
                        card: card,
                        containerId: 'ww_draft_selected',
                        extraClass: isTraceur ? 'ww_card_disabled' : '',
                        onClick: isTraceur ? null : function(cid) { onReleaseClick(cid); }
                    });
                }
            }
            
            // Update counts display
            this.updateChapterDraftCounts(hordeCounts, hordeRequirements, hordeTotal, hordeMax);
        },
        
        hideChapterDraftInterface: function() {
            WW_DOM.hide('ww_draft_panel');
            WW_DOM.setStyle('ww_draft_selected', 'display', 'flex');
            WW_DOM.forEach('.ww_draft_requirements', function(el) {
                WW_DOM.setStyle(el, 'display', 'flex');
            });
        },
        
        updateChapterDraftCounts: function(hordeCounts, hordeRequirements, hordeTotal, hordeMax) {
            if (!hordeCounts) return;
            
            var types = ['traceur', 'fer', 'pack', 'traine'];
            for (var i = 0; i < types.length; i++) {
                var type = types[i];
                var count = hordeCounts[type] || 0;
                var max = (hordeRequirements && hordeRequirements[type]) || 3;
                
                var reqEl = $('req_' + type);
                if (reqEl) {
                    WW_DOM.show(reqEl);
                    var typeName = type.charAt(0).toUpperCase() + type.slice(1);
                    if (type === 'traine') typeName = 'Traîne';
                    
                    // Show: "Type: count/max"
                    var text = typeName + ': ' + count + '/' + max;
                    WW_DOM.setHtml(reqEl, text);
                    
                    WW_DOM.removeClass(reqEl, 'ww_complete ww_incomplete ww_warning');
                    if (count > max) {
                        WW_DOM.addClass(reqEl, 'ww_warning');  // Over limit
                    } else if (count === max) {
                        WW_DOM.addClass(reqEl, 'ww_complete');
                    } else {
                        WW_DOM.addClass(reqEl, 'ww_incomplete');
                    }
                }
            }
            
            // Show total horde count
            var totalEl = $('req_total');
            if (totalEl) {
                WW_DOM.show(totalEl);
                WW_DOM.setHtml(totalEl, _('Total: ') + hordeTotal + '/' + hordeMax);
                WW_DOM.removeClass(totalEl, 'ww_complete ww_incomplete ww_warning');
                if (hordeTotal > hordeMax) {
                    WW_DOM.addClass(totalEl, 'ww_warning');
                } else {
                    WW_DOM.addClass(totalEl, 'ww_complete');
                }
            }
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
                '<div class="ww_stat_row">' +
                    '<div class="ww_moral_container">' +
                        '<span class="ww_moral_icon"></span>' +
                        '<span id="moral_counter_' + playerId + '" class="ww_moral_value">' + player.moral + '</span>' +
                    '</div>' +
                    '<div class="ww_dice_container">' +
                        '<span class="ww_dice_icon_small"></span>' +
                        '<span id="dice_counter_' + playerId + '" class="ww_dice_value">' + 
                            (player.dice_count - player.surpass) + '</span>' +
                    '</div>' +
                '</div>' +
            '</div>';
            
            WW_DOM.place(moralHtml, panel);
            
            WW_State.setPlayerMoral(playerId, player.moral);
            WW_State.setPlayerDice(playerId, player.dice_count);
        },
        
        setupGameInfoPanel: function(gamedatas) {
            // Create game info panel in page title area or dedicated zone
            var chapter = gamedatas.current_chapter || 1;
            var chapterDay = gamedatas.chapter_round || 1;
            var totalDays = gamedatas.current_round || 1;
            
            var existingPanel = $('ww_game_info_panel');
            if (existingPanel) {
                WW_DOM.setHtml('ww_chapter_value', chapter);
                WW_DOM.setHtml('ww_chapter_day_value', chapterDay);
                WW_DOM.setHtml('ww_total_days_value', totalDays);
                return;
            }
            
            var infoHtml = '<div id="ww_game_info_panel" class="ww_game_info">' +
                '<div class="ww_chapter_info">' +
                    '<span class="ww_chapter_icon">📖</span>' +
                    '<span class="ww_chapter_label">Chapter</span>' +
                    '<span id="ww_chapter_value" class="ww_chapter_value">' + chapter + '</span>' +
                '</div>' +
                '<div class="ww_day_info">' +
                    '<span class="ww_day_icon">🌙</span>' +
                    '<span class="ww_day_label">Day</span>' +
                    '<span id="ww_chapter_day_value" class="ww_day_value">' + chapterDay + '</span>' +
                '</div>' +
                '<div class="ww_total_days_info">' +
                    '<span class="ww_total_icon">📅</span>' +
                    '<span class="ww_total_label">Total</span>' +
                    '<span id="ww_total_days_value" class="ww_total_value">' + totalDays + '</span>' +
                '</div>' +
            '</div>';
            
            // Place in right column, player boards, or page title area
            var rightCol = $('right-side-first-part');
            var playerBoards = $('player_boards');
            var pageTitle = $('page-title');
            
            if (rightCol) {
                WW_DOM.place(infoHtml, rightCol, 'first');
            } else if (playerBoards) {
                WW_DOM.place(infoHtml, playerBoards, 'before');
            } else if (pageTitle) {
                WW_DOM.place(infoHtml, pageTitle, 'after');
            } else {
                console.warn('Could not find container for game info panel');
            }
        },
        
        updateChapter: function(chapter) {
            WW_DOM.setHtml('ww_chapter_value', chapter);
        },
        
        updateDay: function(chapterDay, totalDays) {
            WW_DOM.setHtml('ww_chapter_day_value', chapterDay);
            if (totalDays) {
                WW_DOM.setHtml('ww_total_days_value', totalDays);
            }
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
            
            // Setup game info panel (chapter, day)
            WW_Player.setupGameInfoPanel(gamedatas);
            
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
                case 'chapterDraft':
                    this.enterChapterDraftState(args.args);
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
                case 'chapterDraft':
                    WW_Cards.hideChapterDraftInterface();
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
                case 'chapterDraft':
                    this.addActionButton('btn_chapter_draft_done', _('Finish Recruiting'), 'onChapterDraftDone', null, false, 'blue');
                    // Disable button if horde exceeds limits (reuse existing function)
                    if (args) {
                        var validity = WW_State.checkHordeValidity(
                            args.horde_total || 0,
                            args.horde_counts,
                            args.horde_requirements
                        );
                        if (!validity.canSkip) {
                            dojo.addClass('btn_chapter_draft_done', 'disabled');
                        }
                    }
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
                    
                    // Add Undo buttons
                    this.addActionButton('btn_undo_action', _('↩ Undo') + ' <span id="ww_pending_count"></span>', 'onUndoAction', null, false, 'gray');
                    this.addActionButton('btn_undo_all', _('↩↩ Undo All'), 'onUndoAll', null, false, 'gray');
                    
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
                    
                    // Update undo button state
                    WW_PendingActions.updateUI();
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
        
        enterChapterDraftState: function(args) {
            var self = this;
            
            // Show the draft interface for chapter recruitment (like village)
            WW_Cards.showChapterDraftInterface(args, 
                function(cardId) { self.onChapterDraftRecruit(cardId); },
                function(cardId) { self.onChapterDraftRelease(cardId); }
            );
            
            // Show message about what's available
            var chapter = args.chapter || 1;
            this.showMessage(_("Chapter ") + chapter + _(": Click pool cards to recruit, horde cards to release"), "info");
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
            
            // Enable pending actions mode with current state
            if (this.isCurrentPlayerActive() && args) {
                var initialState = {
                    moral: args.moral || 0,
                    dice: {},
                    horde: {}
                };
                
                // Capture current dice state
                if (args.horde_dice) {
                    for (var i = 0; i < args.horde_dice.length; i++) {
                        var d = args.horde_dice[i];
                        initialState.dice[d.dice_id] = { value: d.dice_value, type: d.dice_type };
                    }
                }
                
                // Capture horde state
                if (args.horde) {
                    for (var cardId in args.horde) {
                        var c = args.horde[cardId];
                        initialState.horde[cardId] = { power_used: parseInt(c.card_power_used || 0) };
                    }
                }
                
                WW_PendingActions.init(this);
                WW_PendingActions.enable(initialState);
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
        
        onChapterDraftRecruit: function(cardId) {
            if (!this.isCurrentPlayerActive()) return;
            
            this.performAction('actChapterDraftRecruit', {
                card_id: cardId
            });
        },
        
        onChapterDraftRelease: function(cardId) {
            if (!this.isCurrentPlayerActive()) return;
            
            this.performAction('actChapterDraftRelease', {
                card_id: cardId
            });
        },
        
        onChapterDraftDone: function(evt) {
            if (evt) WW_DOM.stopEvent(evt);
            if (!this.isCurrentPlayerActive()) return;
            
            this.performAction('actChapterDraftDone', {});
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
            
            var diceId = parseInt(WW_State.getFirstSelectedDice());
            var diceEl = $('dice_' + diceId);
            var currentValue = diceEl ? (parseInt(WW_DOM.getAttr(diceEl, 'data-value')) || parseInt(WW_DOM.getHtml(diceEl)) || 0) : 0;
            
            // Check computed moral from pending state
            var computedState = WW_PendingActions.getComputedState();
            var currentMoral = computedState ? computedState.moral : (this.gamedatas.players[this.player_id] || {}).moral || 0;
            
            if (currentMoral <= 1) {
                this.showMessage(_("Not enough moral"), "error");
                return;
            }
            
            if (currentValue >= 6) {
                this.showMessage(_("Die already at maximum"), "info");
                return;
            }
            
            // Add to pending actions instead of sending to server
            WW_PendingActions.push('modifyDice', {
                dice_id: diceId,
                modifier: 1
            }, {
                originalValue: currentValue
            });
            
            // Deselect dice (remove orange border)
            WW_Dice.deselectAllDice();
        },
        
        onMoralMinus: function(evt) {
            WW_DOM.stopEvent(evt);
            
            if (!WW_State.hasSelectedDice()) {
                this.showMessage(_("Please select a die first"), "error");
                return;
            }
            
            var diceId = parseInt(WW_State.getFirstSelectedDice());
            var diceEl = $('dice_' + diceId);
            var currentValue = diceEl ? (parseInt(WW_DOM.getAttr(diceEl, 'data-value')) || parseInt(WW_DOM.getHtml(diceEl)) || 0) : 0;
            
            // Check computed moral from pending state
            var computedState = WW_PendingActions.getComputedState();
            var currentMoral = computedState ? computedState.moral : (this.gamedatas.players[this.player_id] || {}).moral || 0;
            
            if (currentMoral <= 1) {
                this.showMessage(_("Not enough moral"), "error");
                return;
            }
            
            if (currentValue <= 1) {
                this.showMessage(_("Die already at minimum"), "info");
                return;
            }
            
            // Add to pending actions instead of sending to server
            WW_PendingActions.push('modifyDice', {
                dice_id: diceId,
                modifier: -1
            }, {
                originalValue: currentValue
            });
            
            // Deselect dice (remove orange border)
            WW_Dice.deselectAllDice();
        },
        
        onUndoAction: function(evt) {
            WW_DOM.stopEvent(evt);
            WW_PendingActions.undo();
        },
        
        onUndoAll: function(evt) {
            WW_DOM.stopEvent(evt);
            WW_PendingActions.undoAll();
        },
        
        onConfirmRoll: function(evt) {
            WW_DOM.stopEvent(evt);
            
            // If pending actions exist, send them with andConfirm=1
            if (WW_PendingActions.hasPending()) {
                var self = this;
                var actions = WW_PendingActions.getActions();
                
                // Send batch actions with confirm flag - single request
                // Use 1 instead of true for BGA compatibility
                this.bgaPerformAction('actBatchActions', {
                    actions: JSON.stringify(actions),
                    andConfirm: 1
                }).then(function() {
                    WW_PendingActions.clear();
                }).catch(function() {
                    WW_PendingActions.undoAll();
                });
            } else {
                this.performAction('actConfirmRoll', {});
            }
        },
        
        onRest: function(evt) {
            WW_DOM.stopEvent(evt);
            this.performAction('actRest', {});
        },
        
        onUsePower: function(cardId) {
            var self = this;
            
            // If we're in power target mode, this click is selecting a target
            if (WW_State.isInPowerTargetMode()) {
                var mode = WW_State.getPowerTargetMode();
                if (mode.callback) {
                    mode.callback(cardId);
                }
                return;
            }
            
            // Check if card already has pending exhaustion
            var computedState = WW_PendingActions.getComputedState();
            if (computedState && computedState.horde && computedState.horde[cardId] && computedState.horde[cardId].power_used) {
                this.showMessage(_("Power already used"), "info");
                return;
            }
            
            // Get character info to check power type
            var hordeCard = WW_State.getHordeCard(cardId);
            var typeArg = hordeCard ? hordeCard.type : null;
            var charInfo = typeArg ? WW_State.getCharacter(typeArg) : null;
            var powerCode = charInfo ? charInfo.power_code : null;
            
            // Check if this power requires a target
            if (this.powerRequiresTarget(powerCode)) {
                this.enterPowerTargetMode(cardId, powerCode);
                return;
            }
            
            // No target needed, add to pending actions directly
            WW_PendingActions.push('usePower', {
                card_id: parseInt(cardId)
            }, {});
        },
        
        /**
         * Check if a power requires selecting a target
         */
        powerRequiresTarget: function(powerCode) {
            var targetPowers = ['vera_power', 'uther_power'];  // Powers that need a target
            return targetPowers.indexOf(powerCode) !== -1;
        },
        
        /**
         * Enter power target selection mode
         */
        enterPowerTargetMode: function(sourceCardId, powerCode) {
            var self = this;
            
            // Store the mode
            WW_State.setPowerTargetMode({
                card_id: sourceCardId,
                power_code: powerCode,
                callback: function(targetCardId) {
                    self.completePowerWithTarget(sourceCardId, powerCode, targetCardId);
                }
            });
            
            // Highlight valid targets based on power type
            this.highlightPowerTargets(sourceCardId, powerCode);
            
            // Show message
            var message = this.getPowerTargetMessage(powerCode);
            this.showMessage(message, "info");
            
            // Add cancel button
            this.addActionButton('btn_cancel_power', _('Cancel'), function() {
                self.cancelPowerTargetMode();
            }, null, false, 'gray');
        },
        
        /**
         * Get message for power target selection
         */
        getPowerTargetMessage: function(powerCode) {
            switch (powerCode) {
                case 'vera_power':
                    return _("Select an exhausted Hordier to rest");
                case 'uther_power':
                    return _("Select a Hordier to sacrifice (-3 per missing Hordier)");
                default:
                    return _("Select a target");
            }
        },
        
        /**
         * Highlight valid targets for a power
         */
        highlightPowerTargets: function(sourceCardId, powerCode) {
            var computedState = WW_PendingActions.getComputedState();
            
            // Remove all current highlights
            WW_DOM.removeClassFromAll('.ww_horde_card_item', 'ww_power_target');
            WW_DOM.removeClassFromAll('.ww_horde_card_item', 'ww_power_source');
            
            // Mark source
            WW_DOM.addClass('ww_horde_item_' + sourceCardId, 'ww_power_source');
            
            switch (powerCode) {
                case 'vera_power':
                    // Vera can target exhausted Hordiers (not herself)
                    for (var cardId in WW_State.getHordeCards()) {
                        if (cardId == sourceCardId) continue;  // Can't target herself
                        
                        var card = WW_State.getHordeCard(cardId);
                        var isExhausted = card && card.powerUsed;
                        
                        // Check pending state too
                        if (computedState && computedState.horde && computedState.horde[cardId]) {
                            isExhausted = computedState.horde[cardId].power_used;
                        }
                        
                        if (isExhausted) {
                            WW_DOM.addClass('ww_horde_item_' + cardId, 'ww_power_target');
                        }
                    }
                    break;
                    
                case 'uther_power':
                    // Uther can sacrifice any other Hordier
                    for (var cardId in WW_State.getHordeCards()) {
                        if (cardId == sourceCardId) continue;  // Can't sacrifice himself
                        WW_DOM.addClass('ww_horde_item_' + cardId, 'ww_power_target');
                    }
                    break;
            }
        },
        
        /**
         * Complete a power that required a target
         */
        completePowerWithTarget: function(sourceCardId, powerCode, targetCardId) {
            // Validate target based on power type
            if (!this.validatePowerTarget(sourceCardId, powerCode, targetCardId)) {
                return;
            }
            
            // Special handling for Uther: need to select dice to ignore
            if (powerCode === 'uther_power') {
                this.enterUtherDiceSelectionMode(sourceCardId, targetCardId);
                return;
            }
            
            // Add to pending actions with target
            WW_PendingActions.push('usePower', {
                card_id: parseInt(sourceCardId),
                target_card_id: parseInt(targetCardId)
            }, {
                target_card_id: parseInt(targetCardId)
            });
            
            // Exit target mode
            this.cancelPowerTargetMode();
        },
        
        /**
         * Enter Uther's dice selection mode after sacrificing a hordier
         */
        enterUtherDiceSelectionMode: function(sourceCardId, targetCardId) {
            var self = this;
            
            // Calculate how many dice can be ignored (3 per missing hordier after sacrifice)
            var hordeCards = WW_State.getHordeCards();
            var hordeCount = Object.keys(hordeCards).length - 1; // -1 for the sacrifice
            var missingCount = 8 - hordeCount;
            var maxIgnore = 3 * missingCount;
            
            // Store state for dice selection
            WW_State.setUtherDiceMode({
                source_card_id: sourceCardId,
                target_card_id: targetCardId,
                max_ignore: maxIgnore,
                selected_dice: []
            });
            
            // Cancel power target mode visuals
            this.cancelPowerTargetMode();
            
            // Show pending sacrifice visual
            var targetEl = $('ww_horde_item_' + targetCardId);
            if (targetEl) {
                WW_DOM.addClass(targetEl, 'ww_pending_discarded');
            }
            var sourceEl = $('ww_horde_item_' + sourceCardId);
            if (sourceEl) {
                WW_DOM.addClass(sourceEl, 'ww_pending_exhausted');
            }
            
            // Make challenge dice clickable
            this.makeChallengeDiceSelectable();
            
            // Show message
            this.showMessage(dojo.string.substitute(_("Select up to ${max} challenge dice to ignore"), {max: maxIgnore}), "info");
            
            // Update action buttons
            this.removeActionButtons();
            this.addActionButton('btn_confirm_uther', _('Confirm Ignored Dice'), function() {
                self.confirmUtherPower();
            }, null, false, 'blue');
            this.addActionButton('btn_cancel_uther', _('Cancel'), function() {
                self.cancelUtherDiceMode();
            }, null, false, 'gray');
        },
        
        /**
         * Make challenge dice selectable for Uther's power
         */
        makeChallengeDiceSelectable: function() {
            var self = this;
            dojo.query('#ww_wind_dice .ww_dice').forEach(function(diceEl) {
                WW_DOM.addClass(diceEl, 'ww_dice_selectable');
                WW_DOM.connect(diceEl, 'onclick', null, function(evt) {
                    WW_DOM.stopEvent(evt);
                    self.onChallengeDiceClick(diceEl.id.replace('dice_', ''));
                });
            });
        },
        
        /**
         * Handle click on challenge dice during Uther's power
         */
        onChallengeDiceClick: function(diceId) {
            var mode = WW_State.getUtherDiceMode();
            if (!mode) return;
            
            var diceEl = $('dice_' + diceId);
            if (!diceEl) return;
            
            var index = mode.selected_dice.indexOf(diceId);
            if (index >= 0) {
                // Deselect
                mode.selected_dice.splice(index, 1);
                WW_DOM.removeClass(diceEl, 'ww_dice_ignored');
            } else {
                // Select if under limit
                if (mode.selected_dice.length < mode.max_ignore) {
                    mode.selected_dice.push(diceId);
                    WW_DOM.addClass(diceEl, 'ww_dice_ignored');
                } else {
                    this.showMessage(dojo.string.substitute(_("You can only ignore ${max} dice"), {max: mode.max_ignore}), "error");
                }
            }
            
            // Update button text
            var btn = $('btn_confirm_uther');
            if (btn) {
                btn.innerHTML = dojo.string.substitute(_("Confirm (${count}/${max} dice)"), {
                    count: mode.selected_dice.length,
                    max: mode.max_ignore
                });
            }
        },
        
        /**
         * Confirm Uther's power with selected dice
         */
        confirmUtherPower: function() {
            var mode = WW_State.getUtherDiceMode();
            if (!mode) return;
            
            // Add to pending actions
            WW_PendingActions.push('usePower', {
                card_id: parseInt(mode.source_card_id),
                target_card_id: parseInt(mode.target_card_id),
                ignored_dice: mode.selected_dice
            }, {
                target_card_id: parseInt(mode.target_card_id),
                ignored_dice: mode.selected_dice
            });
            
            // Clean up
            this.cleanUpUtherDiceMode();
            
            // Restore normal action buttons
            this.restoreConfrontationButtons();
        },
        
        /**
         * Cancel Uther's dice selection mode
         */
        cancelUtherDiceMode: function() {
            var mode = WW_State.getUtherDiceMode();
            if (!mode) return;
            
            // Remove pending visuals
            var targetEl = $('ww_horde_item_' + mode.target_card_id);
            if (targetEl) {
                WW_DOM.removeClass(targetEl, 'ww_pending_discarded');
            }
            var sourceEl = $('ww_horde_item_' + mode.source_card_id);
            if (sourceEl) {
                WW_DOM.removeClass(sourceEl, 'ww_pending_exhausted');
            }
            
            // Clean up
            this.cleanUpUtherDiceMode();
            
            // Restore normal action buttons
            this.restoreConfrontationButtons();
        },
        
        /**
         * Clean up Uther dice selection mode
         */
        cleanUpUtherDiceMode: function() {
            // Remove dice selection styling
            dojo.query('#ww_wind_dice .ww_dice').forEach(function(diceEl) {
                WW_DOM.removeClass(diceEl, 'ww_dice_selectable');
                WW_DOM.disconnect(diceEl, 'onclick');
            });
            
            // Clear state
            WW_State.clearUtherDiceMode();
        },
        
        /**
         * Restore confrontation action buttons
         */
        restoreConfrontationButtons: function() {
            var self = this;
            this.removeActionButtons();
            
            // Re-add standard confrontation buttons
            if (WW_PendingActions.hasPending()) {
                this.addActionButton('btn_undo_action', _('Undo'), function() {
                    WW_PendingActions.pop();
                }, null, false, 'gray');
            }
            
            // Determine button color based on confrontation result
            var hordeDice = WW_Dice.getHordeDice();
            var windDice = WW_Dice.getWindDice();
            var windForce = parseInt(WW_DOM.getHtml('ww_wind_force')) || 0;
            var buttonColor = 'blue';
            if (hordeDice.length > 0 && windDice.length > 0) {
                var result = WW_Dice.calculateConfrontationResult(hordeDice, windDice, windForce);
                buttonColor = (result && result.success) ? 'blue' : 'red';
            }
            
            this.addActionButton('btn_confirm_roll', _('Confirm'), 'onConfirmRoll', null, false, buttonColor);
            
            // Update undo button state
            WW_PendingActions.updateUI();
        },
        
        /**
         * Validate power target selection
         */
        validatePowerTarget: function(sourceCardId, powerCode, targetCardId) {
            var computedState = WW_PendingActions.getComputedState();
            
            switch (powerCode) {
                case 'vera_power':
                    if (targetCardId == sourceCardId) {
                        this.showMessage(_("Vera cannot rest herself"), "error");
                        return false;
                    }
                    
                    var card = WW_State.getHordeCard(targetCardId);
                    var isExhausted = card && card.powerUsed;
                    
                    // Check pending state
                    if (computedState && computedState.horde && computedState.horde[targetCardId]) {
                        isExhausted = computedState.horde[targetCardId].power_used;
                    }
                    
                    if (!isExhausted) {
                        this.showMessage(_("This Hordier is not exhausted"), "error");
                        return false;
                    }
                    return true;
                    
                case 'uther_power':
                    if (targetCardId == sourceCardId) {
                        this.showMessage(_("Uther cannot sacrifice himself"), "error");
                        return false;
                    }
                    return true;
                    
                default:
                    return true;
            }
        },
        
        /**
         * Cancel power target selection mode
         */
        cancelPowerTargetMode: function() {
            WW_State.clearPowerTargetMode();
            
            // Remove highlights
            WW_DOM.removeClassFromAll('.ww_horde_card_item', 'ww_power_target');
            WW_DOM.removeClassFromAll('.ww_horde_card_item', 'ww_power_source');
            
            // Remove cancel button
            var cancelBtn = $('btn_cancel_power');
            if (cancelBtn) {
                WW_DOM.destroy(cancelBtn);
            }
            
            this.showMessage("", "info");  // Clear message
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
            
            dojo.subscribe('batchActionsApplied', this, "notif_batchActionsApplied");
            this.notifqueue.setSynchronous('batchActionsApplied', 300);
            
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
            
            dojo.subscribe('challengeDiceModified', this, "notif_challengeDiceModified");
            this.notifqueue.setSynchronous('challengeDiceModified', 500);
            
            dojo.subscribe('diceIgnored', this, "notif_diceIgnored");
            this.notifqueue.setSynchronous('diceIgnored', 500);
            
            dojo.subscribe('chapterDraftRecruit', this, "notif_chapterDraftRecruit");
            this.notifqueue.setSynchronous('chapterDraftRecruit', 500);
            
            dojo.subscribe('chapterDraftComplete', this, "notif_chapterDraftComplete");
            this.notifqueue.setSynchronous('chapterDraftComplete', 500);
            
            dojo.subscribe('newDay', this, "notif_newDay");
            this.notifqueue.setSynchronous('newDay', 300);
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
        
        notif_batchActionsApplied: function(notif) {
            // Clear pending visual states - server has confirmed the actions
            dojo.query('.ww_pending_modified').forEach(function(el) {
                WW_DOM.removeClass(el, 'ww_pending_modified');
            });
            dojo.query('.ww_pending_exhausted').forEach(function(el) {
                WW_DOM.removeClass(el, 'ww_pending_exhausted');
                WW_DOM.addClass(el, 'ww_card_exhausted');
            });
            dojo.query('.ww_pending_changed').forEach(function(el) {
                WW_DOM.removeClass(el, 'ww_pending_changed');
            });
            
            // Update dice display with server-confirmed values
            if (notif.args.updated_dice) {
                for (var i = 0; i < notif.args.updated_dice.length; i++) {
                    var dice = notif.args.updated_dice[i];
                    var diceEl = $('dice_' + dice.dice_id);
                    if (diceEl) {
                        WW_DOM.setHtml(diceEl, dice.dice_value);
                    }
                }
            }
            
            // Update moral display
            if (notif.args.new_moral !== undefined) {
                WW_Player.updateMoral(notif.args.player_id, notif.args.new_moral);
            }
            
            // Disable pending mode
            WW_PendingActions.disable();
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
        
        notif_chapterDraftRecruit: function(notif) {
            // Remove the drafted card from available pool
            var cardEl = $('chapter_draft_card_' + notif.args.card_id);
            if (cardEl) {
                WW_DOM.destroy(cardEl);
            }
            
            // If current player, add to selected section
            if (notif.args.player_id == this.player_id && notif.args.card) {
                WW_Cards.createCard({
                    prefix: 'chapter_draft_card',
                    card: notif.args.card,
                    containerId: 'ww_draft_selected',
                    extraClass: 'ww_selected'
                });
            }
        },
        
        notif_chapterDraftComplete: function(notif) {
            // If current player, add drafted cards to horde
            if (notif.args.player_id == this.player_id && notif.args.cards) {
                for (var cardId in notif.args.cards) {
                    WW_Cards.addHordeCard(notif.args.cards[cardId]);
                }
            }
            // Hide the draft panel
            WW_Cards.hideChapterDraftInterface();
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
            
            // Update chapter number in state and UI
            WW_State.chapter = notif.args.chapter_num;
            WW_Player.updateChapter(notif.args.chapter_num);
            WW_Player.updateDay(1, null);  // Reset chapter day to 1 (keep total unchanged)
        },
        
        notif_newDay: function(notif) {
            WW_Player.updateDay(notif.args.chapter_day, notif.args.total_days);
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
        
        notif_challengeDiceModified: function(notif) {
            // Clear and recreate wind dice with new values after Uther's sacrifice
            WW_Dice.clearDice('wind');
            
            var updatedDice = notif.args.updated_dice || [];
            WW_Dice.createDiceSorted(updatedDice, 'ww_wind_dice');
            
            // Flash animation on all wind dice to show the change
            dojo.query('#ww_wind_dice .ww_dice').forEach(function(diceEl) {
                WW_DOM.addClass(diceEl, 'ww_dice_modified');
                setTimeout(function() {
                    WW_DOM.removeClass(diceEl, 'ww_dice_modified');
                }, 500);
            });
            
            WW_Dice.updateConfrontationPreview();
        },
        
        notif_diceIgnored: function(notif) {
            // Mark ignored dice visually
            var ignoredDice = notif.args.ignored_dice || [];
            for (var i = 0; i < ignoredDice.length; i++) {
                var diceEl = $('dice_' + ignoredDice[i]);
                if (diceEl) {
                    WW_DOM.addClass(diceEl, 'ww_dice_ignored');
                }
            }
            WW_Dice.updateConfrontationPreview();
        },
        
        notif_powerUsed: function(notif) {
            WW_Cards.setCardRested(notif.args.card_id, false);
        }
   });
});
