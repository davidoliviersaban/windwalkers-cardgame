# Windwalkers.js Refactoring Guide

This document outlines the code redundancies identified and the refactoring approach following **TIDY principles** (small, incremental, behavior-preserving changes).

## Summary of Changes Made

### 1. New Utility Modules Added

#### `WW_Utils` (lines ~15-175)

Common utilities for shared patterns:

- `resolvePendingActions(gameInstance, callback, commitOnly)` - Handles pending action commit/send pattern
- `updateCardPowerState(cardId, isExhausted)` - Updates card state in WW_State and WW_PendingActions
- `isCardExhausted(cardId, card)` - Checks card exhaustion with CSS fallback
- `executePower(gameInstance, cardId, params, visualEffect)` - Queue or execute power action
- `addConfrontationButtons(gameInstance, windDice)` - Standard confrontation buttons (moral+/-, undo, confirm)

#### `WW_PendingActions` additions

- `isActive()` - Safe check replacing redundant `isEnabled && isEnabled()` pattern

#### `WW_PowerMode` (lines ~1445-1600)

Power mode UI helpers:

- `enter(gameInstance, cardId, powerCode, config)` - Standard power mode setup
- `exit(gameInstance, config)` - Cleanup and optionally execute
- `makeDiceClickable(selector, handler)` - Make dice interactive
- `toggleDiceSelection(diceEl, selectedArray, maxCount, onMaxReached)` - Multi-select dice
- `createWindForceButtons(gameInstance, onSelect)` - Buttons for 1-6 selection
- `createValueButtons(gameInstance, onSelect)` - Value selection buttons 1-6

### 2. Notification Handlers Refactored

**Before** (~70 lines):

```javascript
notif_hordierRested: function(notif) {
    WW_Cards.setCardRested(notif.args.card_id, true);
    var card = WW_State.getHordeCard(notif.args.card_id);
    if (card) {
        card.power_used = 0;
        card.powerUsed = false;
        card.card_power_used = 0;
    }
    if (WW_PendingActions.isEnabled && WW_PendingActions.isEnabled() && WW_PendingActions.originalState && WW_PendingActions.originalState.horde) {
        var cardId = notif.args.card_id;
        if (WW_PendingActions.originalState.horde[cardId]) {
            WW_PendingActions.originalState.horde[cardId].power_used = 0;
            WW_PendingActions.originalState.horde[cardId].powerUsed = false;
            WW_PendingActions.originalState.horde[cardId].card_power_used = 0;
        }
    }
}
```

**After** (~5 lines):

```javascript
notif_hordierRested: function(notif) {
    WW_Cards.setCardRested(notif.args.card_id, true);
    WW_Utils.updateCardPowerState(notif.args.card_id, false);
}
```

### 3. Power Handler Refactored (Jonas example)

**Before** (~50 lines):

```javascript
enterJonasPowerMode: function(cardId) {
    var self = this;
    WW_State.setSpecialPowerMode({ card_id: cardId, power_code: 'jonas_power' });
    this.saveOriginalPageTitle();
    this.gamedatas.gamestate.descriptionmyturn = _("Jonas: Click a button...");
    this.updatePageTitle();
    this.removeActionButtons();
    for (var force = 1; force <= 6; force++) { ... }
    this.addActionButton('btn_cancel_power', ...);
}
confirmJonasPower: function(windForce) {
    // ~35 lines of pending action handling
}
```

**After** (~15 lines):

```javascript
enterJonasPowerMode: function(cardId) {
    var self = this;
    WW_PowerMode.enter(this, cardId, 'jonas_power', {
        message: _("Jonas: Click a button to set wind force (1-6)")
    });
    this.removeActionButtons();
    WW_PowerMode.createWindForceButtons(this, function(force) {
        self.confirmJonasPower(force);
    });
    this.addActionButton('btn_cancel_power', ...);
}
confirmJonasPower: function(windForce) {
    var mode = WW_State.getSpecialPowerMode();
    if (!mode || mode.power_code !== 'jonas_power') return;
    ...
    WW_Utils.resolvePendingActions(this, function() { ... }, true);
}
```

---

## Remaining Refactoring Opportunities

### Priority 1: Power Handlers (High Impact) ✅ COMPLETED

The following generic handlers now use `WW_PowerMode`:

| Function                     | Status | Notes                                                                             |
| ---------------------------- | ------ | --------------------------------------------------------------------------------- |
| `enterDiceModifierPowerMode` | ✅     | Now uses `WW_PowerMode.enter()`                                                   |
| `enterDiceIgnorePowerMode`   | ✅     | Now uses `WW_PowerMode.enter()` + `makeDiceClickable()` + `toggleDiceSelection()` |
| `enterKonPowerMode`          | ✅     | Now uses `WW_PowerMode.enter()` + `makeDiceClickable()` + `toggleDiceSelection()` |
| `onKonDiceClick`             | ✅     | **Removed** - inlined using `toggleDiceSelection()`                               |
| `onDiceIgnorePowerClick`     | ✅     | **Removed** - inlined using `toggleDiceSelection()`                               |

All powers that use these generic handlers automatically benefit:

- Thomassin, Blanchette, Xavio, Ukkiba → via `enterDiceModifierPowerMode`
- Wanda, Waldo, Oranne → via `enterDiceIgnorePowerMode`

**Refactored pattern for dice selection powers:**

