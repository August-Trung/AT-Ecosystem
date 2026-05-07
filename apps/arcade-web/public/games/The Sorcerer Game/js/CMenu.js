function CMenu(){
    var _pStartPosAudio;
	var _pStartPosCredits;
	
    var _oBg;
    var _oButPlay;
    var _oButContinue = null;
    var _oAudioToggle;
	var _oButCredits;
    var _oFade;
    
    this._init = function(){
        _oBg = createBitmap(s_oSpriteLibrary.getSprite('bg_menu'));
	s_oStage.addChild(_oBg);
	
        if(s_iLastLevel === 1){
            _oButPlay = new CGfxButton((CANVAS_WIDTH/2),CANVAS_HEIGHT -120,s_oSpriteLibrary.getSprite('but_play'),true);
            _oButPlay.addEventListener(ON_MOUSE_UP, this._onButPlayRelease, this);
        }else{
            _oButPlay = new CGfxButton((CANVAS_WIDTH/2) - 150,CANVAS_HEIGHT -120,s_oSpriteLibrary.getSprite('but_play'),true);
            _oButPlay.addEventListener(ON_MOUSE_UP, this._onButPlayRelease, this);
            
            _oButContinue = new CGfxButton((CANVAS_WIDTH/2) + 150,CANVAS_HEIGHT -120,s_oSpriteLibrary.getSprite('but_continue'),true);
            _oButContinue.addEventListener(ON_MOUSE_UP, this._onButContinueRelease, this);
        }
        if(DISABLE_SOUND_MOBILE === false || s_bMobile === false){
            var oSprite = s_oSpriteLibrary.getSprite('audio_icon');
            _pStartPosAudio = {x: CANVAS_WIDTH - (oSprite.height/2), y: (oSprite.height/2)};      
            _oAudioToggle = new CToggle(_pStartPosAudio.x,_pStartPosAudio.y,oSprite,s_bAudioActive);
            _oAudioToggle.addEventListener(ON_MOUSE_UP, this._onAudioToggle, this);

            s_oSoundtrack = playSound("soundtrack",1,-1);
        }
		
		var oSprite = s_oSpriteLibrary.getSprite('but_credits');
		_pStartPosCredits = {x:(oSprite.height/2) + 10,y:(oSprite.height/2) + 10};
		_oButCredits = new CGfxButton(_pStartPosCredits.x,_pStartPosCredits.y,oSprite,s_oStage);
		_oButCredits.addEventListener(ON_MOUSE_UP, this._onButCreditsRelease, this);
			
        _oFade = new createjs.Shape();
        _oFade.graphics.beginFill("black").drawRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT);
        
        s_oStage.addChild(_oFade);
        
        createjs.Tween.get(_oFade).to({alpha:0}, 400).call(function(){_oFade.visible = false;}); 

	this.refreshButtonPos(s_iOffsetX,s_iOffsetY);		
    };
    
    this.unload = function(){
        _oButPlay.unload(); 
        _oButPlay = null;
		_oButCredits.unload();
        
        if(_oButContinue !== null){
            _oButContinue.unload();
        }
        
        if(DISABLE_SOUND_MOBILE === false || s_bMobile === false){
            _oAudioToggle.unload();
            _oAudioToggle = null;
        }
        
        s_oStage.removeChild(_oBg);
        _oBg = null;
        
        s_oStage.removeChild(_oFade);
        _oFade = null;
	s_oMenu = null;
    };
	
    this.refreshButtonPos = function(iNewX,iNewY){
        if(DISABLE_SOUND_MOBILE === false || s_bMobile === false){
                _oAudioToggle.setPosition(_pStartPosAudio.x - iNewX,iNewY + _pStartPosAudio.y);
        }
		_oButCredits.setPosition(_pStartPosCredits.x + iNewX,_pStartPosCredits.y + iNewY);
    };
    
    this._exitFromMenu = function(){
        this.unload();
        s_oMain.gotoLevelMenu();
        $(s_oMain).trigger("start_session");
    };
    
    this._onButPlayRelease = function(){
        if(s_iLastLevel > 1){
            var oMsgBox = new CMsgBox(TEXT_DELETE_SAVINGS,TEXT_NO,"",TEXT_YES);
            oMsgBox.addEventListener(ON_MSG_BOX_LEFT_BUT,function(){oMsgBox.hide();}, this);
            oMsgBox.addEventListener(ON_MSG_BOX_RIGHT_BUT,function(){oMsgBox.hide();s_oMain.clearLocalStorage();s_oMenu._exitFromMenu();}, this);
        }else{
            s_oMenu._exitFromMenu();
        }
    };
    
    this._onButContinueRelease = function(){
        s_oMenu._exitFromMenu();
    };
	
	this._onButCreditsRelease = function(){
        new CCreditsPanel();
    };

    this._onAudioToggle = function(){
        createjs.Sound.setMute(s_bAudioActive);
	s_bAudioActive = !s_bAudioActive;
    };
    
    s_oMenu = this;
	
    this._init();
}

var s_oMenu = null;