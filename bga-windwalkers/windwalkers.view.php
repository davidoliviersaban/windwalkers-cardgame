<?php
/**
 *------
 * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
 * Windwalkers implementation : © David Saban davidolivier.saban@gmail.com
 * -----
 *
 * windwalkers.view.php
 *
 * This is your "view" file.
 */

require_once(APP_BASE_PATH . "view/common/game.view.php");

class view_windwalkers_windwalkers extends game_view
{
    protected function getGameName()
    {
        return "windwalkers";
    }

    function build_page($viewArgs)
    {
        // Get players & players number
        $players = $this->game->loadPlayersBasicInfos();
        $players_nbr = count($players);

        /*********** Place your code below:  ************/

        // Translation strings
        $this->tpl['MY_HORDE'] = $this->_("My Horde");
        $this->tpl['HORDE_DICE'] = $this->_("Horde Dice");
        $this->tpl['WIND_DICE'] = $this->_("Wind Dice");
        $this->tpl['WIND_FORCE'] = $this->_("Wind Force");
        $this->tpl['CONFRONTATION'] = $this->_("Confrontation");
        $this->tpl['CURRENT_CHAPTER'] = $this->_("Current Chapter");
        $this->tpl['DRAFT_HORDE'] = $this->_("Draft Your Horde");
        $this->tpl['REQUIREMENTS'] = $this->_("Requirements");
        $this->tpl['TRACEUR'] = $this->_("Traceur");
        $this->tpl['FER'] = $this->_("Fer");
        $this->tpl['PACK'] = $this->_("Pack");
        $this->tpl['TRAINE'] = $this->_("Traîne");

        /*********** Do not change anything below this line  ************/
    }
}
