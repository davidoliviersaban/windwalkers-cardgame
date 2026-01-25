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
    // WW_Utils - Common utilities and shared patterns
    // ============================================================
    var WW_Utils = {
        /**
         * Resolves pending actions if any, then executes callback
         * Handles the common pattern: check pending -> commit/send -> execute
         * @param {object} gameInstance - The game instance (this)
         * @param {function} callback - Function to execute after pending actions resolved
         * @param {boolean} commitOnly - If true, commit but don't clear (for discard powers)
         */
        resolvePendingActions: function(gameInstance, callback, commitOnly) {
            if (WW_PendingActions.isActive() && WW_PendingActions.hasPending()) {
                var actions = WW_PendingActions.getActions();
                var result = gameInstance.bgaPerformAction('actBatchActions', {
                    actions: JSON.stringify(actions),
                    andConfirm: 0
                });
                if (result && result.then) {
                    result.then(function() {
                        if (commitOnly) {
                            WW_PendingActions.commit();
                        } else {
                            WW_PendingActions.clear();
                        }
                        callback();
                    }).catch(function() {
                        WW_PendingActions.undoAll();
                    });
                } else {
                    if (commitOnly) {
                        WW_PendingActions.commit();
                    } else {
                        WW_PendingActions.clear();
                    }
                    callback();
                }
            } else {
                if (commitOnly) {
                    WW_PendingActions.commit();
                }
                callback();
            }
        },
        
        /**
         * Update card power state in WW_State and WW_PendingActions
         * Uses single canonical property: card_power_used (integer 0/1)
         * @param {string|number} cardId - Card ID
         * @param {boolean} isExhausted - true = exhausted/used, false = rested
         */
        updateCardPowerState: function(cardId, isExhausted) {
            var val = isExhausted ? 1 : 0;
            
            // Update WW_State (single property)
            var card = WW_State.getHordeCard(cardId);
            if (card) {
                card.card_power_used = val;
            }
            
            // Update WW_PendingActions.originalState (single property)
            if (WW_PendingActions.isActive() && 
                WW_PendingActions.originalState && WW_PendingActions.originalState.horde) {
                var hordeState = WW_PendingActions.originalState.horde[cardId];
                if (hordeState) {
                    hordeState.card_power_used = val;
                }
            }
        },
        
        /**
         * Check if a card is exhausted, considering pending state and CSS
         * Consolidates the repeated validation pattern
         * @param {string|number} cardId - Card ID
         * @param {object} card - Card data object (optional)
         * @return {boolean} true if exhausted
         */
        isCardExhausted: function(cardId, card) {
            var isExhausted = card && card.card_power_used == 1;
            
            // Check pending state
            var computedState = WW_PendingActions.getComputedState();
            if (computedState && computedState.horde && computedState.horde[cardId]) {
                isExhausted = computedState.horde[cardId].card_power_used == 1;
            }
            
            // CSS fallback for visual consistency
            var cardEl = $('ww_horde_item_' + cardId);
            if (cardEl) {
                if (WW_DOM.hasClass(cardEl, 'ww_pending_rested')) {
                    isExhausted = false;
                } else if (WW_DOM.hasClass(cardEl, 'ww_card_exhausted') || WW_DOM.hasClass(cardEl, 'ww_pending_exhausted')) {
                    isExhausted = true;
                }
            }
            
            return isExhausted;
        },
        
        /**
         * Queue or execute a power action based on pending mode
         * @param {object} gameInstance - The game instance
         * @param {number} cardId - Source card ID
         * @param {object} params - Power parameters
         * @param {object} visualEffect - Visual effect data for pending
         */
        executePower: function(gameInstance, cardId, params, visualEffect) {
            var inPendingMode = WW_PendingActions.isActive();
            
            if (inPendingMode) {
                WW_PendingActions.push('usePower', {
                    card_id: parseInt(cardId),
                    params: JSON.stringify(params || {})
                }, visualEffect || {});
            } else {
                gameInstance.performAction('actUsePower', {
                    card_id: parseInt(cardId),
                    params: JSON.stringify(params || {})
                });
            }
        },
        
        /**
         * Setup dice result buttons (single entry point for all dice result button logic)
         * Called by onUpdateActionButtons and updateDiceResultButtons
         * @param {object} gameInstance - The game instance
         * @param {boolean} clearFirst - Whether to clear existing buttons first
         * @returns {boolean} - false if buttons should not be shown (power mode, etc.)
         */
        setupDiceResultButtons: function(gameInstance, clearFirst) {
            // Skip if in special power mode or power target mode
            if (WW_State.getSpecialPowerMode() || WW_State.isInPowerTargetMode()) {
                return false;
            }
            
            // Get wind dice that are NOT ignored
            var windDice = WW_Dice.getWindDice();
            
            // Clear existing buttons if requested
            if (clearFirst) {
                gameInstance.removeActionButtons();
            }
            
            // If no challenge dice (e.g., moving to a city), just show Confirm button
            if (windDice.length === 0) {
                if (!$('btn_confirm_roll')) {
                    gameInstance.addActionButton('btn_confirm_roll', _('Confirm'), 'onConfirmRoll', null, false, 'blue');
                }
                return true;
            }
            
            // Full confrontation buttons
            this.addConfrontationButtons(gameInstance, windDice);
            return true;
        },
        
        /**
         * Add standard confrontation action buttons (moral+/-, undo, confirm)
         * @param {object} gameInstance - The game instance
         * @param {array} windDice - Active wind dice
         */
        addConfrontationButtons: function(gameInstance, windDice) {
            gameInstance.addActionButton('btn_moral_plus', _('+1 (spend moral)'), 'onMoralPlus');
            gameInstance.addActionButton('btn_moral_minus', _('-1 (spend moral)'), 'onMoralMinus');
            
            // Add Undo buttons
            gameInstance.addActionButton('btn_undo_action', _('↩ Undo') + ' <span id="ww_pending_count"></span>', 'onUndoAction', null, false, 'gray');
            gameInstance.addActionButton('btn_undo_all', _('↩↩ Undo All'), 'onUndoAll', null, false, 'gray');
            
            // Check confrontation result to set button color
            var hordeDice = WW_Dice.getHordeDice();
            var windForce = parseInt(WW_DOM.getHtml('ww_wind_force')) || 0;
            var buttonColor = 'blue';
            if (hordeDice.length > 0) {
                var result = WW_Dice.calculateConfrontationResult(hordeDice, windDice, windForce);
                buttonColor = (result && result.success) ? 'blue' : 'red';
            }
            // Remove existing confirm button if present to avoid duplicates
            if ($('btn_confirm_roll')) {
                dojo.destroy('btn_confirm_roll');
            }
            gameInstance.addActionButton('btn_confirm_roll', _('Confirm'), 'onConfirmRoll', null, false, buttonColor);
            
            // Update undo button state
            WW_PendingActions.updateUI();
        },
        
        // ============================================================
        // Action Bar Management - Wrapper to avoid BGA's button clearing
        // ============================================================
        
        /**
         * Update page title directly without triggering BGA's onUpdateActionButtons
         * BGA's updatePageTitle() clears all action buttons before calling onUpdateActionButtons
         * This function updates the DOM directly to avoid that side effect
         * @param {string} title - New title text (can include HTML)
         */
        setPageTitle: function(title) {
            var titleEl = $('pagemaintitletext');
            if (titleEl) {
                titleEl.innerHTML = title;
            }
        },
        
        /**
         * Add an action button to the action bar
         * Wrapper around BGA's addActionButton with safety checks
         * @param {object} gameInstance - The game instance
         * @param {string} id - Button ID
         * @param {string} label - Button label
         * @param {string|function} callback - Callback function name or function
         * @param {string} color - Button color ('blue', 'red', 'gray', etc.)
         * @returns {Element} The button element
         */
        addActionButton: function(gameInstance, id, label, callback, color) {
            // Remove existing button with same ID to avoid duplicates
            if ($(id)) {
                dojo.destroy(id);
            }
            gameInstance.addActionButton(id, label, callback, null, false, color || 'blue');
            return $(id);
        },
        
        /**
         * Remove an action button by ID
         * @param {string} id - Button ID
         */
        removeActionButton: function(id) {
            if ($(id)) {
                dojo.destroy(id);
            }
        },
        
        /**
         * Clear all action buttons
         * @param {object} gameInstance - The game instance
         */
        clearActionButtons: function(gameInstance) {
            gameInstance.removeActionButtons();
        },
        
        /**
         * Update action bar with title and buttons in one call
         * Avoids BGA's problematic updatePageTitle behavior
         * @param {object} gameInstance - The game instance
         * @param {object} config - Configuration object
         * @param {string} config.title - Page title (optional)
         * @param {boolean} config.clearButtons - Whether to clear existing buttons first (default: false)
         * @param {array} config.buttons - Array of button configs: [{id, label, callback, color}]
         */
        updateActionBar: function(gameInstance, config) {
            config = config || {};
            
            // Update title if provided (directly, no BGA method)
            if (config.title !== undefined) {
                this.setPageTitle(config.title);
            }
            
            // Clear buttons if requested
            if (config.clearButtons) {
                gameInstance.removeActionButtons();
            }
            
            // Add buttons
            if (config.buttons && config.buttons.length > 0) {
                var self = this;
                config.buttons.forEach(function(btn) {
                    self.addActionButton(gameInstance, btn.id, btn.label, btn.callback, btn.color);
                });
            }
        }
    };
    
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
    // Constants
    var WW_CONST = {
        // Game limits
        MAX_HORDE_SIZE: 8,
        MAX_MORAL: 9,
        
        // Dice constraints
        MIN_DICE_VALUE: 1,
        MAX_DICE_VALUE: 6,
        DEFAULT_DICE_COUNT: 6,
        
        // Moral bonuses (card powers)
        DRAGON_MORAL_BONUS: 3
    };
    // Convenience aliases
    var MAX_MORAL = WW_CONST.MAX_MORAL;
    var DRAGON_MORAL_INCREASE = WW_CONST.DRAGON_MORAL_BONUS;
    var MIN_DICE = WW_CONST.MIN_DICE_VALUE;
    var MAX_DICE = WW_CONST.MAX_DICE_VALUE;
    var DEFAULT_DICE_COUNT = WW_CONST.DEFAULT_DICE_COUNT;
    
    // Phase labels (state name -> display text)
    var WW_PHASES = {
        'gameSetup': 'Setup',
        'draftHorde': 'Horde Draft',
        'nextDraft': 'Next Draft',
        'chapterDraft': 'Chapter Recruitment',
        'nextChapterDraft': 'Next Recruitment',
        'playerTurn': 'Player Turn',
        'revealWind': 'Wind Reveal',
        'confrontation': 'Confrontation',
        'diceResult': 'Dice Result',
        'resolveConfrontation': 'Resolution',
        'loseHordier': 'Lose Hordier',
        'playerElimination': 'Elimination',
        'recruitment': 'Recruitment',
        'mustReleaseHordier': 'Must Release',
        'chooseHordierToRest': 'Rest Hordier',
        'applyTileEffect': 'Tile Effect',
        'rest': 'Rest',
        'nextPlayer': 'Next Player',
        'setupNextChapter': 'New Chapter',
        'endChapter': 'Chapter End',
        'endRound': 'Round End',
        'finalScoring': 'Final Scoring',
        'gameEnd': 'Game Over'
    };
    
    var WW_State = {
        // Private state
        _data: {
            characters: {},
            playerMoral: {},
            playerDice: {},
            playerMaxDice: {},
            selectedTile: null,
            selectedDice: [],
            hordeCards: {},
            currentState: null,
            powerTargetMode: null,  // { card_id, power_code, callback }
            utherDiceMode: null,    // { source_card_id, target_card_id, max_ignore, selected_dice }
            specialPowerMode: null, // { card_id, power_code, ... specific data }
            windForce: 0,
            protectedCards: []  // Cards that cannot be rested (e.g., Régitha after using power)
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
        
        // Special power mode (Gianni, Wanda, Thomassin, Blanchette)
        setSpecialPowerMode: function(mode) {
            this._data.specialPowerMode = mode;
        },
        
        getSpecialPowerMode: function() {
            return this._data.specialPowerMode;
        },
        
        clearSpecialPowerMode: function() {
            this._data.specialPowerMode = null;
        },
        
        // Wind force tracking
        setWindForce: function(force) {
            this._data.windForce = force || 0;
        },
        
        // Protected cards tracking (cards that cannot be rested)
        setProtectedCards: function(cards) {
            this._data.protectedCards = (cards || []).map(function(id) { return parseInt(id); });
        },
        
        addProtectedCard: function(cardId) {
            var id = parseInt(cardId);
            if (this._data.protectedCards.indexOf(id) === -1) {
                this._data.protectedCards.push(id);
            }
        },
        
        getProtectedCards: function() {
            return this._data.protectedCards;
        },
        
        clearProtectedCards: function() {
            this._data.protectedCards = [];
        },
        
        getWindForce: function() {
            return this._data.windForce || 0;
        },
        
        // Player data
        setPlayerMoral: function(playerId, moral) {
            this._data.playerMoral[playerId] = moral;
        },
        
        getPlayerMoral: function(playerId) {
            // Return value if set, undefined if not (so caller can distinguish from 0 moral)
            if (playerId in this._data.playerMoral) {
                return this._data.playerMoral[playerId];
            }
            return undefined;
        },
        
        setPlayerDice: function(playerId, count) {
            this._data.playerDice[playerId] = count;
        },
        
        getPlayerDice: function(playerId) {
            return this._data.playerDice[playerId] || 0;
        },
        
        setPlayerMaxDice: function(playerId, count) {
            this._data.playerMaxDice[playerId] = count;
        },
        
        getPlayerMaxDice: function(playerId) {
            return this._data.playerMaxDice[playerId] || DEFAULT_DICE_COUNT;
        },
        
        // Selection
        setSelectedTile: function(tile) {
            // Can be just an ID or the full tile object
            this._data.selectedTile = tile;
        },
        
        getSelectedTile: function() {
            return this._data.selectedTile;
        },
        
        // Get tile moral effect (from stored tile object)
        getSelectedTileMoralEffect: function() {
            var tile = this._data.selectedTile;
            if (!tile || typeof tile !== 'object') return 0;
            // argConfrontation uses SELECT * so raw column name is tile_moral_effect
            return parseInt(tile.tile_moral_effect) || 0;
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
        
        /**
         * Get the current horde count
         * @return {number} Number of hordiers in the horde (0 to 8)
         */
        getHordeCount: function() {
            return Object.keys(this._data.hordeCards || {}).length;
        },
        
        /**
         * Get the number of missing hordiers
         * Max horde size is 8, so missing = 8 - current horde count
         * @param {number} adjustment Optional adjustment (e.g., -1 if a hordier is about to be sacrificed)
         * @return {number} Number of missing hordiers (0 to 8)
         */
        getMissingHordiersCount: function(adjustment) {
            var hordeCount = this.getHordeCount() + (adjustment || 0);
            return Math.max(0, WW_CONST.MAX_HORDE_SIZE - hordeCount);
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
            
            // Get character name (remove spaces and special characters)
            var charName = (charInfo.name || 'Unknown').replace(/[^a-zA-Z0-9À-ÿ]/g, '');
            
            // Get tier
            var tier = charInfo.tier || 2;
            
            // Index is charId - 1 (0-based)
            var index = String(parseInt(charId) - 1).padStart(2, '0');
            
            return basePath + paddedId + '.' + typeName + '.' + charName + '.T' + tier + '.' + index + '.png';
        }
    };
    
    // ============================================================
    // WW_CardPreview - Card preview on magnifying glass click
    // ============================================================
    var WW_CardPreview = {
        previewVisible: false,
        
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
        
        // Add magnifying glass icon to card for zooming
        setupZoom: function(cardEl, typeArg) {
            var self = this;
            var cardId = cardEl.id;
            
            // Add magnifying glass icon
            var zoomIcon = document.createElement('div');
            zoomIcon.className = 'ww_card_zoom_icon';
            zoomIcon.innerHTML = '🔍';
            cardEl.appendChild(zoomIcon);
            
            // Click on magnifying glass to show preview
            dojo.connect(zoomIcon, 'onclick', function(evt) {
                WW_DOM.stopEvent(evt);
                self.show(typeArg);
            });
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
        pendingMoralSpent: 0,  // Track total moral spent on dice modifications
        pendingMoralGain: 0,   // Track total moral gain from card powers (Dragon etc.)
        
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
            this.pendingMoralSpent = 0;
            this.pendingMoralGain = 0;
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
         * Safe check if pending mode is active (avoids undefined checks)
         * Use this instead of: WW_PendingActions.isActive()
         */
        isActive: function() {
            return this.enabled === true;
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
            this.pendingMoralSpent = 0;
            this.pendingMoralGain = 0;
            this.updateUI();
        },
        
        /**
         * Commit current actions - prevents undo but keeps system active for new actions
         * Used after discard powers (Duke, Jonas) that can't be undone
         */
        commit: function() {
            if (!this.enabled) return;
            
            // Update originalState to computed state (incorporates all pending actions)
            this.originalState = this.getComputedState();
            // Clear the actions queue - nothing to undo
            this.actions = [];
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
         * Remove pending actions that target a specific card
         * Used when a card executes its power immediately (invalidates pending "rest" actions)
         */
        removeActionsTargeting: function(cardId) {
            var cardIdNum = parseInt(cardId);
            this.actions = this.actions.filter(function(a) {
                return !(a.params && parseInt(a.params.target_card_id) === cardIdNum);
            });
            this.updateUI();
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
            
            // Include pending moral gains from powers (Dragon, Saskia, etc.)
            if (state.moral !== undefined) {
                state.moral = Math.min(MAX_MORAL, state.moral + this.pendingMoralGain);
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
                        state.dice[action.params.dice_id].value = Math.max(MIN_DICE, Math.min(MAX_DICE, state.dice[action.params.dice_id].value));
                    }
                    if (state.moral !== undefined) {
                        state.moral -= 1;
                    }
                    break;
                    
                case 'usePower':
                    if (state.horde && state.horde[action.params.card_id]) {
                        state.horde[action.params.card_id].card_power_used = 1;
                    }
                    // Handle powers that affect other cards (like Vera resting a target)
                    if (action.params.target_card_id && state.horde && state.horde[action.params.target_card_id]) {
                        state.horde[action.params.target_card_id].card_power_used = 0;  // Target is rested
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
                            var newValue = Math.max(MIN_DICE, Math.min(MAX_DICE, currentValue + action.params.modifier));
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
                    // Handle Gianni power: set dice to specific value
                    if (visual.dice_id !== undefined && visual.dice_value !== undefined) {
                        var diceEl = $('dice_' + visual.dice_id);
                        if (diceEl) {
                            if (apply) {
                                // Store original value for undo
                                if (!visual.originalValue) {
                                    visual.originalValue = parseInt(WW_DOM.getAttr(diceEl, 'data-value')) || parseInt(WW_DOM.getHtml(diceEl)) || 1;
                                }
                                WW_DOM.setHtml(diceEl, visual.dice_value);
                                WW_DOM.setAttr(diceEl, 'data-value', visual.dice_value);
                                WW_DOM.addClass(diceEl, 'ww_pending_modified');
                            } else {
                                // Revert to original value
                                var revertValue = visual.originalValue || 1;
                                WW_DOM.setHtml(diceEl, revertValue);
                                WW_DOM.setAttr(diceEl, 'data-value', revertValue);
                                WW_DOM.removeClass(diceEl, 'ww_pending_modified');
                            }
                            WW_Dice.updateConfrontationPreview();
                        }
                    }
                    // Handle powers that modify dice (Thomassin, Blanchette)
                    if (visual.dice_modifiers && Array.isArray(visual.dice_modifiers)) {
                        var self = this;
                        visual.dice_modifiers.forEach(function(mod) {
                            var diceEl = $('dice_' + mod.dice_id);
                            if (diceEl) {
                                if (apply) {
                                    var currentValue = parseInt(WW_DOM.getAttr(diceEl, 'data-value')) || parseInt(WW_DOM.getHtml(diceEl)) || 0;
                                    var newValue = Math.max(MIN_DICE, Math.min(MAX_DICE, currentValue + mod.modifier));
                                    WW_DOM.setHtml(diceEl, newValue);
                                    WW_DOM.setAttr(diceEl, 'data-value', newValue);
                                    WW_DOM.addClass(diceEl, 'ww_pending_modified');
                                } else {
                                    var currentValue = parseInt(WW_DOM.getAttr(diceEl, 'data-value')) || 0;
                                    var revertValue = currentValue - mod.modifier;
                                    WW_DOM.setHtml(diceEl, revertValue);
                                    WW_DOM.setAttr(diceEl, 'data-value', revertValue);
                                    WW_DOM.removeClass(diceEl, 'ww_pending_modified');
                                }
                            }
                        });
                        // Update confrontation preview
                        WW_Dice.updateConfrontationPreview();
                    }
                    // Handle powers that ignore dice (Wanda, Waldo)
                    if (visual.ignored_dice && Array.isArray(visual.ignored_dice)) {
                        visual.ignored_dice.forEach(function(diceId) {
                            var diceEl = $('dice_' + diceId);
                            if (diceEl) {
                                if (apply) {
                                    WW_DOM.addClass(diceEl, 'ww_dice_ignored');
                                } else {
                                    WW_DOM.removeClass(diceEl, 'ww_dice_ignored');
                                }
                            }
                        });
                        // Update confrontation preview
                        WW_Dice.updateConfrontationPreview();
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
                            } else if (powerCode === 'dragon_power') {
                                if (apply) {
                                    WW_DOM.addClass(targetEl, 'ww_pending_exhausted');
                                    this.pendingMoralGain += DRAGON_MORAL_INCREASE;
                                } else {
                                    WW_DOM.removeClass(targetEl, 'ww_pending_exhausted');
                                    this.pendingMoralGain -= DRAGON_MORAL_INCREASE;
                                }
                                this.updateMoralFlames();
                            } else {
                                // Other powers (like Vera) rest the target
                                if (apply) {
                                    WW_DOM.removeClass(targetEl, 'ww_card_exhausted');
                                    WW_DOM.removeClass(targetEl, 'ww_pending_exhausted');
                                    WW_DOM.addClass(targetEl, 'ww_pending_rested');
                                } else {
                                    WW_DOM.addClass(targetEl, 'ww_card_exhausted');
                                    WW_DOM.addClass(targetEl, 'ww_pending_exhausted');
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
            // Track total moral spent (negative change = spending moral)
            this.pendingMoralSpent -= change;
            
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
            
            // Update the flames display with temp values
            this.updateMoralFlames();
        },
        
        /**
         * Update moral flames display with temporary gain/loss indicators
         * Shows original moral with temp_loss markers on flames that will be lost
         */
        updateMoralFlames: function() {
            if (!this.originalState || !this.gameInstance) {
                console.log('updateMoralFlames: early return - originalState:', this.originalState, 'gameInstance:', this.gameInstance);
                return;
            }
            
            var originalMoral = this.originalState.moral || 0;
            var tileMoralEffect = WW_State.getSelectedTileMoralEffect();
            
            // Calculate pending loss (moral spent on dice + tile penalty)
            var tempLoss = this.pendingMoralSpent + (tileMoralEffect < 0 ? Math.abs(tileMoralEffect) : 0);
            
            // Calculate pending gain (moral from powers + tile bonus)
            var tempGain = this.pendingMoralGain + (tileMoralEffect > 0 ? tileMoralEffect : 0);
            
            // Net them out - only show the difference
            var net = tempGain - tempLoss;
            if (net > 0) {
                tempGain = net;
                tempLoss = 0;
            } else {
                tempGain = 0;
                tempLoss = Math.abs(net);
            }
            
            console.log('updateMoralFlames: originalMoral:', originalMoral, 'pendingMoralSpent:', this.pendingMoralSpent, 'tileMoralEffect:', tileMoralEffect, 'tempGain:', tempGain, 'tempLoss:', tempLoss);
            
            // Pass original moral - updateMoral will show tempLoss flames at the top of current moral
            WW_Player.updateMoral(this.gameInstance.player_id, originalMoral, tempGain, tempLoss);
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
            
            // Reset pending moral values and update flames display
            this.pendingMoralSpent = 0;
            this.pendingMoralGain = 0;
            this.updateMoralFlames();
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
                
                // windDice can be empty if all dice are ignored (Lyara, Regitha) = automatic success
                if (hordeDice.length > 0) {
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
            var result = this.gameInstance.bgaPerformAction('actBatchActions', {
                actions: JSON.stringify(actions)
            });
            if (result && result.then) {
                result.then(function() {
                    self.clear();
                    if (callback) callback(true);
                }).catch(function() {
                    // Server rejected - restore original
                    self.undoAll();
                    if (callback) callback(false);
                });
            } else {
                // Fallback if bgaPerformAction doesn't return a promise
                self.clear();
                if (callback) callback(true);
            }
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
            // Don't show wind token if force is 0 (no-wind tiles like Porte d'Hurle)
            if (tile.wind_force !== null && tile.wind_force > 0 && tile.discovered) {
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
                var tileEl = $('tile_' + tileId);
                if (tileEl) {
                    WW_DOM.addClass('tile_' + tileId, 'ww_selectable');
                    // console.log('[WW] Highlighted tile_' + tileId);
                } else {
                    console.error('[WW] Tile not found: tile_' + tileId, 'Tile data:', tiles[i]);
                }
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
        
        /**
         * Update the wind token on a tile (when a power changes the wind force)
         */
        updateWindToken: function(tileId, newForce) {
            var tile = $('tile_' + tileId);
            if (!tile) return;
            
            // Remove existing wind token
            var existingToken = tile.querySelector('.ww_wind_token');
            if (existingToken) {
                existingToken.parentNode.removeChild(existingToken);
            }
            
            // Add new wind token with updated force
            WW_DOM.place(this.createWindTokenHtml(newForce, 'ww_wind_modified'), tile);
        },
        
        showConfrontationResult: function(tileId, success) {
            var className = success ? 'ww_confrontation_success' : 'ww_confrontation_failure';
            WW_DOM.animateClass('tile_' + tileId, className, 1000);
        }
    };
    
    // ============================================================
    // WW_PowerMode - Power mode UI helpers (reduces duplication)
    // ============================================================
    var WW_PowerMode = {
        /**
         * Enter a special power mode with standard UI setup
         * @param {object} gameInstance - The game instance (this)
         * @param {number} cardId - Source card ID
         * @param {string} powerCode - Power identifier
         * @param {object} config - Configuration object:
         *   - message: Page title message
         *   - extraState: Additional state properties
         *   - showConfirm: If true, add Confirm button
         *   - confirmLabel: Custom confirm button label
         *   - onConfirm: Confirm callback
         */
        enter: function(gameInstance, cardId, powerCode, config) {
            var state = {
                card_id: cardId,
                power_code: powerCode
            };
            // Merge extra state properties
            if (config.extraState) {
                for (var key in config.extraState) {
                    state[key] = config.extraState[key];
                }
            }
            
            WW_State.setSpecialPowerMode(state);
            
            gameInstance.saveOriginalPageTitle();
            gameInstance.gamedatas.gamestate.descriptionmyturn = config.message;
            gameInstance.updatePageTitle();
            gameInstance.removeActionButtons();
            
            // Add confirm button if requested (use dojo.connect for proper binding)
            if (config.showConfirm && config.onConfirm) {
                gameInstance.addActionButton('btn_confirm_power', 
                    config.confirmLabel || _('Confirm'), 
                    null);
                dojo.connect($('btn_confirm_power'), 'onclick', gameInstance, function(evt) {
                    config.onConfirm.call(gameInstance, evt);
                });
            }
            
            // Always add cancel button (use dojo.connect for proper binding)
            gameInstance.addActionButton('btn_cancel_power', _('Cancel'), null, null, false, 'gray');
            dojo.connect($('btn_cancel_power'), 'onclick', gameInstance, function() {
                gameInstance.cancelSpecialPowerMode();
            });
            
            return state;
        },
        
        /**
         * Exit power mode and optionally execute the power
         * @param {object} gameInstance - The game instance
         * @param {object} config - Configuration:
         *   - params: Power parameters to send
         *   - visualEffect: Visual effect data for pending mode
         *   - commitOnly: For discard powers, commit but allow new actions
         */
        exit: function(gameInstance, config) {
            var mode = WW_State.getSpecialPowerMode();
            if (!mode) return false;
            
            var cardId = mode.card_id;
            
            WW_State.setSpecialPowerMode(null);
            gameInstance.cleanupPowerModeUI();
            gameInstance.restorePowerModeUI();
            
            if (config && config.params !== undefined) {
                WW_Utils.executePower(gameInstance, cardId, config.params, config.visualEffect);
            }
            
            return true;
        },
        
        /**
         * Make dice clickable with handler
         * @param {string} selector - CSS selector for dice
         * @param {function} handler - Click handler (receives diceEl, evt)
         */
        makeDiceClickable: function(selector, handler) {
            WW_DOM.forEach(selector, function(diceEl) {
                WW_DOM.addClass(diceEl, 'ww_dice_selectable');
                diceEl.onclick = function(evt) {
                    WW_DOM.stopEvent(evt);
                    handler(diceEl, evt);
                };
            });
        },
        
        /**
         * Handle dice toggle selection for multi-select modes
         * @param {HTMLElement} diceEl - Dice element
         * @param {array} selectedArray - Array to track selection
         * @param {number} maxCount - Maximum selection (0 = unlimited)
         * @param {function} onMaxReached - Callback when max reached (optional)
         * @return {boolean} true if selection changed
         */
        toggleDiceSelection: function(diceEl, selectedArray, maxCount, onMaxReached) {
            var diceId = diceEl.id.replace('dice_', '');
            var idx = selectedArray.indexOf(diceId);
            
            if (idx >= 0) {
                // Deselect
                selectedArray.splice(idx, 1);
                WW_DOM.removeClass(diceEl, 'ww_dice_selected');
                return true;
            } else if (maxCount === 0 || selectedArray.length < maxCount) {
                // Select
                selectedArray.push(diceId);
                WW_DOM.addClass(diceEl, 'ww_dice_selected');
                return true;
            } else {
                // Max reached
                if (onMaxReached) onMaxReached();
                return false;
            }
        },
        
        /**
         * Create wind force selection buttons (for Jonas power)
         * @param {object} gameInstance - Game instance
         * @param {function} onSelect - Callback with selected force value
         */
        createWindForceButtons: function(gameInstance, onSelect) {
            for (var force = 1; force <= 6; force++) {
                (function(f) {
                    var label = f.toString();
                    if (f === 6) label = "6 (FUREVENT)";
                    gameInstance.addActionButton('btn_wind_' + f, label, function() {
                        onSelect(f);
                    });
                })(force);
            }
        },
        
        /**
         * Create dice value buttons 1-6
         * @param {object} gameInstance - Game instance
         * @param {function} onSelect - Callback with selected value
         */
        createValueButtons: function(gameInstance, onSelect) {
            for (var v = 1; v <= 6; v++) {
                (function(value) {
                    gameInstance.addActionButton('btn_value_' + value, value.toString(), function() {
                        onSelect(value);
                    });
                })(v);
            }
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
        
        sortAllDice: function() {
            // Sort horde dice
            this.sortDiceInContainer('ww_horde_dice');
            // Sort wind dice  
            this.sortDiceInContainer('ww_wind_dice');
        },
        
        sortDiceInContainer: function(containerId) {
            var container = $(containerId);
            if (!container) return;
            
            var diceElements = container.querySelectorAll('.ww_dice');
            if (diceElements.length === 0) return;
            
            // Convert to array and sort by value
            var diceArray = Array.prototype.slice.call(diceElements);
            diceArray.sort(function(a, b) {
                var valA = parseInt(a.getAttribute('data-value')) || 0;
                var valB = parseInt(b.getAttribute('data-value')) || 0;
                return valA - valB;
            });
            
            // Re-append in sorted order
            diceArray.forEach(function(dice) {
                container.appendChild(dice);
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
        
        sortDiceInContainer: function(containerId) {
            var container = $(containerId);
            if (!container) return;
            
            var diceElements = [];
            WW_DOM.forEach('#' + containerId + ' .ww_dice', function(diceEl) {
                diceElements.push(diceEl);
            });
            
            // Sort by value
            diceElements.sort(function(a, b) {
                var valA = parseInt(WW_DOM.getAttr(a, 'data-value')) || parseInt(WW_DOM.getHtml(a)) || 0;
                var valB = parseInt(WW_DOM.getAttr(b, 'data-value')) || parseInt(WW_DOM.getHtml(b)) || 0;
                return valA - valB;
            });
            
            // Re-append in sorted order
            diceElements.forEach(function(diceEl) {
                container.appendChild(diceEl);
            });
        },
        
        updateConfrontationPreview: function() {
            var preview = $('ww_confrontation_preview');
            if (!preview) return;
            
            var hordeDice = this.getHordeDice();
            var windDice = this.getWindDice();
            
            // If no horde dice, hide preview (game not started properly)
            if (hordeDice.length === 0) {
                WW_DOM.hide(preview);
                WW_DOM.setHtml('ww_horde_sum', '');
                WW_DOM.setHtml('ww_wind_sum', '');
                return;
            }
            
            // windDice can be 0 if all dice are ignored (Lyara, Regitha, etc.) - that's automatic success!
            
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
            if (gamedatas.selected_tile && gamedatas.selected_tile.wind_force !== null) {
                // Display "-" for tiles with no wind (wind_force = 0)
                var force = gamedatas.selected_tile.wind_force;
                WW_DOM.setHtml('ww_wind_force', force > 0 ? force : '-');
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
        // Utility: sort cards by type (traceur > fer > pack > traine)
        TYPE_ORDER: { 'traceur': 1, 'fer': 2, 'pack': 3, 'traine': 4 },
        
        // Active filters for draft panel
        _activeFilters: [],
        
        // Clear all filters
        clearFilters: function() {
            this._activeFilters = [];
            WW_DOM.forEach('.ww_requirement', function(el) {
                WW_DOM.removeClass(el, 'ww_filter_active');
            });
            this.applyFilters();
        },
        
        // Toggle a filter type (radio button mode: max 1 active at a time)
        toggleFilter: function(type) {
            var wasActive = this._activeFilters.indexOf(type) >= 0;
            
            // Clear all filters first
            this._activeFilters = [];
            WW_DOM.forEach('.ww_requirement', function(el) {
                WW_DOM.removeClass(el, 'ww_filter_active');
            });
            
            // If wasn't active, activate it
            if (!wasActive) {
                this._activeFilters.push(type);
                var reqEl = $('req_' + type);
                if (reqEl) {
                    WW_DOM.addClass(reqEl, 'ww_filter_active');
                }
            }
            
            this.applyFilters();
        },
        
        // Apply current filters to visible cards
        applyFilters: function() {
            var activeFilters = this._activeFilters;
            
            // If no filters active, show all cards
            if (activeFilters.length === 0) {
                WW_DOM.forEach('#ww_available_characters .ww_draft_card', function(cardEl) {
                    WW_DOM.removeClass(cardEl, 'ww_filtered_out');
                });
                return;
            }
            
            // Filter cards based on active types
            WW_DOM.forEach('#ww_available_characters .ww_draft_card', function(cardEl) {
                var cardType = WW_DOM.getAttr(cardEl, 'data-type');
                var shouldShow = activeFilters.indexOf(cardType) >= 0;
                WW_DOM.toggleClass(cardEl, 'ww_filtered_out', !shouldShow);
            });
        },
        
        // Setup filter click handlers
        setupFilterHandlers: function() {
            var self = this;
            var types = ['traceur', 'fer', 'pack', 'traine'];
            
            types.forEach(function(type) {
                var reqEl = $('req_' + type);
                if (reqEl) {
                    WW_DOM.connect(reqEl, 'onclick', null, function(evt) {
                        WW_DOM.stopEvent(evt);
                        self.toggleFilter(type);
                    });
                }
            });
        },
        
        sortCardsByType: function(cards) {
            var self = this;
            var arr = Array.isArray(cards) ? cards : Object.values(cards);
            return arr.sort(function(a, b) {
                var typeA = a.char_type || a.card_type || a.type || 'traine';
                var typeB = b.char_type || b.card_type || b.type || 'traine';
                var orderA = self.TYPE_ORDER[typeA] || 5;
                var orderB = self.TYPE_ORDER[typeB] || 5;
                if (orderA !== orderB) return orderA - orderB;
                // Same type - sort alphabetically
                var nameA = (a.name || '').toLowerCase();
                var nameB = (b.name || '').toLowerCase();
                return nameA.localeCompare(nameB);
            });
        },
        
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
            
            // Setup zoom icon for preview
            WW_CardPreview.setupZoom(cardEl, typeArg);
            
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
            
            var sortedCards = this.sortCardsByType(hordeData);
            
            for (var i = 0; i < sortedCards.length; i++) {
                this.addHordeCard(sortedCards[i], onCardClick);
            }
        },
        
        addHordeCard: function(card, onCardClick) {
            var cardId = card.card_id || card.id;
            var typeArg = card.card_type_arg || card.type_arg;
            var isExhausted = card.card_power_used == 1;
            
            this.createCard({
                prefix: 'ww_horde_item',
                card: card,
                containerId: 'ww_horde',
                extraClass: 'ww_horde_card_item' + (isExhausted ? ' ww_card_exhausted' : ''),
                onClick: onCardClick
            });
            
            WW_State.addHordeCard(cardId, { id: cardId, type: typeArg, card_power_used: isExhausted ? 1 : 0 });
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
        
        // Sort the horde display by type priority: traceur > fer > pack > traine
        sortHordeDisplay: function() {
            var hordeContainer = $('ww_horde');
            if (!hordeContainer) return;
            
            var self = this;
            var cards = [];
            
            // Collect all card elements
            WW_DOM.forEach('.ww_horde_card_item', function(cardEl) {
                var typeArg = cardEl.getAttribute('data-type-arg');
                var charInfo = WW_State.getCharacter(typeArg);
                var displayType = cardEl.getAttribute('data-type') || 'traine';
                cards.push({
                    el: cardEl,
                    type: displayType,
                    name: charInfo ? charInfo.name : ''
                });
            });
            
            // Sort using centralized TYPE_ORDER
            cards.sort(function(a, b) {
                var orderA = self.TYPE_ORDER[a.type] || 5;
                var orderB = self.TYPE_ORDER[b.type] || 5;
                
                if (orderA !== orderB) {
                    return orderA - orderB;
                }
                
                // Same type - sort alphabetically by name
                return (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase());
            });
            
            // Reorder in DOM
            for (var i = 0; i < cards.length; i++) {
                hordeContainer.appendChild(cards[i].el);
            }
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
                // console.log('[WW] Making card releasable:', cardEl.id, 'cardId:', cardId);
                WW_DOM.connectWithId(cardEl.id, 'onclick', null, function(evt) {
                    // console.log('[WW] Card clicked!', cardId);
                    WW_DOM.stopEvent(evt);
                    onReleaseCard(cardId);
                });
                count++;
            });
            // console.log('[WW] Made', count, 'cards releasable');
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
                var c = hordeData[cardId];
                var isExhausted = c.card_power_used == 1;
                this.setCardRested(cardId, !isExhausted);
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
         * @param playerId - Player ID (not currently used, but kept for consistency)
         * @param exceptCardId - Optional card ID to exclude from resting (e.g., Galas himself)
         */
        setAllCardsRested: function(playerId, exceptCardId) {
            var self = this;
            WW_DOM.forEach('.ww_horde_card_item', function(cardEl) {
                // Skip the excluded card (e.g., Galas himself)
                if (exceptCardId && cardEl.id === 'ww_horde_item_' + exceptCardId) {
                    return;
                }
                WW_DOM.removeClass(cardEl, 'ww_card_exhausted');
                WW_DOM.addClass(cardEl, 'ww_card_rested');
            });
            // Animation for all cards (except excluded)
            WW_DOM.forEach('.ww_horde_card_item', function(cardEl) {
                if (exceptCardId && cardEl.id === 'ww_horde_item_' + exceptCardId) {
                    return;
                }
                WW_DOM.animateClass(cardEl, 'ww_card_pulse', 500);
            });
        },
        
        // Draft Management
        showDraftInterface: function(args, onCardClick) {
            if (!args) return;
            
            // Clear filters when opening draft panel
            this.clearFilters();
            
            WW_DOM.show('ww_draft_panel');
            WW_DOM.clear('ww_available_characters');
            WW_DOM.clear('ww_draft_selected');
            
            var self = this;
            if (args.available) {
                var sortedCards = this.sortCardsByType(args.available);
                
                sortedCards.forEach(function(card) {
                    self.createCard({
                        prefix: 'draft_card',
                        card: card,
                        containerId: 'ww_available_characters',
                        onClick: function(cid) { onCardClick(cid); }
                    });
                });
            }
            
            if (args.selected) {
                var sortedSelected = this.sortCardsByType(args.selected);
                
                sortedSelected.forEach(function(card) {
                    self.createCard({
                        prefix: 'draft_card',
                        card: card,
                        containerId: 'ww_draft_selected',
                        extraClass: 'ww_selected',
                        onClick: function(cid) { onCardClick(cid); }
                    });
                });
            }
            
            this.updateDraftCounts(args.counts, args.requirements);
            
            // Setup filter click handlers
            this.setupFilterHandlers();
        },
        
        toggleDraftCardSelection: function(cardId, selected) {
            var cardEl = $('draft_card_' + cardId);
            if (!cardEl) return;
            
            WW_DOM.toggleClass(cardEl, 'ww_selected', selected);
            
            // Move card between containers
            var targetContainer = selected ? 'ww_draft_selected' : 'ww_available_characters';
            var target = $(targetContainer);
            if (target && cardEl.parentNode !== target) {
                target.appendChild(cardEl);
                // Reapply filters when card moves back to available
                if (!selected) {
                    this.applyFilters();
                }
            }
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
            
            // Clear filters when opening draft panel
            this.clearFilters();
            
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
                var sortedCards = this.sortCardsByType(args.recruitPool);
                
                sortedCards.forEach(function(card) {
                    self.createCard({
                        prefix: 'chapter_draft_card',
                        card: card,
                        containerId: 'ww_available_characters',
                        extraClass: '',
                        onClick: function(cid) { onRecruitClick(cid); }
                    });
                });
            }
            
            // Show current horde (can click to release) - sorted by type
            if (args.horde) {
                var sortedHorde = this.sortCardsByType(args.horde);
                
                sortedHorde.forEach(function(card) {
                    var cardType = card.char_type || card.type || '';
                    var isTraceur = cardType === 'traceur';
                    // Only traceur is locked (can't be released)
                    // Régitha CAN be voluntarily released - her protection only applies to powers
                    var isLocked = isTraceur;
                    
                    self.createCard({
                        prefix: 'chapter_draft_horde',
                        card: card,
                        containerId: 'ww_draft_selected',
                        extraClass: isLocked ? 'ww_card_disabled' : '',
                        onClick: isLocked ? null : function(cid) { onReleaseClick(cid); }
                    });
                });
            }
            
            // Update counts display
            this.updateChapterDraftCounts(hordeCounts, hordeRequirements, hordeTotal, hordeMax);
            
            // Setup filter click handlers
            this.setupFilterHandlers();
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
                var isExhausted = card.card_power_used == 1;
                
                this.createCard({
                    prefix: 'recruit_card',
                    card: card,
                    containerId: 'ww_available_characters',
                    extraClass: 'ww_recruit_card' + (isExhausted ? ' ww_card_exhausted' : ''),
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
            this.sortHordeDisplay();
        }
    };
    
    // ============================================================
    // WW_Player - Player UI management
    // ============================================================
    var WW_Player = {
        setupPlayerPanel: function(playerId, player) {
            var panel = $('player_board_' + playerId);
            if (!panel) return;
            
            console.log('[WW] setupPlayerPanel - player.dice_count:', player.dice_count, 'player:', player);
            
            var traceurName = player.traceur_name || '';
            var moral = player.moral || 0;
            var diceCount = (player.dice_count || 0) - (player.surpass || 0);
            
            // Generate moral flames (filled/empty)
            var moralFlamesHtml = '';
            for (var i = 1; i <= MAX_MORAL; i++) {
                var filled = i <= moral ? 'filled' : 'empty';
                moralFlamesHtml += '<span class="ww_moral_flame ww_moral_flame_' + filled + '"></span>';
            }
            
            // Generate dice icons (mini blue dice) - show up to max, filled for actual, empty for missing
            var diceIconsHtml = '';
            var maxDice = player.dice_count || DEFAULT_DICE_COUNT; // Based on game difficulty
            for (var d = 1; d <= maxDice; d++) {
                var diceClass = d <= diceCount ? 'ww_panel_die_blue' : 'ww_panel_die_empty';
                diceIconsHtml += '<span class="ww_panel_die ' + diceClass + '"></span>';
            }
            
            // Rest counter
            var restCount = player.rest_count || 0;
            
            var panelHtml = '<div class="ww_player_info_v2">' +
                // Traceur name row
                (traceurName ? '<div class="ww_traceur_row"><span class="ww_traceur_name">' + traceurName + '</span></div>' : '') +
                // Moral flames row
                '<div class="ww_moral_row">' +
                    '<div id="moral_flames_' + playerId + '" class="ww_moral_flames">' + moralFlamesHtml + '</div>' +
                '</div>' +
                // Dice row
                '<div class="ww_dice_row_panel">' +
                    '<div id="dice_icons_' + playerId + '" class="ww_dice_icons">' + diceIconsHtml + '</div>' +
                '</div>' +
                // Rest counter row (below dice)
                '<div class="ww_rest_row">' +
                    '<div id="rest_counter_' + playerId + '" class="ww_rest_counter"><span class="ww_rest_icon"></span><span class="ww_rest_count">' + restCount + '</span></div>' +
                '</div>' +
            '</div>';
            
            WW_DOM.place(panelHtml, panel);
            
            WW_State.setPlayerMoral(playerId, player.moral);
            WW_State.setPlayerDice(playerId, diceCount);  // Store effective dice count (after surpass)
            WW_State.setPlayerMaxDice(playerId, maxDice);  // Store base dice count (from difficulty)
        },
        
        setupGameInfoPanel: function(gamedatas) {
            // Create game info panel above player boards
            var chapter = gamedatas.current_chapter || 1;
            var chapterDay = gamedatas.chapter_round || 1;
            var totalDays = gamedatas.current_round || 1;
            
            var chapterPar = gamedatas.chapter_par || 10;
            
            var existingPanel = $('ww_game_info_panel');
            if (existingPanel) {
                WW_DOM.setHtml('ww_chapter_value', chapter);
                WW_DOM.setHtml('ww_chapter_day_value', chapterDay);
                WW_DOM.setHtml('ww_total_days_value', totalDays);
                WW_DOM.setHtml('ww_chapter_par_value', chapterPar);
                return;
            }
            
            var infoHtml = '<div id="ww_game_info_panel" class="ww_game_info_v2">' +
                '<div class="ww_gi_row">' +
                    '<div class="ww_gi_item ww_gi_chapter">' +
                        '<span class="ww_gi_icon">📖</span>' +
                        '<span class="ww_gi_label">CHAPTER</span>' +
                        '<span id="ww_chapter_value" class="ww_gi_value">' + chapter + '</span>' +
                    '</div>' +
                    '<div class="ww_gi_item ww_gi_day">' +
                        '<span class="ww_gi_icon">🌙</span>' +
                        '<span class="ww_gi_label">DAY</span>' +
                        '<span id="ww_chapter_day_value" class="ww_gi_value">' + chapterDay + '</span>' +
                        '<span class="ww_gi_par">/ <span id="ww_chapter_par_value">' + chapterPar + '</span></span>' +
                    '</div>' +
                    '<div class="ww_gi_item ww_gi_phase">' +
                        '<span class="ww_gi_icon">⚡</span>' +
                        '<span class="ww_gi_label">PHASE</span>' +
                        '<span id="ww_phase_value" class="ww_gi_value">-</span>' +
                    '</div>' +
                '</div>' +
            '</div>';
            
            // Place above player boards
            var playerBoards = $('player_boards');
            
            if (playerBoards) {
                WW_DOM.place(infoHtml, playerBoards, 'before');
            } else {
                console.warn('Could not find player_boards for game info panel');
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
        
        updatePhase: function(stateName) {
            var phaseLabel = WW_PHASES[stateName] || stateName;
            WW_DOM.setHtml('ww_phase_value', phaseLabel);
        },
        
        updateMoral: function(playerId, newMoral, tempGain, tempLoss) {
            WW_State.setPlayerMoral(playerId, newMoral);
            tempGain = tempGain || 0;
            tempLoss = tempLoss || 0;
            var tempMoralVar = tempGain - tempLoss;
            var lowerMoral = Math.max(0, Math.min(newMoral, newMoral + tempMoralVar)); // What remains after loss
            var upperMoral = Math.min(MAX_MORAL, Math.max(newMoral, newMoral + tempMoralVar)); // What remains after loss

            // Update moral counter if exists (legacy)
            var counter = $('moral_counter_' + playerId);
            if (counter) {
                WW_DOM.setHtml(counter, newMoral);
                WW_DOM.animateClass(counter, 'ww_value_changed', 500);
            }
            var flamesContainer = $('moral_flames_' + playerId);
            if (flamesContainer) {
                var flamesHtml = '';
                for (var i = 1; i <= MAX_MORAL; i++) {
                    var flameClass;
                    if (i <= lowerMoral) {
                        // Safe moral (what remains after loss)
                        flameClass = 'filled';
                    } else if (tempMoralVar < 0 && i <= upperMoral) {
                        // Current moral that will be lost (marked as temp_loss)
                        flameClass = 'temp_loss';
                    } else if (tempMoralVar > 0 && i <= upperMoral) {
                        // Potential gain
                        flameClass = 'temp_gain';
                    } else {
                        flameClass = 'empty';
                    }
                    flamesHtml += '<span class="ww_moral_flame ww_moral_flame_' + flameClass + '"></span>';
                }
                WW_DOM.setHtml(flamesContainer, flamesHtml);
                WW_DOM.animateClass(flamesContainer, 'ww_value_changed', 500);
            }
        },
        
        updateDiceCount: function(playerId, newCount) {
            WW_State.setPlayerDice(playerId, newCount);
            // Update dice counter if exists (legacy)
            var counter = $('dice_counter_' + playerId);
            if (counter) {
                WW_DOM.setHtml(counter, newCount);
            }
            // Update dice icons (new style) - show up to max, filled for actual, empty for missing
            var diceContainer = $('dice_icons_' + playerId);
            if (diceContainer) {
                var diceHtml = '';
                var maxDice = WW_State.getPlayerMaxDice(playerId); // Based on game difficulty
                for (var d = 1; d <= maxDice; d++) {
                    var diceClass = d <= newCount ? 'ww_panel_die_blue' : 'ww_panel_die_empty';
                    diceHtml += '<span class="ww_panel_die ' + diceClass + '"></span>';
                }
                WW_DOM.setHtml(diceContainer, diceHtml);
            }
        },
        
        updatePosition: function(playerId, q, r) {
            WW_DOM.setHtml('position_' + playerId, '(' + q + ',' + r + ')');
        },
        
        getCurrentDiceCount: function(playerId) {
            return WW_State.getPlayerDice(playerId);
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
                console.log('[performAction] Blocked - action already in progress');
                return;
            }
            
            this._actionInProgress = true;
            var self = this;
            
            // Safety timeout to reset flag after 10 seconds
            var timeoutId = setTimeout(function() {
                console.log('[performAction] Safety timeout - resetting _actionInProgress');
                self._actionInProgress = false;
            }, 10000);
            
            var result = this.bgaPerformAction(action, args || {});
            
            // Handle both promise and non-promise returns
            if (result && typeof result.then === 'function') {
                result.then(function() {
                    clearTimeout(timeoutId);
                    self._actionInProgress = false;
                }).catch(function(err) {
                    clearTimeout(timeoutId);
                    self._actionInProgress = false;
                    console.log('[performAction] Error:', err);
                });
            } else {
                // If no promise, reset flag after short delay
                setTimeout(function() {
                    clearTimeout(timeoutId);
                    self._actionInProgress = false;
                }, 500);
            }
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
            
            // Setup sort dice button
            WW_DOM.connect('ww_sort_dice_btn', 'onclick', null, function(evt) {
                WW_DOM.stopEvent(evt);
                WW_Dice.sortAllDice();
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
            WW_Player.updatePhase(stateName);
            
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
                case 'chooseHordierToRest':
                    this.enterChooseHordierToRestState(args.args);
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
                case 'chooseHordierToRest':
                    WW_Cards.clearHordeSelectable();
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
                    WW_Utils.setupDiceResultButtons(this, false);
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
            WW_DOM.hide('ww_horde_panel');
            
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
        },
        
        enterPlayerTurnState: function(args) {
            WW_DOM.show('ww_map_container');
            WW_DOM.show('ww_dice_panel');
            WW_DOM.show('ww_horde_panel');
            WW_DOM.hide('ww_draft_panel');
            
            WW_Dice.clearDice();
            WW_DOM.setHtml('ww_wind_force', '-');
            
            if (this.isCurrentPlayerActive() && args && args.adjacent) {
                WW_Hex.highlightTiles(args.adjacent);
            }
            
            // Update horde exhausted state from server data BEFORE making them usable
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
        
        // Update action buttons for diceResult state (called after DOM is ready)
        updateDiceResultButtons: function() {
            // Only update if we're in diceResult state
            if (!this.gamedatas || !this.gamedatas.gamestate || this.gamedatas.gamestate.name !== 'diceResult') {
                return;
            }
            
            // Only update for active player
            if (!this.isCurrentPlayerActive()) {
                return;
            }
            
            // Restore original page title if it was modified by a power
            if (this.gamedatas.gamestate.descriptionmyturnaliased) {
                this.gamedatas.gamestate.descriptionmyturn = this.gamedatas.gamestate.descriptionmyturnaliased;
                this.updatePageTitle();
            }
            
            // Use centralized button setup (with clearing)
            WW_Utils.setupDiceResultButtons(this, true);
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
                // Store wind force in state for powers like Blanchette
                WW_State.setWindForce(args.wind_force);
                // Display "-" for tiles with no wind (wind_force = 0)
                WW_DOM.setHtml('ww_wind_force', args.wind_force > 0 ? args.wind_force : '-');
            }
            
            // Mark ignored dice (from Lyara, Wanda, Uther, etc.)
            if (args.ignored_dice && args.ignored_dice.length > 0) {
                for (var i = 0; i < args.ignored_dice.length; i++) {
                    var diceEl = $('dice_' + args.ignored_dice[i]);
                    if (diceEl) {
                        WW_DOM.addClass(diceEl, 'ww_dice_ignored');
                    }
                }
                WW_Dice.updateConfrontationPreview();
            }
        },
        
        enterDiceResultState: function(args) {
            if (args && args.wind_force !== null && args.wind_force !== undefined) {
                // Store wind force in state for powers like Blanchette
                WW_State.setWindForce(args.wind_force);
                // Display "-" for tiles with no wind (wind_force = 0)
                WW_DOM.setHtml('ww_wind_force', args.wind_force > 0 ? args.wind_force : '-');
            }
            
            // Store tile info for powers like Oranne (needs moral_effect)
            if (args && args.tile) {
                WW_State.setSelectedTile(args.tile);
            }
            
            // Initialize protected cards list (e.g., Régitha after using power)
            WW_State.setProtectedCards((args && args.protected_cards) || []);
            
            // Mark ignored dice (from Lyara, Wanda, Uther, etc.)
            if (args && args.ignored_dice && args.ignored_dice.length > 0) {
                for (var i = 0; i < args.ignored_dice.length; i++) {
                    var diceEl = $('dice_' + args.ignored_dice[i]);
                    if (diceEl) {
                        WW_DOM.addClass(diceEl, 'ww_dice_ignored');
                    }
                }
                WW_Dice.updateConfrontationPreview();
            }
            
            // Update action buttons now that DOM is ready
            if (this.isCurrentPlayerActive()) {
                this.updateDiceResultButtons();
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
                        initialState.horde[cardId] = { card_power_used: parseInt(c.card_power_used || 0) };
                    }
                }
                
                WW_PendingActions.init(this);
                WW_PendingActions.enable(initialState);
                
                // Initialize moral flames display with tile effect indicators
                WW_PendingActions.updateMoralFlames();
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
        },
        
        enterChooseHordierToRestState: function(args) {
            if (!args || !args.exhausted_hordiers) return;
            
            var self = this;
            
            // Build an object with card IDs as keys (format expected by makeHordeSelectable)
            var selectableHorde = {};
            args.exhausted_hordiers.forEach(function(h) {
                selectableHorde[h.card_id] = {
                    id: h.card_id,
                    type_arg: h.type_arg,
                    card_power_used: h.card_power_used
                };
            });
            
            WW_Cards.makeHordeSelectable(selectableHorde, function(cardId) {
                self.onSelectHordierToRest(cardId);
            });
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
            
            // Show error messages for constraint violations
            if (hordeCount > 8) {
                this.showMessage(_("Too many Hordiers! Click on a Hordier to release before finishing."), "error");
            } else if (validity.excessTypes.length > 0) {
                this.showMessage(_("Horde exceeds type limits: ") + validity.excessTypes.join(', ') + _(" - Release a Hordier to continue."), "error");
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
        },
        
        ///////////////////////////////////////////////////
        //// Click Handlers
        
        onTileClick: function(evt) {
            WW_DOM.stopEvent(evt);
            
            // If in Ernest power mode, let Ernest's handler deal with it
            var specialMode = WW_State.getSpecialPowerMode();
            if (specialMode && specialMode.power_code === 'ernest_power') {
                return;
            }
            
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
                select: isSelected ? 0 : 1
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
        
        /**
         * Build the state object for WW_PendingActions from current DOM state
         * Used to re-enable pending mode after discard powers
         */
        buildPendingActionsState: function() {
            var self = this;
            // Get moral from WW_State (updated by notifications) or fallback to gamedatas
            var playerMoral = WW_State.getPlayerMoral(this.player_id);
            if (playerMoral === undefined) {
                playerMoral = this.gamedatas.players[this.player_id] ? (this.gamedatas.players[this.player_id].moral || 0) : 0;
            }
            var state = {
                moral: playerMoral,
                dice: {},
                horde: {}
            };
            
            // Capture current dice state from DOM
            WW_DOM.forEach('#ww_horde_dice .ww_dice', function(diceEl) {
                var diceId = diceEl.id.replace('dice_', '');
                state.dice[diceId] = {
                    value: parseInt(WW_DOM.getAttr(diceEl, 'data-value')) || parseInt(WW_DOM.getHtml(diceEl)) || 1,
                    type: WW_DOM.hasClass(diceEl, 'ww_dice_blue') ? 'blue' : 'violet'
                };
            });
            
            // Capture horde state from DOM
            WW_DOM.forEach('#ww_horde_container .ww_card', function(cardEl) {
                var cardId = cardEl.id.replace('ww_horde_item_', '');
                state.horde[cardId] = {
                    card_power_used: WW_DOM.hasClass(cardEl, 'ww_card_exhausted') ? 1 : 0
                };
            });
            
            return state;
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
            
            // Keep dice selected so player can click +1/-1 multiple times
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
            
            // Keep dice selected so player can click +1/-1 multiple times
        },
        
        onUndoAction: function(evt) {
            WW_DOM.stopEvent(evt);
            WW_PendingActions.undo();
        },
        
        onUndoAll: function(evt) {
            WW_DOM.stopEvent(evt);
            WW_PendingActions.undoAll();
        },
        
        onSortDice: function(evt) {
            WW_DOM.stopEvent(evt);
            WW_Dice.sortDiceInContainer('ww_horde_dice');
            WW_Dice.sortDiceInContainer('ww_wind_dice');
        },
        
        onConfirmRoll: function(evt) {
            WW_DOM.stopEvent(evt);
            
            // If pending actions exist, send them with andConfirm=1
            if (WW_PendingActions.hasPending()) {
                var self = this;
                var actions = WW_PendingActions.getActions();
                
                // Send batch actions with confirm flag - single request
                // Use 1 instead of true for BGA compatibility
                var result = this.bgaPerformAction('actBatchActions', {
                    actions: JSON.stringify(actions),
                    andConfirm: 1
                });
                
                // Handle both promise and non-promise returns
                if (result && typeof result.then === 'function') {
                    result.then(function() {
                        WW_PendingActions.clear();
                    }).catch(function() {
                        WW_PendingActions.undoAll();
                    });
                } else {
                    // If no promise, just clear pending actions
                    WW_PendingActions.clear();
                }
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
            
            // If we're in special power mode (dice modifier, etc.), block other power usage
            if (WW_State.getSpecialPowerMode()) {
                this.showMessage(_("Please finish or cancel the current power first"), "info");
                return;
            }
            
            // Check if we're in pending actions mode (during confrontation)
            var inPendingActionsMode = WW_PendingActions.isActive();
            
            // Get character info to check power type
            var hordeCard = WW_State.getHordeCard(cardId);
            var typeArg = hordeCard ? hordeCard.type : null;
            var charInfo = typeArg ? WW_State.getCharacter(typeArg) : null;
            var powerCode = charInfo ? charInfo.power_code : null;
            
            // Check if card already has pending exhaustion (only in pending mode)
            if (inPendingActionsMode) {
                var computedState = WW_PendingActions.getComputedState();
                var pendingCard = computedState && computedState.horde && computedState.horde[cardId];
                if (pendingCard && pendingCard.card_power_used == 1) {
                    this.showMessage(_("Power already used"), "info");
                    return;
                }
            }
            
            // Check if this power requires a target
            if (this.powerRequiresTarget(powerCode)) {
                this.enterPowerTargetMode(cardId, powerCode);
                return;
            }
            
            // Check if this power requires special UI
            this.enterSpecialPowerMode(cardId, powerCode);
            
            // If we entered a special power mode, stop here - the mode will handle execution
            if (WW_State.getSpecialPowerMode()) {
                return;
            }
            
            // If in pending actions mode (during confrontation), add to pending
            // Otherwise, send directly to server (outside confrontation)
            if (inPendingActionsMode) {
                WW_PendingActions.push('usePower', {
                    card_id: parseInt(cardId)
                }, {});
            } else {
                // Outside confrontation - call server directly
                this.performAction('actUsePower', { card_id: parseInt(cardId) });
            }
        },
        
        /**
         * Check if a power requires selecting a target
         */
        powerRequiresTarget: function(powerCode) {
            var targetPowers = ['vera_power', 'uther_power', 'dragon_power'];  // Powers that need a hordier target
            return targetPowers.indexOf(powerCode) !== -1;
        },
        
        /**
         * Enter special power mode (dice value selection, dice modification, etc.)
         */
        enterSpecialPowerMode: function(cardId, powerCode) {            
            // Note: Don't set mode here - each enterXXXPowerMode() sets its own state
            // Powers that don't need special UI (execute functions) don't set any mode
            switch (powerCode) {
                case 'gianni_power':
                    this.enterGianniPowerMode(cardId);
                    break;
                case 'wanda_power':
                    this.enterWandaPowerMode(cardId);
                    break;
                case 'xavio_power':
                    // Xavio: +1 die, if another Torantor: ±1 on 1 die
                    this.enterXavioPowerMode(cardId);
                    break;
                case 'kyo_power':
                    // Kyo: +1 die always, and rest another Torantor if present
                    this.enterKyoPowerMode(cardId);
                    break;
                case 'zaffa_power':
                    // Zaffa: +1 violet die (discard), rest another Torantor
                    this.enterZaffaPowerMode(cardId);
                    break;
                case 'thomassin_power':
                    this.enterThomassinPowerMode(cardId);
                    break;
                case 'blanchette_power':
                    this.enterBlanchettePowerMode(cardId);
                    break;
                case 'ukkiba_power':
                    this.enterUkkibaPowerMode(cardId);
                    break;
                case 'waldo_power':
                    this.enterWaldoPowerMode(cardId);
                    break;
                case 'belkacem_power':
                    this.enterBelkacemPowerMode(cardId);
                    break;
                case 'oranne_power':
                    this.enterOrannePowerMode(cardId);
                    break;
                case 'ivana_power':
                    this.executeIvanaPower(cardId);
                    break;
                case 'thutmus_power':
                    this.executeThutmusPower(cardId);
                    break;
                case 'amon_power':
                    this.enterAmonPowerMode(cardId);
                    break;
                case 'duke_power':
                    this.enterDukePowerMode(cardId);
                    break;
                case 'jonas_power':
                    // Jonas: choose wind token from bag
                    this.enterJonasPowerMode(cardId);
                    break;
                case 'kon_power':
                    // Kon: reroll all or some blue dice
                    this.enterKonPowerMode(cardId);
                    break;
                case 'ernest_power':
                    // Ernest: place wind force on 3 adjacent tiles
                    this.enterErnestPowerMode(cardId);
                    break;
                case 'charlize_power':
                    // Charlize: commit pending changes first, then gain moral per black die
                    this.executeCharlizePower(cardId);
                    break;
                case 'benelim_power':
                    // Benelim: discard to roll +1 die per PACK card
                    this.executeBenelimPower(cardId);
                    break;
                case 'osuros_power':
                    // Osuros: discard to set wind force to 6
                    this.executeOsurosPower(cardId);
                    break;
                case 'tula_power':
                    // Tula: discard to set wind force to 2
                    this.executeTulaPower(cardId);
                    break;
                default:
                    WW_State.clearSpecialPowerMode();
                    // this.executeSimplePower(cardId);
                    break;
            }
        },
        
        /**
         * Execute a simple tap power immediately (no special UI)
         * Powers like Galas/Kunigunde that depend on dice state must include the power
         * in the batch actions so server validates with updated dice values
         */
        executeSimplePower: function(cardId) {
            
            // If there are pending actions, include this power in the batch
            if (WW_PendingActions.isActive() && WW_PendingActions.hasPending()) {
                // Add power to pending actions
                WW_PendingActions.push('usePower', {
                    card_id: parseInt(cardId)
                }, {});
                
                // Now send all actions together (including the power)
                var actions = WW_PendingActions.getActions();
                
                var result = this.bgaPerformAction('actBatchActions', {
                    actions: JSON.stringify(actions),
                    andConfirm: 0  // Don't confirm roll, just apply the actions
                });
                if (result && result.then) {
                    result.then(function() {
                        WW_PendingActions.clear();
                    }).catch(function() {
                        WW_PendingActions.undoAll();
                    });
                } else {
                    WW_PendingActions.clear();
                }
            } else {
                // No pending actions, just execute directly
                this.performAction('actUsePower', {
                    card_id: parseInt(cardId),
                    params: JSON.stringify({})
                });
            }
        },
        
        resolvePendingActionsBeforePower: function(cardId, callback) {
            // Commit pending actions first, then apply power
            if (callback === undefined) {
                callback = () => {
                    this.performAction('actUsePower', {
                        card_id: parseInt(cardId),
                        params: JSON.stringify({})
                    });
                };
            }
            var hasPendingActions = WW_PendingActions.isActive() && WW_PendingActions.hasPending();
            var result = null;
            if (hasPendingActions) {
                var actions = WW_PendingActions.getActions();
                
                var result = this.bgaPerformAction('actBatchActions', {
                    actions: JSON.stringify(actions),
                    andConfirm: 0
                });
            }                    
            if (result && result.then) {
                result.then(() => {
                    WW_PendingActions.clear();
                    callback();
                }).catch(() => {
                    WW_PendingActions.undoAll();
                });
            }
            else {
                hasPendingActions && WW_PendingActions.clear();
                callback();
            }
        },

        
        /**
         * Execute Ivana's discard power: ignore all dice < wind force
         * Shows confirmation dialog since it discards the card
         */
        executeIvanaPower: function(cardId) {
            var windForce = WW_State.getWindForce() || 0;
            
            if (windForce <= 1) {
                this.showMessage(_("Wind force must be greater than 1 to use this power"), "error");
                return;
            }
            
            // Set temporary mode to prevent double execution
            WW_State.setSpecialPowerMode({ card_id: cardId, power_code: 'ivana_power', confirming: true });
            
            // Count dice that would be ignored
            var diceToIgnore = 0;
            dojo.query('#ww_wind_dice .ww_dice').forEach(function(diceEl) {
                var value = parseInt(WW_DOM.getAttr(diceEl, 'data-value')) || 0;
                if (value < windForce) {
                    diceToIgnore++;
                }
            });
            
            if (diceToIgnore === 0) {
                this.showMessage(_("No challenge dice with value less than wind force"), "error");
                return;
            }
            
            // Confirm dialog since this discards the card
            var self = this;
            this.confirmationDialog(
                dojo.string.substitute(_("Discard Ivana to ignore ${count} dice (all dice with value < ${force})?"), {
                    count: diceToIgnore,
                    force: windForce
                }),
                () => {
                    WW_State.clearSpecialPowerMode();
                    self.resolvePendingActionsBeforePower(cardId);
                },
                () => {
                    // On cancel
                    WW_State.clearSpecialPowerMode();
                }
            );
        },
        
        /**
         * Execute Charlize's power: commit pending changes first, then gain +2 moral per black die
         */
        executeCharlizePower: function(cardId) {
            // Count black dice
            var blackDiceCount = dojo.query('#ww_wind_dice .ww_dice_black').length;
            
            if (blackDiceCount === 0) {
                this.showMessage(_('No black dice present'), 'error');
                return;
            }
            
            // Set temporary mode to prevent double execution
            WW_State.setSpecialPowerMode({ card_id: cardId, power_code: 'charlize_power', confirming: true });
            
            var self = this;
            this.resolvePendingActionsBeforePower(cardId, function() {
                WW_State.clearSpecialPowerMode();
                self.performAction('actUsePower', {
                    card_id: parseInt(cardId),
                    params: JSON.stringify({})
                });
            });
        },
        
        /**
         * Execute Benelim's power: discard to roll +1 die per PACK card in horde
         * Requires committing pending actions first due to server-side dice roll
         */
        executeBenelimPower: function(cardId) {
            // Set temporary mode to prevent double execution
            WW_State.setSpecialPowerMode({ card_id: cardId, power_code: 'benelim_power', confirming: true });
            
            var self = this;
            this.resolvePendingActionsBeforePower(cardId, function() {
                WW_State.clearSpecialPowerMode();
                self.performAction('actUsePower', {
                    card_id: parseInt(cardId),
                    params: JSON.stringify({})
                });
            });
        },
        
        /**
         * Execute Osuros's power: discard to set wind force to 6 (FUREVENT)
         * Requires committing pending actions first before server-side change
         */
        executeOsurosPower: function(cardId) {
            // Set temporary mode to prevent double execution
            WW_State.setSpecialPowerMode({ card_id: cardId, power_code: 'osuros_power', confirming: true });
            
            var self = this;
            this.resolvePendingActionsBeforePower(cardId, function() {
                WW_State.clearSpecialPowerMode();
                self.performAction('actUsePower', {
                    card_id: parseInt(cardId),
                    params: JSON.stringify({})
                });
            });
        },
        
        /**
         * Execute Tula's power: discard to set wind force to 2
         * Requires committing pending actions first before server-side change
         */
        executeTulaPower: function(cardId) {
            // Set temporary mode to prevent double execution
            WW_State.setSpecialPowerMode({ card_id: cardId, power_code: 'tula_power', confirming: true });
            
            var self = this;
            this.resolvePendingActionsBeforePower(cardId, function() {
                WW_State.clearSpecialPowerMode();
                self.performAction('actUsePower', {
                    card_id: parseInt(cardId),
                    params: JSON.stringify({})
                });
            });
        },
        
        /**
         * Execute Thutmus's power: Roll exactly wind_force BLUE dice
         * Shows confirmation since it replaces all blue dice
         */
        executeThutmusPower: function(cardId) {
            var windForce = WW_State.getWindForce() || 0;
            
            if (windForce <= 0) {
                this.showMessage(_("No wind force on this tile"), "error");
                return;
            }
            
            // Count current blue horde dice only
            var currentBlueDiceCount = dojo.query('#ww_horde_dice .ww_dice_blue').length;
            
            // Set temporary mode to prevent double execution
            WW_State.setSpecialPowerMode({ card_id: cardId, power_code: 'thutmus_power', confirming: true });
            
            // Confirm dialog since this replaces all blue dice
            var self = this;
            this.confirmationDialog(
                dojo.string.substitute(_("Use Thutmus to roll exactly ${force} blue dice? (Currently: ${current} blue dice)"), {
                    force: windForce,
                    current: currentBlueDiceCount
                }),
                () => {
                    WW_State.clearSpecialPowerMode();
                    self.resolvePendingActionsBeforePower(cardId);
                },
                () => {
                    // On cancel
                    WW_State.clearSpecialPowerMode();
                }
            );
        },
        
        /**
         * Amon Amon's power: Ignore 1 white die per black die
         * :tap:: Ignorez :d6-white: / :d6-black:
         */
        enterAmonPowerMode: function(cardId) {
            // Count black dice
            var blackDiceCount = dojo.query('#ww_horde_dice .ww_dice_black, #ww_wind_dice .ww_dice_black').length;
            
            if (blackDiceCount === 0) {
                this.showMessage(_("No black dice (fatalité) - cannot use this power"), "error");
                return;
            }
            
            // Get white dice
            var whiteDice = dojo.query('#ww_wind_dice .ww_dice_white');
            
            if (whiteDice.length === 0) {
                this.showMessage(_("No white dice to ignore"), "error");
                return;
            }
            
            WW_State.setSpecialPowerMode({
                card_id: cardId,
                power_code: 'amon_power',
                selected_dice: [],
                max_ignore: blackDiceCount
            });
            
            this.saveOriginalPageTitle();
            this.gamedatas.gamestate.descriptionmyturn = dojo.string.substitute(_("Amon Amon: Click on white dice to ignore (up to ${count})"), { count: blackDiceCount });
            this.updatePageTitle();
            
            // Make white dice selectable
            WW_DOM.forEach('#ww_wind_dice .ww_dice_white', function(diceEl) {
                WW_DOM.addClass(diceEl, 'ww_dice_selectable');
                diceEl.onclick = function(evt) {
                    WW_DOM.stopEvent(evt);
                    self.onAmonDiceClick(diceEl);
                };
            });
            
            this.removeActionButtons();
            this.addActionButton('btn_amon_confirm', _('Ignore Selected'), function() {
                self.confirmAmonPower(cardId);
            });
            this.addActionButton('btn_amon_cancel', _('Cancel'), function() {
                self.cancelSpecialPowerMode();
            }, null, false, 'gray');
        },
        
        /**
         * Handle dice click in Amon ignore mode
         */
        onAmonDiceClick: function(diceEl) {
            var mode = WW_State.getSpecialPowerMode();
            if (!mode || mode.power_code !== 'amon_power') return;
            
            var diceId = diceEl.id.replace('dice_', '');
            var idx = mode.selected_dice.indexOf(diceId);
            
            if (idx >= 0) {
                // Deselect
                mode.selected_dice.splice(idx, 1);
                WW_DOM.removeClass(diceEl, 'ww_dice_selected');
            } else {
                // Check max
                if (mode.selected_dice.length >= mode.max_ignore) {
                    this.showMessage(dojo.string.substitute(_("Can only ignore up to ${count} white dice"), { count: mode.max_ignore }), "info");
                    return;
                }
                // Select
                mode.selected_dice.push(diceId);
                WW_DOM.addClass(diceEl, 'ww_dice_selected');
            }
        },
        
        /**
         * Confirm Amon power - ignore selected white dice
         */
        confirmAmonPower: function(cardId) {
            var mode = WW_State.getSpecialPowerMode();
            if (!mode || mode.power_code !== 'amon_power') return;
            
            if (mode.selected_dice.length === 0) {
                this.showMessage(_("Select at least one white die to ignore"), "error");
                return;
            }
            
            // selected_dice contains IDs like 'white_0', 'white_1'
            var diceIds = mode.selected_dice.slice();  // Copy array
            
            // Clean up
            this.cancelSpecialPowerMode();
            
            // Remove any pending "rest this card" actions (since we just exhausted it)
            WW_PendingActions.removeActionsTargeting(cardId);
            
            var params = { dice_ids: diceIds };
            WW_Utils.executePower(this, cardId, params, { ignored_dice: diceIds });
        },
        
        /**
         * Duke Arnaud N.'s power: Discard to place (set values of) 2 blue dice
         * Multi-step UI: select die 1 -> value 1 -> select die 2 -> value 2 -> confirm
         */
        enterDukePowerMode: function(cardId) {
            var self = this;
            
            // Count available blue and violet dice
            var playerDice = dojo.query('#ww_horde_dice .ww_dice_blue, #ww_horde_dice .ww_dice_violet');
            
            if (playerDice.length < 2) {
                this.showMessage(_("Not enough dice (need at least 2 blue or violet dice)"), "error");
                return;
            }
            
            WW_State.setSpecialPowerMode({
                card_id: cardId,
                power_code: 'duke_power',
                step: 'select_dice_1',
                dice_selections: []  // Will hold {dice_id, dice_value} pairs
            });
            
            this.saveOriginalPageTitle();
            this.gamedatas.gamestate.descriptionmyturn = _("Duke: Click on a blue or violet die to set");
            this.updatePageTitle();
            
            // Make blue and violet dice selectable
            playerDice.forEach(function(diceEl) {
                WW_DOM.addClass(diceEl, 'ww_dice_selectable');
                diceEl.onclick = function(evt) {
                    WW_DOM.stopEvent(evt);
                    self.onDukeDiceSelect(diceEl);
                };
            });
            
            this.removeActionButtons();
            this.addActionButton('btn_cancel_power', _('Cancel'), function() {
                self.cancelSpecialPowerMode();
            }, null, false, 'gray');
        },
        
        /**
         * Handle dice selection in Duke power mode
         */
        onDukeDiceSelect: function(diceEl) {
            var self = this;
            var mode = WW_State.getSpecialPowerMode();
            if (!mode || mode.power_code !== 'duke_power') return;
            
            var diceId = diceEl.id.replace('dice_', '');
            
            // Check if this die was already selected
            for (var i = 0; i < mode.dice_selections.length; i++) {
                if (mode.dice_selections[i].dice_id == diceId) {
                    this.showMessage(_("This die is already selected"), "error");
                    return;
                }
            }
            
            // Mark die as selected
            WW_DOM.addClass(diceEl, 'ww_dice_selected');
            
            // Store current dice id and show value selection
            mode.current_dice_id = diceId;
            var isSecondDice = mode.step === 'select_dice_2';
            mode.step = isSecondDice ? 'select_value_2' : 'select_value_1';
            
            this.gamedatas.gamestate.descriptionmyturn = isSecondDice 
                ? _("Duke: Click a value (1-6) for the second die")
                : _("Duke: Click a value (1-6) for the first die");
            this.updatePageTitle();
            
            // Remove clickability from dice while selecting value
            WW_DOM.removeClassFromAll('.ww_dice_selectable', 'ww_dice_selectable');
            
            this.removeActionButtons();
            for (var v = 1; v <= 6; v++) {
                (function(value) {
                    self.addActionButton('btn_value_' + value, value.toString(), function() {
                        self.onDukeValueSelect(value);
                    });
                })(v);
            }
            
            this.addActionButton('btn_cancel_power', _('Cancel'), function() {
                self.cancelSpecialPowerMode();
            }, null, false, 'gray');
        },
        
        /**
         * Handle value selection in Duke power mode
         */
        onDukeValueSelect: function(value) {
            var self = this;
            var mode = WW_State.getSpecialPowerMode();
            if (!mode || mode.power_code !== 'duke_power') return;
            
            // Store the selection
            mode.dice_selections.push({
                dice_id: parseInt(mode.current_dice_id),
                dice_value: value
            });
            
            if (mode.step === 'select_value_1') {
                // Move to second dice selection
                mode.step = 'select_dice_2';
                mode.current_dice_id = null;
                
                this.gamedatas.gamestate.descriptionmyturn = _("Duke: Click on another die to set");
                this.updatePageTitle();
                
                // Re-enable dice selection (except already selected)
                var playerDice = dojo.query('#ww_horde_dice .ww_dice_blue, #ww_horde_dice .ww_dice_violet');
                playerDice.forEach(function(diceEl) {
                    if (!WW_DOM.hasClass(diceEl, 'ww_dice_selected')) {
                        WW_DOM.addClass(diceEl, 'ww_dice_selectable');
                        diceEl.onclick = function(evt) {
                            WW_DOM.stopEvent(evt);
                            self.onDukeDiceSelect(diceEl);
                        };
                    }
                });
                
                this.removeActionButtons();
                this.addActionButton('btn_cancel_power', _('Cancel'), function() {
                    self.cancelSpecialPowerMode();
                }, null, false, 'gray');
            } else {
                // Both dice selected - confirm and execute
                this.confirmDukePower();
            }
        },
        
        /**
         * Confirm and execute Duke power
         */
        confirmDukePower: function() {
            var self = this;
            var mode = WW_State.getSpecialPowerMode();
            if (!mode || mode.power_code !== 'duke_power') return;
            
            var cardId = mode.card_id;
            var params = { dice_selections: mode.dice_selections };
            
            WW_PowerMode.exit(this);
            
            // Discard powers: resolve pending actions first, then execute
            WW_Utils.resolvePendingActions(this, function() {
                self.performAction('actUsePower', {
                    card_id: parseInt(cardId),
                    params: JSON.stringify(params)
                });
            }, true); // commitOnly=true for discard powers
        },
        
        /**
         * Execute Torantor power immediately (adds dice, cannot be pending)
         */
        executeTorantorPower: function(cardId) {
            this.performAction('actUsePower', {
                card_id: parseInt(cardId),
                params: JSON.stringify({})
            });
        },

        otherTorantor: function(cardId) {
            var hordeCards = WW_State.getHordeCards();
            var otherTorantors = [];
            for (var hCardId in hordeCards) {
                if (hCardId == cardId) continue;  // Skip Kyo himself
                var card = hordeCards[hCardId];
                var typeArg = card ? card.type : null;
                var charInfo = typeArg ? WW_State.getCharacter(typeArg) : null;
                if (charInfo && charInfo.name && charInfo.name.indexOf('Torantor') !== -1) {
                    otherTorantors.push(hCardId);
                }
            }
            return otherTorantors;
        },
        
        /**
         * Xavio Torantor: +1 die, if another Torantor: ±1 on 1 die
         * First click: roll the die. Second click (if other Torantor): modify a die.
         */
        enterXavioPowerMode: function(cardId) {
            var otherTorantors = this.otherTorantor(cardId);
            
            this.executeTorantorPower(cardId);

            if (otherTorantors.length === 0) {
                return;
            }
            
            // Has another Torantor - enter single die modifier mode
            this.enterDiceModifierPowerMode(cardId, 'xavio_power', {
                maxDice: 1,
                requireAtLeastOne: false,
                preventDoubleClick: true,
                message: _("Xavio: 1 modification (LEFT -1, RIGHT +1)")
            });
        },
        
        /**
         * Kyo Torantor: +1 die always, rest another Torantor if present
         * Must select target BEFORE sending to server (server rolls dice)
         */
        enterKyoPowerMode: function(cardId) {
            // First roll the die
            this.executeTorantorPower(cardId);
            
            var otherTorantors = this.otherTorantor(cardId);

            if (otherTorantors.length > 0) {
                // Has other Torantors - enter target selection mode (sends power WITH target)
                this.enterPowerTargetMode(cardId, 'kyo_power');
            } 
        },
        
        /**
         * Zaffa Torantor: Roll +1 violet die (discard), rest another Torantor
         * 2-step discard power - similar to Kyo but triggers on discard
         */
        enterZaffaPowerMode: function(cardId) {
            // Step 1: Send to server (rolls die, discards Zaffa)
            this.performAction('actUsePower', {
                card_id: parseInt(cardId),
                params: JSON.stringify({})
            });

            // Enter target selection for step 2 (rest another Torantor)
            var otherTorantors = this.otherTorantor(cardId);
            if (otherTorantors.length > 0) {
                this.enterPowerTargetMode(cardId, 'zaffa_power');
            }
        },
        
        /**
         * Jonas: Choose a wind force (1-6) to set on current tile
         */
        enterJonasPowerMode: function(cardId) {            
            WW_PowerMode.enter(this, cardId, 'jonas_power', {
                message: _("Jonas: Click a button to set wind force (1-6)")
            });
            
            // Add wind force buttons (replaces removeActionButtons call above)
            this.removeActionButtons();
            WW_PowerMode.createWindForceButtons(this, function(force) {
                self.confirmJonasPower(force);
            });
            
            this.addActionButton('btn_cancel_power', _('Cancel'), function() {
                self.cancelSpecialPowerMode();
            }, null, false, 'gray');
        },
        
        /**
         * Confirm and execute Jonas power with selected wind force
         */
        confirmJonasPower: function(windForce) {
            var mode = WW_State.getSpecialPowerMode();
            if (!mode || mode.power_code !== 'jonas_power') return;
            
            var cardId = mode.card_id;
            var params = { wind_force: windForce };
            
            WW_PowerMode.exit(this);
            
            // Discard powers: resolve pending actions first, then execute
            WW_Utils.resolvePendingActions(this, () => {
                this.performAction('actUsePower', {
                    card_id: parseInt(cardId),
                    params: JSON.stringify(params)
                });
            }, true); // commitOnly=true for discard powers
        },
        
        /**
         * Gianni: Select a blue die then choose its new value (1-6)
         */
        enterGianniPowerMode: function(cardId) {
            this.enterDiceValuePowerMode(cardId, 'gianni_power', {
                diceContainer: '#ww_horde_dice',
                diceClass: 'ww_dice_blue',
                selectMessage: _("Gianni: Click on a blue die to set its value"),
                valueMessage: _("Gianni: Click a value (1-6) for this die")
            });
        },
        
        /**
         * Wanda: Select 1 challenge die to ignore
         */
        enterWandaPowerMode: function(cardId) {
            this.enterDiceIgnorePowerMode(cardId, 'wanda_power', {
                maxIgnore: 1,
                exactCount: true,
                message: _("Wanda: Click on 1 challenge die to ignore")
            });
        },
        
        /**
         * Thomassin: ±1 on each blue horde die
         */
        enterThomassinPowerMode: function(cardId) {
            this.enterDiceModifierPowerMode(cardId, 'thomassin_power', {
                maxDice: 999,  // No limit
                requireAtLeastOne: true,
                message: _("Thomassin: Click LEFT for -1, RIGHT for +1 on each die")
            });
        },
        
        /**
         * Blanchette: ±1 on X blue dice (X = wind force)
         */
        enterBlanchettePowerMode: function(cardId) {
            var windForce = WW_State.getWindForce() || 0;
            
            this.enterDiceModifierPowerMode(cardId, 'blanchette_power', {
                maxDice: windForce,
                requireAtLeastOne: false,
                preventDoubleClick: true,
                message: dojo.string.substitute(_("Blanchette: ${max} modifications (LEFT -1, RIGHT +1)"), {max: windForce})
            });
        },
        
        /**
         * Ukkiba: -1 moral, then ±1 on blue dice (X = remaining moral)
         */
        enterUkkibaPowerMode: function(cardId) {
            // Get current moral from WW_State (updated by notifications) or gamedatas as fallback
            var currentMoral = WW_State.getPlayerMoral(this.player_id);
            if (currentMoral === undefined) {
                // Fallback to gamedatas if WW_State not initialized
                currentMoral = (this.gamedatas.players[this.player_id] || {}).moral || 0;
            }
            console.log('[Ukkiba] currentMoral from WW_State:', currentMoral, 'player_id:', this.player_id);
            
            if (currentMoral <= 1) {
                this.showMessage(_("You need at least 2 moral to use this power (1 will be spent)"), "error");
                return;
            }
            
            // After losing 1 moral, remaining moral = currentMoral - 1
            var maxModifications = currentMoral - 1;
            
            if (maxModifications <= 0) {
                this.showMessage(_("After losing 1 moral, you would have 0 remaining - no modifications possible"), "error");
                return;
            }
            
            // Update temp moral display (-1 for Ukkiba cost)
            WW_PendingActions.updatePendingMoral(-1);
            
            this.enterDiceModifierPowerMode(cardId, 'ukkiba_power', {
                maxDice: maxModifications,
                requireAtLeastOne: false,
                preventDoubleClick: true,
                message: dojo.string.substitute(_("Ukkiba: -1 moral, then ${max} modifications (LEFT -1, RIGHT +1)"), {max: maxModifications})
            });
        },
        
        /**
         * Waldo power: Ignore 1 green terrain die per missing hordier
         */
        enterWaldoPowerMode: function(cardId) {
            // Waldo: can ignore 1 green die per missing hordier
            var maxIgnore = WW_State.getMissingHordiersCount();
            
            if (maxIgnore === 0) {
                this.showMessage(_("No missing hordiers - cannot ignore any dice"), "error");
                return;
            }
            
            // Check if there are any green dice to ignore
            var greenDiceCount = dojo.query('#ww_wind_dice .ww_dice_green').length;
            if (greenDiceCount === 0) {
                this.showMessage(_("No green terrain dice to ignore"), "error");
                return;
            }
            
            this.enterDiceIgnorePowerMode(cardId, 'waldo_power', {
                maxIgnore: Math.min(maxIgnore, greenDiceCount),
                exactCount: false,
                diceFilter: 'ww_dice_green', // Only green dice
                message: dojo.string.substitute(_("Waldo: Click on green dice to ignore (up to ${max})"), {max: Math.min(maxIgnore, greenDiceCount)})
            });
        },
        
        /**
         * Oranne power: If tile has moral effect, ignore up to 3 challenge dice
         */
        enterOrannePowerMode: function(cardId) {
            // Check if tile has moral effect
            var moralEffect = WW_State.getSelectedTileMoralEffect();
            if (moralEffect == 0) {
                this.showMessage(_("This power only works on tiles with a moral effect"), "error");
                return;
            }
            
            // Check if there are any challenge dice to ignore
            var challengeDiceCount = dojo.query('#ww_wind_dice .ww_dice').length;
            if (challengeDiceCount === 0) {
                this.showMessage(_("No challenge dice to ignore"), "error");
                return;
            }
            
            var maxIgnore = Math.min(3, challengeDiceCount);
            
            this.enterDiceIgnorePowerMode(cardId, 'oranne_power', {
                maxIgnore: maxIgnore,
                exactCount: false,
                diceFilter: null, // All challenge dice
                message: dojo.string.substitute(_("Oranne: Click on challenge dice to ignore (up to ${max})"), {max: maxIgnore})
            });
        },
        
        /**
         * Belkacem power: Set a green terrain die to chosen value
         */
        enterBelkacemPowerMode: function(cardId) {
            this.enterDiceValuePowerMode(cardId, 'belkacem_power', {
                diceContainer: '#ww_wind_dice',
                diceClass: 'ww_dice_green',
                selectMessage: _("Belkacem: Click on a green die to set its value"),
                valueMessage: _("Belkacem: Click a value (1-6) for this die")
            });
        },
        
        /**
         * Make horde dice clickable for modification (Thomassin, Blanchette)
         * Left click = -1, Right click = +1
         */
        makeHordeDiceModifiable: function() {
            var self = this;
            
            WW_DOM.forEach('#ww_horde_dice .ww_dice', function(diceEl) {
                // Only blue dice
                if (!WW_DOM.hasClass(diceEl, 'ww_dice_blue')) return;
                
                WW_DOM.addClass(diceEl, 'ww_dice_modifiable');
                diceEl.onclick = function(evt) {
                    WW_DOM.stopEvent(evt);
                    // Detect click position: left side = -1, right side = +1
                    var rect = diceEl.getBoundingClientRect();
                    var clickX = evt.clientX - rect.left;
                    var isRightSide = clickX > rect.width / 2;
                    self.onModifiableDiceClick(diceEl, isRightSide ? 1 : -1);
                };
            });
        },
        
        onModifiableDiceClick: function(diceEl, clickModifier) {
            var mode = WW_State.getSpecialPowerMode();
            if (!mode) return;
            
            var diceId = diceEl.id.replace('dice_', '');
            var currentMod = mode.dice_modifiers[diceId] || 0;
            // Get the original dice value (before any modifications)
            var originalDiceValue = parseInt(WW_DOM.getAttr(diceEl, 'data-value')) || parseInt(WW_DOM.getHtml(diceEl)) || 1;
            
            if (mode.power_code === 'thomassin_power') {
                // Thomassin: Each die can only have +1 or -1 (toggle based on click side)
                if (currentMod === clickModifier) {
                    // Same side clicked again - remove modifier
                    delete mode.dice_modifiers[diceId];
                    WW_DOM.removeClass(diceEl, 'ww_dice_mod_plus');
                    WW_DOM.removeClass(diceEl, 'ww_dice_mod_minus');
                } else {
                    // Check that final value stays within 1-6
                    var finalValue = originalDiceValue + clickModifier;
                    if (finalValue < 1 || finalValue > 6) {
                        return; // Silently ignore - can't modify beyond dice limits
                    }
                    // Set to clicked modifier (+1 or -1)
                    mode.dice_modifiers[diceId] = clickModifier;
                    WW_DOM.removeClass(diceEl, 'ww_dice_mod_plus');
                    WW_DOM.removeClass(diceEl, 'ww_dice_mod_minus');
                    WW_DOM.addClass(diceEl, clickModifier > 0 ? 'ww_dice_mod_plus' : 'ww_dice_mod_minus');
                }
            } else if (mode.power_code === 'blanchette_power' || mode.power_code === 'ukkiba_power' || mode.power_code === 'xavio_power') {
                // Blanchette/Ukkiba/Xavio: Can stack modifiers, but limited by max_dice (total modifications)
                var totalModifications = 0;
                for (var did in mode.dice_modifiers) {
                    totalModifications += Math.abs(mode.dice_modifiers[did]);
                }
                
                // Check that final value stays within 1-6
                var newMod = currentMod + clickModifier;
                var finalValue = originalDiceValue + newMod;
                if (finalValue < 1 || finalValue > 6) {
                    return; // Silently ignore - can't modify beyond dice limits
                }
                
                // Check if we can add another modification
                if (totalModifications >= mode.max_dice) {
                    // Can only undo existing modifications
                    if (currentMod === 0) {
                        this.showMessage(dojo.string.substitute(_("Maximum ${max} modifications"), {max: mode.max_dice}), "info");
                        return;
                    }
                    // Allow undoing: clicking opposite side reduces modifier
                    if ((clickModifier > 0 && currentMod < 0) || (clickModifier < 0 && currentMod > 0)) {
                        if (newMod === 0) {
                            delete mode.dice_modifiers[diceId];
                        } else {
                            mode.dice_modifiers[diceId] = newMod;
                        }
                        this.updateDiceModifierDisplay(diceEl, mode.dice_modifiers[diceId] || 0);
                        return;
                    }
                    this.showMessage(dojo.string.substitute(_("Maximum ${max} modifications"), {max: mode.max_dice}), "info");
                    return;
                }
                
                
                if (newMod === 0) {
                    delete mode.dice_modifiers[diceId];
                } else {
                    mode.dice_modifiers[diceId] = newMod;
                }
                this.updateDiceModifierDisplay(diceEl, mode.dice_modifiers[diceId] || 0);
            }
        },
        
        /**
         * Update visual display for dice modifier
         */
        updateDiceModifierDisplay: function(diceEl, modifier) {
            WW_DOM.removeClass(diceEl, 'ww_dice_mod_plus');
            WW_DOM.removeClass(diceEl, 'ww_dice_mod_minus');
            WW_DOM.removeClass(diceEl, 'ww_dice_mod_plus2');
            WW_DOM.removeClass(diceEl, 'ww_dice_mod_minus2');
            
            if (modifier > 0) {
                WW_DOM.addClass(diceEl, modifier >= 2 ? 'ww_dice_mod_plus2' : 'ww_dice_mod_plus');
            } else if (modifier < 0) {
                WW_DOM.addClass(diceEl, modifier <= -2 ? 'ww_dice_mod_minus2' : 'ww_dice_mod_minus');
            }
            
            // Update or create modifier badge
            var badgeId = diceEl.id + '_mod_badge';
            var badge = $(badgeId);
            if (modifier !== 0) {
                var badgeText = (modifier > 0 ? '+' : '') + modifier;
                if (!badge) {
                    badge = dojo.create('div', {
                        id: badgeId,
                        className: 'ww_dice_mod_badge',
                        innerHTML: badgeText
                    }, diceEl);
                } else {
                    badge.innerHTML = badgeText;
                }
            } else if (badge) {
                dojo.destroy(badge);
            }
        },
        
        /**
         * Make challenge dice selectable (for Wanda)
         */
        makeChallengeDiceSelectable: function() {
            var self = this;
            
            WW_DOM.forEach('#ww_wind_dice .ww_dice', function(diceEl) {
                WW_DOM.addClass(diceEl, 'ww_dice_selectable');
                diceEl.onclick = function(evt) {
                    WW_DOM.stopEvent(evt);
                    self.onSelectableDiceClick(diceEl);
                };
            });
        },
        
        onSelectableDiceClick: function(diceEl) {
            var mode = WW_State.getSpecialPowerMode();
            if (!mode) {
                // Check Uther mode
                mode = WW_State.getUtherDiceMode();
            }
            if (!mode) return;
            
            var diceId = diceEl.id.replace('dice_', '');
            
            // For Wanda, only allow 1 die
            if (mode.power_code === 'wanda_power') {
                if (WW_DOM.hasClass(diceEl, 'ww_dice_selected')) {
                    mode.selected_dice = [];
                    WW_DOM.removeClass(diceEl, 'ww_dice_selected');
                } else {
                    // Deselect others first
                    WW_DOM.removeClassFromAll('.ww_dice_selected', 'ww_dice_selected');
                    mode.selected_dice = [diceId];
                    WW_DOM.addClass(diceEl, 'ww_dice_selected');
                }
            } else {
                // For Uther, allow multiple up to max
                var idx = mode.selected_dice.indexOf(diceId);
                if (idx >= 0) {
                    mode.selected_dice.splice(idx, 1);
                    WW_DOM.removeClass(diceEl, 'ww_dice_selected');
                } else if (mode.selected_dice.length < mode.max_ignore) {
                    mode.selected_dice.push(diceId);
                    WW_DOM.addClass(diceEl, 'ww_dice_selected');
                }
            }
        },
        
        /**
         * Clean up all power mode UI elements (shared helper)
         */
        cleanupPowerModeUI: function() {
            WW_DOM.removeClassFromAll('.ww_dice_modifiable', 'ww_dice_modifiable');
            WW_DOM.removeClassFromAll('.ww_dice_mod_plus', 'ww_dice_mod_plus');
            WW_DOM.removeClassFromAll('.ww_dice_mod_minus', 'ww_dice_mod_minus');
            WW_DOM.removeClassFromAll('.ww_dice_mod_plus2', 'ww_dice_mod_plus2');
            WW_DOM.removeClassFromAll('.ww_dice_mod_minus2', 'ww_dice_mod_minus2');
            WW_DOM.removeClassFromAll('.ww_dice_selectable', 'ww_dice_selectable');
            WW_DOM.removeClassFromAll('.ww_dice_selected', 'ww_dice_selected');
            // Remove modifier badges
            WW_DOM.forEach('.ww_dice_mod_badge', function(badge) {
                dojo.destroy(badge);
            });
            WW_DOM.forEach('#ww_horde_dice .ww_dice', function(diceEl) {
                diceEl.onclick = null;
            });
            WW_DOM.forEach('#ww_wind_dice .ww_dice', function(diceEl) {
                diceEl.onclick = null;
            });
            // Clean up Ernest tile click handlers (BEFORE removing class so we can find them)
            this.cleanupErnestPowerMode();
        },
        
        /**
         * Restore page title and action buttons after power mode
         */
        restorePowerModeUI: function() {
            if (this.gamedatas.gamestate.descriptionmyturnaliased) {
                this.gamedatas.gamestate.descriptionmyturn = this.gamedatas.gamestate.descriptionmyturnaliased;
            }
            this.updatePageTitle();
            this.removeActionButtons();
            this.onUpdateActionButtons(this.gamedatas.gamestate.name, this.gamedatas.gamestate.args);
        },
        
        /**
         * Save original page title (call before modifying)
         */
        saveOriginalPageTitle: function() {
            if (!this.gamedatas.gamestate.descriptionmyturnaliased) {
                this.gamedatas.gamestate.descriptionmyturnaliased = this.gamedatas.gamestate.descriptionmyturn;
            }
        },
        
        // ============================================================
        // GENERIC POWER HANDLERS - Dice Value Selection (Gianni/Belkacem)
        // ============================================================
        
        /**
         * Enter dice value selection mode (select die then choose 1-6)
         * Used by: Gianni (blue horde dice), Belkacem (green challenge dice)
         */
        enterDiceValuePowerMode: function(cardId, powerCode, config) {
            var self = this;
            
            WW_State.setSpecialPowerMode({
                card_id: cardId,
                power_code: powerCode,
                selected_dice: null,
                step: 'select_dice'
            });
            
            this.saveOriginalPageTitle();
            this.gamedatas.gamestate.descriptionmyturn = config.selectMessage;
            this.updatePageTitle();
            
            // Make dice selectable based on config
            var container = config.diceContainer;
            var diceClass = config.diceClass;
            
            WW_DOM.forEach(container + ' .ww_dice', function(diceEl) {
                if (diceClass && !WW_DOM.hasClass(diceEl, diceClass)) return;
                
                WW_DOM.addClass(diceEl, 'ww_dice_selectable');
                diceEl.onclick = function(evt) {
                    WW_DOM.stopEvent(evt);
                    self.onDiceValuePowerSelect(diceEl, config);
                };
            });
            
            this.removeActionButtons();
            this.addActionButton('btn_cancel_power', _('Cancel'), function() {
                self.cancelSpecialPowerMode();
            }, null, false, 'gray');
        },
        
        /**
         * Handle dice selection in value power mode
         */
        onDiceValuePowerSelect: function(diceEl, config) {
            var self = this;
            var mode = WW_State.getSpecialPowerMode();
            if (!mode) return;
            
            var diceId = diceEl.id.replace('dice_', '');
            mode.selected_dice = diceId;
            mode.step = 'select_value';
            
            WW_DOM.removeClassFromAll('.ww_dice_selected', 'ww_dice_selected');
            WW_DOM.addClass(diceEl, 'ww_dice_selected');
            
            this.gamedatas.gamestate.descriptionmyturn = config.valueMessage;
            this.updatePageTitle();
            this.removeActionButtons();
            
            for (var v = 1; v <= 6; v++) {
                (function(value) {
                    self.addActionButton('btn_value_' + value, value.toString(), function() {
                        self.confirmDiceValuePower(mode.card_id, diceId, value, config);
                    });
                })(v);
            }
            
            this.addActionButton('btn_cancel_power', _('Cancel'), function() {
                self.cancelSpecialPowerMode();
            }, null, false, 'gray');
        },
        
        /**
         * Confirm dice value power (shared by Gianni/Belkacem)
         */
        confirmDiceValuePower: function(cardId, diceId, diceValue, config) {
            var params = { dice_id: parseInt(diceId), dice_value: diceValue };
            WW_PowerMode.exit(this, { params: params, visualEffect: params });
        },
        
        // ============================================================
        // GENERIC POWER HANDLERS - Dice Modifier (Thomassin/Blanchette)
        // ============================================================
        
        /**
         * Enter dice modifier mode (click to toggle +1/-1)
         * Used by: Thomassin (all blue dice), Blanchette (up to X blue dice)
         */
        enterDiceModifierPowerMode: function(cardId, powerCode, config) {
            var self = this;
            
            WW_PowerMode.enter(this, cardId, powerCode, {
                message: config.message,
                extraState: {
                    max_dice: config.maxDice || 999,
                    dice_modifiers: {}
                },
                showConfirm: true,
                confirmLabel: _('Confirm'),
                onConfirm: function() {
                    self.confirmDiceModifierPower(cardId, config);
                }
            });
            
            this.makeHordeDiceModifiable();
        },
        
        /**
         * Confirm dice modifier power (shared by Thomassin/Blanchette)
         */
        confirmDiceModifierPower: function(cardId, config) {
            var mode = WW_State.getSpecialPowerMode();
            if (!mode) return;
            
            var modifiers = [];
            for (var diceId in mode.dice_modifiers) {
                modifiers.push({
                    dice_id: parseInt(diceId),
                    modifier: mode.dice_modifiers[diceId]
                });
            }
            
            if (config.requireAtLeastOne && modifiers.length === 0) {
                this.showMessage(_("You must modify at least one die"), "error");
                return;
            }
            
            if (config.maxDice && modifiers.length > config.maxDice) {
                this.showMessage(dojo.string.substitute(_("You can only modify ${max} dice"), {max: config.maxDice}), "error");
                return;
            }
            
            // Clear mode AFTER validation but BEFORE exit (exit will skip if already cleared)
            // For preventDoubleClick, we clear here AND skip calling exit's clear
            if (config.preventDoubleClick) {
                WW_State.setSpecialPowerMode(null);
            }
            
            var params = { dice_modifiers: modifiers };
            
            // Clean up UI
            this.cleanupPowerModeUI();
            this.restorePowerModeUI();
            
            // Execute the power
            WW_Utils.executePower(this, cardId, params, params);
        },
        
        // ============================================================
        // ERNEST POWER - Place wind force on adjacent tiles
        // ============================================================
        
        /**
         * Get adjacent tiles for a given position (hex grid adjacency)
         * For pointy-top hexes, the 6 adjacent directions are: (1,0), (1,-1), (0,-1), (-1,0), (-1,1), (0,1)
         */
        getAdjacentTilesFromPosition: function(q, r) {
            var directions = [
                {dq: 1, dr: 0}, {dq: 1, dr: -1}, {dq: 0, dr: -1},
                {dq: -1, dr: 0}, {dq: -1, dr: 1}, {dq: 0, dr: 1}
            ];
            var adjacent = [];
            var tiles = this.gamedatas.tiles;
            console.log('[Ernest] getAdjacentTilesFromPosition q,r:', q, r, 'tiles:', tiles);
            
            for (var i = 0; i < directions.length; i++) {
                var nq = q + directions[i].dq;
                var nr = r + directions[i].dr;
                
                // Find tile at this position
                for (var tid in tiles) {
                    var t = tiles[tid];
                    if (parseInt(t.q) === nq && parseInt(t.r) === nr) {
                        adjacent.push(t);
                        break;
                    }
                }
            }
            return adjacent;
        },
        
        /**
         * Get player's current tile from gamedatas
         */
        getPlayerCurrentTile: function() {
            var referenceTile = WW_State.getSelectedTile();
            if (referenceTile) {
                return referenceTile;
            }

            var player = this.gamedatas.players[this.player_id];
            if (!player || player.pos_q === undefined || player.pos_r === undefined) {
                return null;
            }
            var tiles = this.gamedatas.tiles;
            for (var tid in tiles) {
                var t = tiles[tid];
                if (parseInt(t.q) === parseInt(player.pos_q) && parseInt(t.r) === parseInt(player.pos_r)) {
                    return t;
                }
            }
            return null;
        },
        
        /**
         * Enter Ernest power mode (select up to 3 adjacent tiles to place wind on)
         * :tap:: Placez 1 :force-x: sur 3 :tuile: adjacentes.
         */
        enterErnestPowerMode: function(cardId) {
            var self = this;
            const MAX_TILES = 3;
            // Use player's current tile (works before movement selection)
            var referenceTile = this.getPlayerCurrentTile();
            
            // Save currently selectable movement tiles before we modify anything
            var savedMovementTiles = [];
            WW_DOM.forEach('.ww_selectable', function(el) {
                if (el && el.id && el.id.startsWith('tile_')) {
                    savedMovementTiles.push(el.id);
                }
            });

            var adjacent = null;
            if (!adjacent || adjacent.length === 0) {
                // Calculate from reference tile or player position
                // Handle both formats: tile_q/tile_r (from DB) and q/r (from gamedatas)
                if (referenceTile) {
                    var q = parseInt(referenceTile.tile_q !== undefined ? referenceTile.tile_q : referenceTile.q);
                    var r = parseInt(referenceTile.tile_r !== undefined ? referenceTile.tile_r : referenceTile.r);
                    adjacent = this.getAdjacentTilesFromPosition(q, r);
                }
                adjacent = adjacent.filter(function(tile) {
                    var windForce = parseInt(tile.wind_force || 0);
                    return windForce === 0 && tile.type !== 'city';
                });
            }
            
            if (!adjacent || adjacent.length === 0) {
                this.showMessage(_("No adjacent tiles available"), "error");
                return;
            }
            
            WW_PowerMode.enter(this, cardId, 'ernest_power', {
                message: dojo.string.substitute(_("Ernest: Select up to ${max} adjacent tiles to reveal wind force"), { max: MAX_TILES }),
                extraState: { 
                    selected_tiles: [],
                    adjacent_tiles: adjacent,
                    max_tiles: MAX_TILES,
                    saved_movement_tiles: savedMovementTiles
                },
                showConfirm: true,
                confirmLabel: _('Reveal Wind'),
                onConfirm: function() {
                    self.confirmErnestPower(cardId);
                }
            });
            
            // Highlight adjacent tiles
            WW_Hex.highlightTiles(adjacent);
            
            // Make adjacent tiles clickable for Ernest power
            adjacent.forEach(function(tile) {
                var tileId = tile.tile_id || tile.id;
                var tileEl = $('tile_' + tileId);
                if (tileEl) {
                    WW_DOM.addClass(tileEl, 'ww_ernest_selectable');
                    tileEl.ernestClickHandler = function(evt) {
                        WW_DOM.stopEvent(evt);
                        self.onErnestTileClick(tileId);
                    };
                    tileEl.addEventListener('click', tileEl.ernestClickHandler);
                }
            });
        },
        
        /**
         * Handle tile click in Ernest power mode
         */
        onErnestTileClick: function(tileId) {
            var mode = WW_State.getSpecialPowerMode();
            if (!mode || mode.power_code !== 'ernest_power') return;
            
            var tileEl = $('tile_' + tileId);
            if (!tileEl) return;
            
            var idx = mode.selected_tiles.indexOf(tileId);
            
            if (idx >= 0) {
                // Deselect
                mode.selected_tiles.splice(idx, 1);
                WW_DOM.removeClass(tileEl, 'ww_tile_selected');
            } else if (mode.selected_tiles.length < mode.max_tiles) {
                // Select (max 3)
                mode.selected_tiles.push(tileId);
                WW_DOM.addClass(tileEl, 'ww_tile_selected');
            }
            
            var selectedCount = mode.selected_tiles.length;
            if (selectedCount === 0) {
                WW_Utils.setPageTitle(dojo.string.substitute(
                    _("Ernest: Select up to ${max} tiles to reveal wind force"),
                    { max: mode.max_tiles }
                ));
            } else if (selectedCount < mode.max_tiles) {
                WW_Utils.setPageTitle(dojo.string.substitute(
                    _("Ernest: ${count} tile(s) selected. Select more or confirm to reveal wind force"),
                    { count: selectedCount }
                ));
            } else {
                WW_Utils.setPageTitle(dojo.string.substitute(
                    _("Ernest: Ready to reveal wind force on ${max} tiles"),
                    { max: mode.max_tiles }
                ));
            }
        },
        
        /**
         * Confirm Ernest power - place wind on selected tiles
         */
        confirmErnestPower: function(cardId) {
            var mode = WW_State.getSpecialPowerMode();
            console.log('[Ernest] mode:', mode);
            if (!mode || mode.power_code !== 'ernest_power') {
                console.log('[Ernest] ABORT: mode is null or wrong power_code');
                return;
            }
            
            if (mode.selected_tiles.length < 1 || mode.selected_tiles.length > mode.max_tiles) {
                this.showMessage(dojo.string.substitute(_("You must select 1 to ${max} tiles (selected: ${count})"), { max: mode.max_tiles, count: mode.selected_tiles.length }), "error");
                return;
            }
            
            var tileIds = mode.selected_tiles.map(function(id) { return parseInt(id); });
            
            // Clean up power mode
            this.cancelSpecialPowerMode();
            
            // Execute the power
            this.performAction('actUsePower', {
                card_id: parseInt(cardId),
                params: JSON.stringify({ tile_ids: tileIds })
            });
        },
        
        /**
         * Clean up Ernest power mode click handlers
         */
        cleanupErnestPowerMode: function() {
            // Get saved movement tiles before clearing mode
            var mode = WW_State.getSpecialPowerMode();
            var savedMovementTiles = (mode && mode.saved_movement_tiles) ? mode.saved_movement_tiles : [];
            
            // Remove click handlers from ALL ernest-selectable tiles (don't rely on mode state which might be cleared)
            WW_DOM.forEach('.ww_ernest_selectable', function(tileEl) {
                if (tileEl && tileEl.ernestClickHandler) {
                    tileEl.removeEventListener('click', tileEl.ernestClickHandler);
                    delete tileEl.ernestClickHandler;
                }
                // Also remove ww_selectable added by highlightTiles
                WW_DOM.removeClass(tileEl, 'ww_selectable');
            });
            
            WW_DOM.removeClassFromAll('.ww_ernest_selectable', 'ww_ernest_selectable');
            WW_DOM.removeClassFromAll('.ww_tile_selected', 'ww_tile_selected');
            
            // Restore original movement-selectable tiles
            savedMovementTiles.forEach(function(tileElId) {
                var el = $(tileElId);
                if (el) {
                    WW_DOM.addClass(el, 'ww_selectable');
                }
            });
        },
        
        // ============================================================
        // KON POWER - Reroll blue dice
        // ============================================================
        
        /**
         * Enter Kon power mode (select blue dice to reroll)
         * :tap:: Relancez tout ou partie de :d6-blue:
         */
        enterKonPowerMode: function(cardId) {
            var self = this;
            
            // Check if there are any blue dice to reroll
            var blueDice = dojo.query('#ww_horde_dice .ww_dice_blue');
            if (blueDice.length === 0) {
                this.showMessage(_("No blue dice to reroll"), "error");
                return;
            }
            
            WW_PowerMode.enter(this, cardId, 'kon_power', {
                message: _("Kon: Click on blue dice to reroll"),
                extraState: { selected_dice: [] },
                showConfirm: true,
                confirmLabel: _('Reroll Selected'),
                onConfirm: function() {
                    self.confirmKonPower(cardId);
                }
            });
            
            // Make blue horde dice selectable
            WW_PowerMode.makeDiceClickable('#ww_horde_dice .ww_dice_blue', function(diceEl) {
                var mode = WW_State.getSpecialPowerMode();
                if (!mode || mode.power_code !== 'kon_power') return;
                WW_PowerMode.toggleDiceSelection(diceEl, mode.selected_dice, 0); // 0 = unlimited
            });
        },
                
        /**
         * Confirm Kon power - reroll selected blue dice
         */
        confirmKonPower: function(cardId) {
            var mode = WW_State.getSpecialPowerMode();
            if (!mode || mode.power_code !== 'kon_power') return;
            
            if (mode.selected_dice.length === 0) {
                this.showMessage(_("Select at least one die to reroll"), "error");
                return;
            }
            
            var diceIds = mode.selected_dice.map(function(id) { return parseInt(id); });
            
            // Clean up
            this.cancelSpecialPowerMode();
            
            // Remove any pending "rest this card" actions (since we just exhausted it)
            WW_PendingActions.removeActionsTargeting(cardId);
            
            // Kon power modifies dice - MUST execute immediately (like Torantors)
            this.performAction('actUsePower', {
                card_id: parseInt(cardId),
                params: JSON.stringify({ dice_ids: diceIds })
            });
        },
        
        // ============================================================
        // GENERIC POWER HANDLERS - Dice Ignore (Wanda/Waldo)
        // ============================================================
        
        /**
         * Enter dice ignore mode (select challenge dice to ignore)
         * Used by: Wanda (1 die), Waldo (up to X green dice based on missing hordiers)
         */
        enterDiceIgnorePowerMode: function(cardId, powerCode, config) {
            var self = this;
            
            WW_PowerMode.enter(this, cardId, powerCode, {
                message: config.message,
                extraState: {
                    max_ignore: config.maxIgnore,
                    exact_count: config.exactCount || false,
                    dice_filter: config.diceFilter || null,
                    selected_dice: []
                },
                showConfirm: true,
                confirmLabel: _('Confirm'),
                onConfirm: function() {
                    self.confirmDiceIgnorePower(cardId, config);
                }
            });
            
            // Make challenge dice selectable (optionally filtered by class)
            var selector = config.diceFilter 
                ? '#ww_wind_dice .' + config.diceFilter 
                : '#ww_wind_dice .ww_dice';
            
            WW_PowerMode.makeDiceClickable(selector, function(diceEl) {
                var mode = WW_State.getSpecialPowerMode();
                if (!mode) return;
                WW_PowerMode.toggleDiceSelection(diceEl, mode.selected_dice, mode.max_ignore, function() {
                    self.showMessage(dojo.string.substitute(_("Maximum ${max} dice"), {max: mode.max_ignore}), "info");
                });
            });
        },
                
        /**
         * Confirm dice ignore power (shared by Wanda/Waldo)
         */
        confirmDiceIgnorePower: function(cardId, config) {
            var mode = WW_State.getSpecialPowerMode();
            if (!mode) return;
            
            if (config.exactCount && mode.selected_dice.length !== config.maxIgnore) {
                this.showMessage(dojo.string.substitute(_("You must select exactly ${count} dice"), {count: config.maxIgnore}), "error");
                return;
            }
            
            if (mode.selected_dice.length === 0) {
                this.showMessage(_("Select at least one die to ignore"), "error");
                return;
            }
            
            var ignoredDice = mode.selected_dice.map(function(id) { return parseInt(id); });
            
            // Clean up
            this.cancelSpecialPowerMode();
            
            WW_Utils.executePower(this, cardId, { ignored_dice: ignoredDice }, { ignored_dice: ignoredDice });
        },
        
        /**
         * Cancel special power mode
         */
        cancelSpecialPowerMode: function() {
            var mode = WW_State.getSpecialPowerMode();
            // Restore temp moral if Ukkiba was cancelled
            if (mode && mode.power_code === 'ukkiba_power') {
                WW_PendingActions.updatePendingMoral(1);
            }
            this.cleanupErnestPowerMode();            
            WW_PowerMode.exit(this);
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
            
            // Make highlighted targets clickable (including exhausted cards for Vera)
            this.makeTargetsClickable(function(targetCardId) {
                self.onUsePower(targetCardId);
            });
            
            // Update action bar with power-specific message
            this.saveOriginalPageTitle();
            this.gamedatas.gamestate.descriptionmyturn = this.getPowerTargetMessage(powerCode);
            this.updatePageTitle();
            
            // Remove existing buttons and add cancel button (use dojo.connect for proper binding)
            this.removeActionButtons();
            this.addActionButton('btn_cancel_power', _('Cancel'), null, null, false, 'gray');
            var self = this;
            dojo.connect($('btn_cancel_power'), 'onclick', this, function() {
                self.cancelPowerTargetMode();
            });
        },
        
        /**
         * Make cards with ww_power_target class clickable
         */
        makeTargetsClickable: function(onTargetClick) {
            WW_DOM.forEach('.ww_power_target', function(cardEl) {
                var cardId = cardEl.id.replace('ww_horde_item_', '');
                // Connect click handler (will override existing if any)
                WW_DOM.connectWithId(cardEl.id, 'onclick', null, function(evt) {
                    WW_DOM.stopEvent(evt);
                    onTargetClick(cardId);
                });
            });
        },
        
        /**
         * Get message for power target selection
         */
        getPowerTargetMessage: function(powerCode) {
            switch (powerCode) {
                case 'vera_power':
                    return _("Vera: Click on an exhausted Hordier to rest");
                case 'uther_power':
                    return _("Uther: Click on a Hordier to sacrifice (-3 per missing Hordier)");
                case 'zaffa_power':
                    return _("Zaffa: Click on another Torantor to rest");
                case 'kyo_power':
                    return _("Kyo: Click on another Torantor to rest");
                case 'dragon_power':
                    return _("Dragon: Click on a Hordier to exhaust");
                default:
                    return _("Click on a target");
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
            
            // Get protected cards (like Regitha after using her power)
            var protectedCards = WW_State.getProtectedCards();
            
            switch (powerCode) {
                case 'vera_power':
                    // Vera can rest any other exhausted Hordier (except protected)
                    for (var cardId in WW_State.getHordeCards()) {
                        if (cardId == sourceCardId) continue;
                        if (protectedCards.indexOf(parseInt(cardId)) !== -1) continue;  // Skip protected cards
                        WW_DOM.addClass('ww_horde_item_' + cardId, 'ww_power_target');
                    }
                    break;
                    
                case 'uther_power':
                case 'dragon_power':
                    // Uther/Dragon can target any other Hordier (except protected like Regitha)
                    for (var cardId in WW_State.getHordeCards()) {
                        if (cardId == sourceCardId) continue;
                        if (protectedCards.indexOf(parseInt(cardId)) !== -1) continue;  // Skip protected cards
                        WW_DOM.addClass('ww_horde_item_' + cardId, 'ww_power_target');
                    }
                    break;
                    
                case 'zaffa_power':
                case 'kyo_power':
                    // Zaffa/Kyo can rest another Torantor (except protected, must be exhausted)
                    var otherTorantors = this.otherTorantor(sourceCardId);
                    var hordeCards = WW_State.getHordeCards();
                    for (var i = 0; i < otherTorantors.length; i++) {
                        var cardId = otherTorantors[i];
                        if (protectedCards.indexOf(parseInt(cardId)) !== -1) continue;  // Skip protected cards
                        // Only allow targeting exhausted Torantors (the power is to rest them)
                        var card = hordeCards[cardId];
                        if (!WW_Utils.isCardExhausted(cardId, card)) continue;
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
            
            // Update local moral immediately for Dragon (+DRAGON_MORAL_INCREASE capped at 9)
            // This makes the moral available for subsequent powers like Ukkiba
            if (powerCode === 'dragon_power') {
                var currentMoral = WW_State.getPlayerMoral(this.player_id);
                if (currentMoral === undefined) {
                    currentMoral = parseInt((this.gamedatas.players[this.player_id] || {}).moral) || 0;
                }
                WW_State.setPlayerMoral(this.player_id, Math.min(MAX_MORAL, currentMoral + DRAGON_MORAL_INCREASE));
            }
            
            // Check if we're in pending actions mode (during confrontation)
            var params = {
                target_card_id: parseInt(targetCardId)
            };
            
            if (WW_PendingActions.isActive()) {
                // Add to pending actions with target
                WW_PendingActions.push('usePower', {
                    card_id: parseInt(sourceCardId),
                    target_card_id: parseInt(targetCardId)
                }, params);
            } else {
                // Outside confrontation - send directly to server
                this.performAction('actUsePower', {
                    card_id: parseInt(sourceCardId),
                    target_card_id: parseInt(targetCardId)
                });
            }
            
            // Exit target mode
            this.cancelPowerTargetMode();
        },
        
        /**
         * Enter Uther's dice selection mode after sacrificing a hordier
         */
        enterUtherDiceSelectionMode: function(sourceCardId, targetCardId) {
            var self = this;
            
            // Uther: can ignore 3 dice per missing hordier (including the one being sacrificed)
            var missingCount = WW_State.getMissingHordiersCount(-1); // -1 for the sacrifice
            var maxIgnore = 3 * missingCount;
            
            // Store state for dice selection
            WW_State.setUtherDiceMode({
                source_card_id: sourceCardId,
                target_card_id: targetCardId,
                max_ignore: maxIgnore,
                selected_dice: []
            });
            
            // Set special power mode to prevent updateDiceResultButtons from interfering
            WW_State.setSpecialPowerMode({
                type: 'uther_dice_selection',
                source_card_id: sourceCardId,
                target_card_id: targetCardId
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
            
            // Disable horde cards during dice selection
            WW_Cards.clearHordeUsable();
            
            // Make challenge dice clickable
            this.makeChallengeDiceSelectable();
            
            // Update action buttons
            this.removeActionButtons();
            this.gamedatas.gamestate.descriptionmyturn = dojo.string.substitute(_("Uther: Click on challenge dice to ignore (up to ${max})"), {max: maxIgnore});
            this.updatePageTitle();
            this.addActionButton('btn_confirm_uther', dojo.string.substitute(_("Confirm (${count}/${max} dice)"), {count: 0, max: maxIgnore}), function() {
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
                diceEl.onclick = function(evt) {
                    WW_DOM.stopEvent(evt);
                    self.onChallengeDiceClick(diceEl.id.replace('dice_', ''));
                };
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
            
            // Remove ww_dice_ignored ONLY from dice selected by Uther (cancel means they shouldn't be ignored)
            if (mode.selected_dice && mode.selected_dice.length > 0) {
                mode.selected_dice.forEach(function(diceId) {
                    var diceEl = $('dice_' + diceId);
                    if (diceEl) {
                        WW_DOM.removeClass(diceEl, 'ww_dice_ignored');
                    }
                });
            }
            
            // Clean up (without removing ww_dice_ignored - we already did it selectively above)
            this.cleanUpUtherDiceMode();
            
            // Update preview since dice are no longer ignored
            WW_Dice.updateConfrontationPreview();
            
            // Restore normal action buttons
            this.restoreConfrontationButtons();
        },
        
        /**
         * Clean up Uther dice selection mode (just removes selectable styling and click handlers)
         */
        cleanUpUtherDiceMode: function() {
            // Remove dice selection styling and click handlers
            // Don't touch ww_dice_ignored - it's handled by the caller (confirm/cancel)
            dojo.query('#ww_wind_dice .ww_dice').forEach(function(diceEl) {
                WW_DOM.removeClass(diceEl, 'ww_dice_selectable');
                diceEl.onclick = null;
            });
            
            // Clear special power mode to allow updateDiceResultButtons to work
            WW_State.setSpecialPowerMode(null);
            
            // Clear state
            WW_State.clearUtherDiceMode();
        },
        
        /**
         * Restore confrontation action buttons
         */
        restoreConfrontationButtons: function() {
            var self = this;
            
            // Re-enable horde cards for power usage
            WW_Cards.makeHordeUsable(function(cardId) {
                self.onUsePower(cardId);
            });
            
            // Restore full dice result buttons (with moral, undo, etc.)
            this.updateDiceResultButtons();
        },
        
        /**
         * Validate power target selection
         */
        validatePowerTarget: function(sourceCardId, powerCode, targetCardId) {
            switch (powerCode) {
                case 'vera_power':
                    if (targetCardId == sourceCardId) {
                        this.showMessage(_("Vera cannot rest herself"), "error");
                        return false;
                    }
                    if (!WW_Utils.isCardExhausted(targetCardId, WW_State.getHordeCard(targetCardId))) {
                        this.showMessage(_("This Hordier is not exhausted"), "error");
                        return false;
                    }
                    return true;
                    
                case 'kyo_power':
                case 'zaffa_power':
                    if (targetCardId == sourceCardId) {
                        this.showMessage(_("Cannot target self"), "error");
                        return false;
                    }
                    if (!WW_Utils.isCardExhausted(targetCardId, WW_State.getHordeCard(targetCardId))) {
                        this.showMessage(_("This Torantor is not exhausted"), "error");
                        return false;
                    }
                    return true;
                    
                case 'uther_power':
                    if (targetCardId == sourceCardId) {
                        this.showMessage(_("Uther cannot sacrifice himself"), "error");
                        return false;
                    }
                    return true;
                    
                case 'dragon_power':
                    if (targetCardId == sourceCardId) {
                        this.showMessage(_("Dragon cannot exhaust himself"), "error");
                        return false;
                    }
                    if (WW_Utils.isCardExhausted(targetCardId, WW_State.getHordeCard(targetCardId))) {
                        this.showMessage(_("This Hordier is already exhausted"), "error");
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
            
            // Restore original page title and action buttons
            this.restorePowerModeUI();
        },
        
        onConfirmDraft: function(evt) {
            WW_DOM.stopEvent(evt);
            this.performAction('actConfirmDraft', {});
        },
        
        onAbandonHordier: function(cardId) {
            this.performAction('actAbandonHordier', { card_id: parseInt(cardId) });
        },
        
        onSelectHordierToRest: function(cardId) {
            this.performAction('actSelectHordierToRest', { card_id: parseInt(cardId) });
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
            WW_Cards.sortHordeDisplay();
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
            
            dojo.subscribe('cardProtected', this, "notif_cardProtected");
            
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
            
            dojo.subscribe('hordierExhausted', this, "notif_hordierExhausted");
            this.notifqueue.setSynchronous('hordierExhausted', 500);
            
            dojo.subscribe('allHordiersRested', this, "notif_allHordiersRested");
            this.notifqueue.setSynchronous('allHordiersRested', 500);
            
            dojo.subscribe('powerUsed', this, "notif_powerUsed");
            this.notifqueue.setSynchronous('powerUsed', 500);
            
            dojo.subscribe('hordierDiscarded', this, "notif_hordierDiscarded");
            this.notifqueue.setSynchronous('hordierDiscarded', 500);
            
            dojo.subscribe('challengeDiceModified', this, "notif_challengeDiceModified");
            this.notifqueue.setSynchronous('challengeDiceModified', 500);
            
            dojo.subscribe('diceIgnored', this, "notif_diceIgnored");
            this.notifqueue.setSynchronous('diceIgnored', 500);
            
            dojo.subscribe('lyaraPowerUsed', this, "notif_lyaraPowerUsed");
            this.notifqueue.setSynchronous('lyaraPowerUsed', 500);
            
            dojo.subscribe('windForceChanged', this, "notif_windForceChanged");
            this.notifqueue.setSynchronous('windForceChanged', 500);
            
            dojo.subscribe('ernestWindPlaced', this, "notif_ernestWindPlaced");
            this.notifqueue.setSynchronous('ernestWindPlaced', 500);
            
            dojo.subscribe('lihnPowerActivated', this, "notif_lihnPowerActivated");
            this.notifqueue.setSynchronous('lihnPowerActivated', 500);
            
            dojo.subscribe('blueDiceRerolled', this, "notif_blueDiceRerolled");
            this.notifqueue.setSynchronous('blueDiceRerolled', 1000);

            dojo.subscribe('selectedDiceRerolled', this, "notif_selectedDiceRerolled");
            this.notifqueue.setSynchronous('selectedDiceRerolled', 1000);
            
            dojo.subscribe('challengeDiceAdded', this, "notif_challengeDiceAdded");
            this.notifqueue.setSynchronous('challengeDiceAdded', 500);
            
            dojo.subscribe('chapterDraftRecruit', this, "notif_chapterDraftRecruit");
            this.notifqueue.setSynchronous('chapterDraftRecruit', 500);
            
            dojo.subscribe('chapterDraftComplete', this, "notif_chapterDraftComplete");
            this.notifqueue.setSynchronous('chapterDraftComplete', 500);
            
            dojo.subscribe('newDay', this, "notif_newDay");
            this.notifqueue.setSynchronous('newDay', 300);
            
            dojo.subscribe('extraDiceRolled', this, "notif_extraDiceRolled");
            this.notifqueue.setSynchronous('extraDiceRolled', 500);
            
            dojo.subscribe('diceModified', this, "notif_diceModified");
            this.notifqueue.setSynchronous('diceModified', 300);
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
        
        // Extra dice rolled (e.g., Torantor powers) - adds to existing dice, doesn't clear
        notif_extraDiceRolled: function(notif) {
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
        
        // Dice modified by power (e.g., Thomassin/Blanchette ±1)
        notif_diceModified: function(notif) {
            // Handle single dice modification (old format)
            if (notif.args.dice_id !== undefined && notif.args.new_value !== undefined) {
                WW_Dice.updateDiceValue(notif.args.dice_id, notif.args.new_value);
            }
            
            // Handle multiple dice modifications (Thomassin, Blanchette)
            if (notif.args.dice_modifiers && Array.isArray(notif.args.dice_modifiers)) {
                notif.args.dice_modifiers.forEach(function(mod) {
                    var diceEl = WW_DOM.get('ww_dice_' + mod.dice_id);
                    if (diceEl) {
                        var currentValue = parseInt(diceEl.getAttribute('data-value') || MIN_DICE);
                        var newValue = Math.max(MIN_DICE, Math.min(MAX_DICE, currentValue + mod.modifier));
                        WW_Dice.updateDiceValue(mod.dice_id, newValue);
                    }
                });
            }
            
            WW_Dice.updateConfrontationPreview();
        },
        
        notif_windRevealed: function(notif) {
            WW_Hex.revealWindToken(notif.args.tile_id, notif.args.force);
            WW_Dice.clearDice('wind');
            
            // Store wind force for powers that need it
            WW_State.setWindForce(notif.args.force || 0);
            
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
                        // Update both display AND data-value attribute
                        WW_DOM.setData(diceEl, 'value', dice.dice_value);
                        WW_DOM.setHtml(diceEl, dice.dice_value);
                    }
                }
                // Refresh the confrontation preview with updated values
                WW_Dice.updateConfrontationPreview();
            }
            
            // Re-apply ignored dice visual (from Uther/Waldo/Wanda powers)
            if (notif.args.ignored_dice && notif.args.ignored_dice.length > 0) {
                for (var i = 0; i < notif.args.ignored_dice.length; i++) {
                    var diceEl = $('dice_' + notif.args.ignored_dice[i]);
                    if (diceEl) {
                        WW_DOM.addClass(diceEl, 'ww_dice_ignored');
                    }
                }
                WW_Dice.updateConfrontationPreview();
            }
            
            // Update moral display
            if (notif.args.new_moral !== undefined) {
                WW_Player.updateMoral(notif.args.player_id, notif.args.new_moral);
            }
            
            // Only disable pending mode if we're leaving confrontation
            // (when andConfirm=1 was used, the game will transition state)
            // Keep it enabled if we're staying in diceResult for more actions
            if (!notif.args.stay_in_confrontation) {
                WW_PendingActions.disable();
            } else {
                // Clear without disabling - allows new actions
                WW_PendingActions.clear();
                // Re-enable with current state if needed
                if (this.gamedatas && this.gamedatas.gamestate && this.gamedatas.gamestate.name === 'diceResult') {
                    var currentState = this.buildPendingActionsState();
                    if (currentState) {
                        WW_PendingActions.enable(currentState);
                    }
                }
            }
        },
        
        notif_playerSurpasses: function(notif) {
            var current = WW_Player.getCurrentDiceCount(notif.args.player_id);
            WW_Player.updateDiceCount(notif.args.player_id, current - 1);
        },
        
        notif_playerRests: function(notif) {
            var diceCount = notif.args.dice_count - notif.args.surpass_count;
            WW_Player.updateDiceCount(notif.args.player_id, diceCount);
            
            // Update rest counter if provided
            if (notif.args.rest_count !== undefined) {
                var restCountEl = dojo.query('#rest_counter_' + notif.args.player_id + ' .ww_rest_count')[0];
                if (restCountEl) {
                    restCountEl.textContent = notif.args.rest_count;
                }
            }
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
                WW_Cards.sortHordeDisplay();
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
                WW_Cards.sortHordeDisplay();
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
                var isExhausted = parseInt(notif.args.card.card_power_used || 0, 10) === 1;
                WW_Cards.createCard({
                    prefix: 'recruit_card',
                    card: notif.args.card,
                    containerId: 'ww_available_characters',
                    extraClass: 'ww_recruit_card' + (isExhausted ? ' ww_card_exhausted' : ''),
                    onClick: function(cid) {
                        self.onRecruitCard(parseInt(cid, 10));
                    }
                });
            }
        },
        
        notif_cardProtected: function(notif) {
            WW_State.addProtectedCard(notif.args.card_id);
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
            
            // Update player positions and reset dice (surpass is reset at chapter start)
            var players = notif.args.players;
            for (var player_id in players) {
                var player = players[player_id];
                WW_Hex.movePlayerToken(this, player_id, player.pos_q, player.pos_r);
                // Reset dice count to max (surpass is 0 at chapter start)
                var diceCount = (player.dice_count || DEFAULT_DICE_COUNT) - (player.surpass || 0);
                WW_Player.updateDiceCount(player_id, diceCount);
            }
            
            // Center map on current player
            setTimeout(function() {
                self.centerMapOnPlayer(players);
            }, 500);
            
            // Update chapter number in state and UI
            WW_State.chapter = notif.args.chapter_num;
            WW_Player.updateChapter(notif.args.chapter_num);
            WW_Player.updateDay(1, null);  // Reset chapter day to 1 (keep total unchanged)
            
            // Update PAR for the new chapter
            if (notif.args.chapter_par) {
                WW_DOM.setHtml('ww_chapter_par_value', notif.args.chapter_par);
            }
        },
        
        notif_newDay: function(notif) {
            WW_Player.updateDay(notif.args.chapter_day, notif.args.total_days);
        },
        
        notif_moralChanged: function(notif) {
            // Handle both 'moral' and 'new_moral' for compatibility
            var newMoral = notif.args.new_moral || notif.args.moral;
            WW_Player.updateMoral(notif.args.player_id, newMoral);
            
            // Update WW_PendingActions.originalState.moral so computed state is accurate
            if (notif.args.player_id == this.player_id && 
                WW_PendingActions.isActive() && 
                WW_PendingActions.originalState) {
                WW_PendingActions.originalState.moral = newMoral;
            }
        },
        
        notif_hordierRested: function(notif) {
            WW_Cards.setCardRested(notif.args.card_id, true);
            WW_Utils.updateCardPowerState(notif.args.card_id, false);
        },
        
        notif_hordierExhausted: function(notif) {
            WW_Cards.setCardRested(notif.args.card_id, false);
            WW_Utils.updateCardPowerState(notif.args.card_id, true);
        },
        
        notif_allHordiersRested: function(notif) {
            var exceptCardId = notif.args.except_card_id;
            WW_Cards.setAllCardsRested(notif.args.player_id, exceptCardId);
            
            // Update all horde cards (except excluded one)
            var hordeCards = WW_State.getHordeCards();
            for (var cardId in hordeCards) {
                if (exceptCardId && parseInt(cardId) === parseInt(exceptCardId)) {
                    continue;
                }
                WW_Utils.updateCardPowerState(cardId, false);
            }
            
            // Re-enable card clicking for the active player
            if (this.isCurrentPlayerActive()) {
                var self = this;
                WW_Cards.makeHordeUsable(function(cardId) {
                    self.onUsePower(cardId);
                });
            }
        },
        
        notif_blueDiceRerolled: function(notif) {
            // Remove only blue dice from UI (keep violet dice)
            dojo.query('#ww_horde_dice .ww_dice_blue').forEach(function(diceEl) {
                WW_DOM.destroy(diceEl);
            });
            
            // Add new blue dice
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
            
            // Sort all dice in container
            WW_Dice.sortDiceInContainer('ww_horde_dice');
            WW_Dice.updateConfrontationPreview();
            
            // Animate the new dice
            var animationDelay = 0;
            sortedDice.forEach(function(dice) {
                setTimeout(function() {
                    var diceEl = $('dice_' + dice.id);
                    if (diceEl) WW_Dice.animateDiceRoll(diceEl, dice.value);
                }, animationDelay);
                animationDelay += 100;
            });
        },
        
        // Kon power: reroll only selected dice (not all blue dice)
        notif_selectedDiceRerolled: function(notif) {
            var self = this;
            
            // Remove only the specific selected dice
            var removedIds = notif.args.removed_dice_ids || [];
            removedIds.forEach(function(diceId) {
                var diceEl = $('dice_' + diceId);
                if (diceEl) {
                    WW_DOM.destroy(diceEl);
                }
            });
            
            // Add new dice
            var newDice = notif.args.new_dice || [];
            var sortedDice = newDice.slice().sort(function(a, b) {
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
            
            // Sort all dice and update preview
            WW_Dice.sortDiceInContainer('ww_horde_dice');
            WW_Dice.updateConfrontationPreview();
            
            // Animate the new dice
            var animationDelay = 0;
            sortedDice.forEach(function(dice) {
                setTimeout(function() {
                    var diceEl = $('dice_' + dice.id);
                    if (diceEl) WW_Dice.animateDiceRoll(diceEl, dice.value);
                }, animationDelay);
                animationDelay += 100;
            });
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
            // Restore full confrontation UI (buttons + horde cards clickable)
            this.restoreConfrontationButtons();
        },
        
        notif_lyaraPowerUsed: function(notif) {
            // Mark Lyara as exhausted (she has her own notification)
            if (notif.args.card_id) {
                WW_Cards.setCardRested(notif.args.card_id, false);
                WW_Utils.updateCardPowerState(notif.args.card_id, true);
            }
            
            // Mark ignored dice visually (same as diceIgnored)
            var ignoredDice = notif.args.ignored_dice || [];
            for (var i = 0; i < ignoredDice.length; i++) {
                var diceEl = $('dice_' + ignoredDice[i]);
                if (diceEl) {
                    WW_DOM.addClass(diceEl, 'ww_dice_ignored');
                }
            }
            WW_Dice.updateConfrontationPreview();
            // Restore full confrontation UI (buttons + horde cards clickable)
            this.restoreConfrontationButtons();
        },
        
        notif_windForceChanged: function(notif) {
            // Update wind force display and remove the sacrificed card
            var tile_id = notif.args.tile_id;
            var new_force = notif.args.new_force;
            var card_id = notif.args.card_id;
            
            // Update wind force in state (use setter so getWindForce() returns correct value)
            WW_State.setWindForce(new_force);
            
            // Update UI - wind force display in dice panel
            var windForceEl = $('ww_wind_force');
            if (windForceEl) {
                windForceEl.innerHTML = new_force;
            }
            
            // Update wind token on the tile (on the map) - only for Jonas (permanent change)
            if (tile_id && notif.args.update_tile) {
                WW_Hex.updateWindToken(tile_id, new_force);
            }
            
            // Remove the sacrificed card from horde (animated)
            WW_Cards.removeHordeCard(card_id, true);
            
            // Update confrontation preview
            WW_Dice.updateConfrontationPreview();
        },
        
        notif_ernestWindPlaced: function(notif) {
            // Ernest's power: place wind force on multiple adjacent tiles
            var placed_tiles = notif.args.placed_tiles || [];
            
            // Update wind tokens on each target tile
            placed_tiles.forEach(function(tileData) {
                var tile_id = tileData.tile_id;
                var force = tileData.force;
                WW_Hex.updateWindToken(tile_id, force);
                // Mark tile as discovered
                var tileEl = $('tile_' + tile_id);
                if (tileEl) {
                    WW_DOM.addClass(tileEl, 'ww_discovered');
                }
            });
        },
        
        notif_lihnPowerActivated: function(notif) {
            // Lihn's power: double points this turn (visual feedback only)
            // Card removal is handled by hordierLost notification
            console.log('Lihn power activated - points doubled this turn');
        },
        
        notif_challengeDiceAdded: function(notif) {
            // Add a new challenge die (from Belkacem's power)
            var dice = notif.args.dice;
            if (dice) {
                WW_Dice.createDice({
                    dice_id: dice.id,
                    dice_type: dice.type,
                    dice_value: dice.value
                }, 'ww_wind_dice');
            }
            WW_Dice.updateConfrontationPreview();
        },
        
        notif_powerUsed: function(notif) {
            WW_Cards.setCardRested(notif.args.card_id, false);
            WW_Utils.updateCardPowerState(notif.args.card_id, true);
        },
        
        notif_hordierDiscarded: function(notif) {
            // Remove the card from the horde visually with animation
            WW_Cards.removeHordeCard(notif.args.card_id, true);
        }
   });
});
