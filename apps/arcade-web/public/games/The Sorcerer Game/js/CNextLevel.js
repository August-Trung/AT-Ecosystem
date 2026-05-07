function CNextLevel(){
    var _oBg;
    var _oMsgText;
    var _oMsgTextBack;
    var _oScoreText;
    var _oScoreTextBack;
    var _oGroup;
    
    this._init = function(){
        _oBg = createBitmap(s_oSpriteLibrary.getSprite('msg_box'));

        _oMsgTextBack = new createjs.Text("LEVEL 2","48px "+FONT_GAME, "#000");
        _oMsgTextBack.x = CANVAS_WIDTH/2 +32;
        _oMsgTextBack.y = (CANVAS_HEIGHT/2) - 70;
        _oMsgTextBack.textAlign = "center";

        _oMsgText = new createjs.Text("LEVEL 2","48px "+FONT_GAME, "#ffffff");
        _oMsgText.x = CANVAS_WIDTH/2 + 30;
        _oMsgText.y = (CANVAS_HEIGHT/2) - 72;
        _oMsgText.textAlign = "center";
        
        _oScoreTextBack = new createjs.Text("SCORE 99999","34px "+FONT_GAME, "#000");
        _oScoreTextBack.x = CANVAS_WIDTH/2 +32;
        _oScoreTextBack.y = (CANVAS_HEIGHT/2) + 12;
        _oScoreTextBack.textAlign = "center";

        _oScoreText = new createjs.Text("SCORE 99999","34px "+FONT_GAME, "#ffffff");
        _oScoreText.x = CANVAS_WIDTH/2 +30;
        _oScoreText.y = (CANVAS_HEIGHT/2) + 10;
        _oScoreText.textAlign = "center";
        
        _oGroup = new createjs.Container();
        _oGroup.alpha = 0;
        _oGroup.visible=false;
        
        _oGroup.addChild(_oBg,_oMsgTextBack,_oMsgText,_oScoreTextBack,_oScoreText);

        s_oStage.addChild(_oGroup);
    };
    
    this.show = function(iLevel,iScore){
        _oMsgTextBack.text = TEXT_LEVEL + " "+ iLevel;
        _oMsgText.text = TEXT_LEVEL + " "+ iLevel;
        
        _oScoreTextBack.text = TEXT_SCORE +" "+ iScore;
        _oScoreText.text = TEXT_SCORE +" "+ iScore;
        
        _oGroup.visible = true;
        
        var oParent = this;
        createjs.Tween.get(_oGroup).to({alpha:1 }, 500).call(function() {oParent._initListener();});
    };
    
    this._initListener = function(){
        _oGroup.on("mousedown",this._onExit);
        $(s_oMain).trigger("show_interlevel_ad");
    };
    
    this._onExit = function(){
        _oGroup.off("mousedown");
        _oGroup.alpha = 0;
        _oGroup.visible = false;
        s_oGame.nextLevel();
    };
    
    this._init();
}