```javascript
enterXxxPowerMode: function(cardId) {
    var self = this;
    WW_PowerMode.enter(this, cardId, 'xxx_power', {
        message: _("Xxx: Select dice..."),
        extraState: { selected_dice: [] },
        showConfirm: true,
        confirmLabel: _('Confirm'),
        onConfirm: function() { self.confirmXxx(cardId); }
    });
    WW_PowerMode.makeDiceClickable('#container .ww_dice', function(diceEl) {
        var mode = WW_State.getSpecialPowerMode();
        WW_PowerMode.toggleDiceSelection(diceEl, mode.selected_dice, maxCount);
    });
}
```

### Priority 2: Target Validation (Medium Impact)

The `validatePowerTarget()` function has repeated exhausted checks. Use `WW_Utils.isCardExhausted()`:

**Before** (in each case):

```javascript
case 'vera_power':
    var card = WW_State.getHordeCard(targetCardId);
    var isExhausted = card && (card.powerUsed || card.power_used || parseInt(card.card_power_used) === 1);
    // Check pending state...
    // Check CSS classes...
```

**After:**

```javascript
case 'vera_power':
    if (!WW_Utils.isCardExhausted(targetCardId, WW_State.getHordeCard(targetCardId))) {
        this.showMessage(_("This Hordier is not exhausted"), "error");
        return false;
    }
    return true;
```

### Priority 3: `highlightPowerTargets()` (Medium Impact)

Repeated loop patterns for checking Torantor cards:

```javascript
// Extract to WW_Utils
WW_Utils.findTorantorCards: function(excludeCardId) {
    var results = [];
    var hordeCards = WW_State.getHordeCards();
    for (var cardId in hordeCards) {
        if (cardId == excludeCardId) continue;
        var card = hordeCards[cardId];
        var typeArg = card ? card.type : null;
        var charInfo = typeArg ? WW_State.getCharacter(typeArg) : null;
        if (charInfo && charInfo.name && charInfo.name.indexOf('Torantor') !== -1) {
            results.push(cardId);
        }
    }
    return results;
}
```

### Priority 4: Dice Notification Handlers (Lower Impact)

Several notification handlers have similar dice animation patterns:

```javascript
// Extract to WW_Dice
WW_Dice.animateDiceSequence: function(diceArray, container, onClick) {
    var sortedDice = diceArray.slice().sort(function(a, b) {
        return (a.value || 0) - (b.value || 0);
    });

    sortedDice.forEach(function(dice) {
        WW_Dice.createDice({
            dice_id: dice.id,
            dice_type: dice.type,
            dice_value: dice.value
        }, container, onClick);
    });

    var animationDelay = 0;
    sortedDice.forEach(function(dice) {
        setTimeout(function() {
            var diceEl = $('dice_' + dice.id);
            if (diceEl) WW_Dice.animateDiceRoll(diceEl, dice.value);
        }, animationDelay);
        animationDelay += 100;
    });
}
```

Then `notif_diceRolled`, `notif_extraDiceRolled`, `notif_blueDiceRerolled`, `notif_selectedDiceRerolled` become:

```javascript
notif_diceRolled: function(notif) {
    WW_Dice.clearDice('horde');
    var self = this;
    WW_Dice.animateDiceSequence(notif.args.dice, 'ww_horde_dice', function(diceId) {
        self.onDiceClick(diceId);
    });
    WW_Dice.updateConfrontationPreview();
}
```

---

## Line Count Impact

| Change                                      | Lines Saved        |
| ------------------------------------------- | ------------------ |
| Notification handlers refactored            | ~45 lines          |
| Jonas power refactored                      | ~35 lines          |
| ✅ Dice modifier/ignore handlers refactored | ~65 lines          |
| ✅ WW_PendingActions.isActive() pattern     | ~13 lines          |
| ✅ WW_PowerMode.exit() pattern              | ~25 lines          |
| ✅ WW_Utils.addConfrontationButtons()       | ~30 lines          |
| ✅ confirmDukePower simplified              | ~25 lines          |
| If target validation consolidated           | ~50 lines          |
| Dice notification consolidation             | ~80 lines          |
| **Total potential**                         | **~500-600 lines** |

**Current file: ~6093 lines** (down from original ~6529, saved ~436 lines, ~6.7%)

---

## Testing Checklist

After each refactoring step, verify:

1. [ ] Draft phase works (card selection, confirmation)
2. [ ] Confrontation phase works (dice roll, powers, moral)
3. [ ] Each refactored power handler:
   - [x] Jonas (wind force selection)
   - [x] Kon (dice reroll) - refactored
   - [x] Thomassin/Blanchette (dice modifiers) - via refactored `enterDiceModifierPowerMode`
   - [x] Wanda/Waldo/Oranne (dice ignore) - via refactored `enterDiceIgnorePowerMode`
   - [ ] Gianni/Belkacem (dice value set)
   - [ ] Vera/Uther (target selection)
4. [ ] Pending actions system (undo, commit, batch)
5. [ ] Notifications update UI correctly

---

## Architecture Notes

The code follows a layered architecture:

```
WW_DOM      - Low-level DOM manipulation (dojo wrapper)
    ↓
WW_State    - State management (selected tile, horde cards, etc.)
    ↓
WW_Utils    - Common patterns (power execution, card state)
    ↓
WW_PowerMode - Power UI patterns (enter/exit, dice selection)
    ↓
WW_Cards/WW_Dice/WW_Hex/WW_Player - Domain modules
    ↓
Game Instance - BGA framework integration
```

Each module should only call modules above it in the hierarchy.
