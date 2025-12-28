<?php
/**
 *------
 * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
 * Windwalkers implementation : © David Saban davidolivier.saban@gmail.com
 * -----
 *
 * windwalkers.action.php
 *
 * Windwalkers main action entry point
 */

class action_windwalkers extends APP_GameAction
{
    // Constructor: please do not modify
    public function __default()
    {
        if ($this->isArg('notifwindow')) {
            $this->view = "common_notifwindow";
            $this->viewArgs['table'] = $this->getArg("table", AT_posint, true);
        } else {
            $this->view = "windwalkers_windwalkers";
            $this->trace("Complete reridge of windwalkers.action");
        }
    }

    //////////////////////////////////////////////////////////////////////////////
    //////////// Draft actions
    ////////////

    public function actSelectCharacter()
    {
        $this->setAjaxMode();
        
        $character_id = $this->getArg("character_id", AT_posint, true);
        
        $this->game->actSelectCharacter($character_id);
        
        $this->ajaxResponse();
    }

    public function actUnselectCharacter()
    {
        $this->setAjaxMode();
        
        $character_id = $this->getArg("character_id", AT_posint, true);
        
        $this->game->actUnselectCharacter($character_id);
        
        $this->ajaxResponse();
    }

    public function actConfirmDraft()
    {
        $this->setAjaxMode();
        
        $this->game->actConfirmDraft();
        
        $this->ajaxResponse();
    }

    //////////////////////////////////////////////////////////////////////////////
    //////////// Movement actions
    ////////////

    public function actSelectTile()
    {
        $this->setAjaxMode();
        
        $tile_id = $this->getArg("tile_id", AT_posint, true);
        
        $this->game->actSelectTile($tile_id);
        
        $this->ajaxResponse();
    }

    //////////////////////////////////////////////////////////////////////////////
    //////////// Confrontation actions
    ////////////

    public function actRollDice()
    {
        $this->setAjaxMode();
        
        $this->game->actRollDice();
        
        $this->ajaxResponse();
    }

    public function actUseMoral()
    {
        $this->setAjaxMode();
        
        $dice_id = $this->getArg("dice_id", AT_posint, true);
        $modifier = $this->getArg("modifier", AT_int, true);
        
        $this->game->actUseMoral($dice_id, $modifier);
        
        $this->ajaxResponse();
    }

    public function actConfirmRoll()
    {
        $this->setAjaxMode();
        
        $this->game->actConfirmRoll();
        
        $this->ajaxResponse();
    }

    public function actSurpass()
    {
        $this->setAjaxMode();
        
        $this->game->actSurpass();
        
        $this->ajaxResponse();
    }

    //////////////////////////////////////////////////////////////////////////////
    //////////// Turn actions
    ////////////

    public function actEndTurn()
    {
        $this->setAjaxMode();
        
        $this->game->actEndTurn();
        
        $this->ajaxResponse();
    }

    public function actRest()
    {
        $this->setAjaxMode();
        
        $this->game->actRest();
        
        $this->ajaxResponse();
    }

    //////////////////////////////////////////////////////////////////////////////
    //////////// Village/City actions
    ////////////

    public function actRecruit()
    {
        $this->setAjaxMode();
        
        $character_id = $this->getArg("character_id", AT_posint, true);
        
        $this->game->actRecruit($character_id);
        
        $this->ajaxResponse();
    }

    public function actSkipRecruit()
    {
        $this->setAjaxMode();
        
        $this->game->actSkipRecruit();
        
        $this->ajaxResponse();
    }

    //////////////////////////////////////////////////////////////////////////////
    //////////// Power actions
    ////////////

    public function actUsePower()
    {
        $this->setAjaxMode();
        
        $character_id = $this->getArg("character_id", AT_posint, true);
        $target_id = $this->getArg("target_id", AT_posint, false);
        
        $this->game->actUsePower($character_id, $target_id);
        
        $this->ajaxResponse();
    }

    public function actCancelPower()
    {
        $this->setAjaxMode();
        
        $this->game->actCancelPower();
        
        $this->ajaxResponse();
    }

    //////////////////////////////////////////////////////////////////////////////
    //////////// Debug actions (only in dev mode)
    ////////////

    public function actDebugSetMoral()
    {
        $this->setAjaxMode();
        
        $moral = $this->getArg("moral", AT_posint, true);
        
        $this->game->debug_setMoral($moral);
        
        $this->ajaxResponse();
    }
}
