{OVERALL_GAME_HEADER}

<!-- 
--------
-- BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
-- Windwalkers implementation : © David Saban davidolivier.saban@gmail.com
-- -----
-- windwalkers_windwalkers.tpl
--
-- This is the HTML template of your game.
--------
-->

<div id="ww_game_area">
    
    <!-- Main game area: Confrontation + Map + Horde (vertical layout) -->
    <div id="ww_main_area">
        
        <!-- Dice panel (Confrontation) -->
        <div id="ww_dice_panel">
            <h3>{CONFRONTATION}
                <div id="ww_info_panel">
                    <div id="ww_wind_force_display">
                        <label>{WIND_FORCE}:</label>
                        <span id="ww_wind_force">-</span>
                    </div>
                </div>
            </h3>
            
            <div class="ww_dice_row">
                <!-- Wind Dice Column -->
                <div class="ww_dice_section">
                    <h4>{WIND_DICE}</h4>
                    <div id="ww_wind_dice">
                        <!-- Wind dice will appear here -->
                    </div>
                    <span id="ww_wind_sum" class="ww_dice_sum"></span>
                </div>
                
                <!-- Horde Dice Column -->
                <div class="ww_dice_section">
                    <h4>{HORDE_DICE}</h4>
                    <div id="ww_horde_dice">
                        <!-- Blue dice will appear here -->
                    </div>
                    <span id="ww_horde_sum" class="ww_dice_sum"></span>
                </div>
                
                <!-- Confrontation result preview -->
                <div id="ww_confrontation_preview">
                    <div id="ww_sum_comparison">
                        <span id="ww_preview_status"></span>
                    </div>
                    <div id="ww_matching_details"></div>
                </div>
            </div>
        </div>
        
        <!-- Hex Map with Scrollmap -->
        <div id="ww_map_container">
            <div id="ww_map_scrollable">
                <!-- Tiles will be placed here dynamically -->
            </div>
            <div id="ww_map_surface"></div>
            <div id="ww_map_scrollable_oversurface">
                <!-- Player tokens will be placed here -->
            </div>
        </div>
        
        <!-- Horde panel (player's characters) -->
        <div id="ww_horde_panel">
            <h3>{MY_HORDE}</h3>
            <div id="ww_horde">
                <!-- Character cards will be placed here -->
            </div>
        </div>
        
    </div>
    
    <!-- Draft panel (hidden by default, shown during draft phase) -->
    <div id="ww_draft_panel" style="display: none;">
        <h3>{DRAFT_HORDE}</h3>
        
        <div class="ww_draft_requirements">
            <div class="ww_requirement" id="req_traceur">
                {TRACEUR}: <span id="count_traceur">0</span>/1
            </div>
            <div class="ww_requirement" id="req_fer">
                {FER}: <span id="count_fer">0</span>/2
            </div>
            <div class="ww_requirement" id="req_pack">
                {PACK}: <span id="count_pack">0</span>/3
            </div>
            <div class="ww_requirement" id="req_traine">
                {TRAINE}: <span id="count_traine">0</span>/2
            </div>
        </div>
        
        <h4>Available Characters</h4>
        <div id="ww_available_characters">
            <!-- Available characters for draft -->
        </div>
        
        <h4>Your Selection</h4>
        <div id="ww_draft_selected">
            <!-- Selected characters for draft -->
        </div>
    </div>
    
</div>

<script type="text/javascript">

// Javascript HTML templates

/*
// Character card template
var jstpl_character_card = '<div id="character_${id}" class="ww_character_card" data-type="${type}" style="background-image: url(\'${url}\');"></div>';

// Dice template  
var jstpl_dice = '<div id="dice_${id}" class="ww_dice ww_dice_${type}" data-value="${value}">${value}</div>';

// Wind token template
var jstpl_wind_token = '<div class="ww_wind_token ww_wind_${force}">${display}</div>';

// Tile template
var jstpl_tile = '<div id="tile_${id}" class="ww_tile ww_tile_${type} ww_tile_${subtype}" style="left:${x}px; top:${y}px;"><div class="ww_tile_name">${name}</div></div>';

// Player token template
var jstpl_player_token = '<div id="player_token_${id}" class="ww_player_token" style="left:${x}px; top:${y}px; background-color:#${color};"></div>';
*/

</script>

{OVERALL_GAME_FOOTER}
