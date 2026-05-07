function CInterface(iScore){
    var _pStartPosAudio;
    var _pStartPosExit;
    var _pStartPosScore;
    var _pStartPosLevel;
	
    var _oLevelText;
    var _oScoreText;
    var _oButExit;
    var _oHitArea;
    var _oAudioToggle;
    var _oEndPanel;
    var _oNextLevelPanel;
    
    this._init = function(iScore){
        _pStartPosScore = {x:10,y:10};
        _oScoreText = new createjs.Text(TEXT_SCORE +" "+iScore,"38px "+FONT_GAME, "#fff");
        _oScoreText.x = _pStartPosScore.x;
        _oScoreText.y = _pStartPosScore.y;
        _oScoreText.textAlign = "left";
        s_oStage.addChild(_oScoreText);
        
        _pStartPosLevel = {x:10,y:50};
        _oLevelText = new createjs.Text(TEXT_LEVEL +" "+s_iLastLevel,"30px "+FONT_GAME, "#fff");
        _oLevelText.x = _pStartPosLevel.x;
        _oLevelText.y = _pStartPosLevel.y;
        _oLevelText.textAlign = "left";
        s_oStage.addChild(_oLevelText);
        
        var oParent = this;
	_oHitArea = createBitmap(s_oSpriteLibrary.getSprite('hit_area'));
        s_oStage.addChild(_oHitArea);
	_oHitArea.on("pressup",function(evt){oParent._onTapScreen(evt.stageX,evt.stageY)}); 
        
        var oSprite = s_oSpriteLibrary.getSprite('but_exit');
	_pStartPosExit = {x:CANVAS_WIDTH - (oSprite.width/2) ,y:(oSprite.height/2) };
        _oButExit = new CGfxButton(_pStartPosExit.x,_pStartPosExit.y,oSprite,true);
        _oButExit.addEventListener(ON_MOUSE_UP, this._onExit, this);
        
        if(DISABLE_SOUND_MOBILE === false || s_bMobile === false){
            _pStartPosAudio = {x:_oButExit.getX() - oSprite.width,y:(oSprite.height/2)}
            _oAudioToggle = new CToggle(_pStartPosAudio.x,_pStartPosAudio.y,s_oSpriteLibrary.getSprite('audio_icon'),s_bAudioActive);
            _oAudioToggle.addEventListener(ON_MOUSE_UP, this._onAudioToggle, this);
        }
        
        _oNextLevelPanel = new CNextLevel();
        _oEndPanel = new CEndPanel(s_oSpriteLibrary.getSprite('msg_box'));
		
	this.refreshButtonPos(s_iOffsetX,s_iOffsetY);		
    };
    
    this.unload = function(){
        _oButExit.unload();
        _oButExit = null;

        if(DISABLE_SOUND_MOBILE === false){
            _oAudioToggle.unload();
            _oAudioToggle = null;
        }

        s_oStage.removeAllChildren();
	s_oInterface = null;
    };
	
    this.refreshButtonPos = function(iNewX,iNewY){
        _oScoreText.x = _pStartPosScore.x + iNewX;
        _oScoreText.y = _pStartPosScore.y + iNewY;
        _oLevelText.x = _pStartPosLevel.x + iNewX;
        _oLevelText.y = _pStartPosLevel.y + iNewY;
        
        _oButExit.setPosition(_pStartPosExit.x - iNewX,_pStartPosExit.y + iNewY);
        if(DISABLE_SOUND_MOBILE === false || s_bMobile === false){
                _oAudioToggle.setPosition(_pStartPosAudio.x - iNewX,iNewY + _pStartPosAudio.y);
        }

    };
    
    this._onTapScreen = function(iX,iY){
        s_oGame.onShot(iX,iY);
    };
    
    this.gameOver = function(iScore){
        _oEndPanel.show(iScore,false);
    };
    
    this.win = function(iScore){
        _oEndPanel.show(iScore,true);
    };
    
    this.nextLevel = function(iLevel,iScore){
        _oNextLevelPanel.show(iLevel,iScore);
    };
    
    this.refreshScore = function(iScore){
        _oScoreText.text = TEXT_SCORE +" "+iScore;
    };
    
    this.refreshLevel = function(iLevel){
        _oLevelText.text = TEXT_LEVEL + " " + iLevel;
    };
    
    this._onExit = function(){
        s_oGame.onExit();  
    };
    
    this._onAudioToggle = function(){
        createjs.Sound.setMute(s_bAudioActive);
	s_bAudioActive = !s_bAudioActive;
    };

    s_oInterface = this;
    
    this._init(iScore);
    
    return this;
}

var s_oInterface = null;