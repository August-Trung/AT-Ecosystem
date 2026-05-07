function CEndPanel(oSpriteBg){
    
    var _oBg;
    var _oScoreTextBack;
    var _oScoreText;
    var _oMsgText;
    var _oMsgTextBack;
    var _oGroup;
    
    this._init = function(oSpriteBg){
        
        _oBg = createBitmap(oSpriteBg);

        _oMsgTextBack = new createjs.Text(TEXT_CONGRATS,"28px "+FONT_GAME, "#000");
        _oMsgTextBack.x = CANVAS_WIDTH/2 + 22;
        _oMsgTextBack.y = (CANVAS_HEIGHT/2)-68;
        _oMsgTextBack.textAlign = "center";

        _oMsgText = new createjs.Text(TEXT_CONGRATS,"28px "+FONT_GAME, "#ffffff");
        _oMsgText.x = CANVAS_WIDTH/2 + 20;
        _oMsgText.y = (CANVAS_HEIGHT/2)-70;
        _oMsgText.textAlign = "center";
        
        _oScoreTextBack = new createjs.Text(TEXT_FINAL_SCORE + "\n99999","32px "+FONT_GAME, "#000");
        _oScoreTextBack.x = CANVAS_WIDTH/2 +21;
        _oScoreTextBack.y = (CANVAS_HEIGHT/2)+11;
        _oScoreTextBack.textAlign = "center";
        
        _oScoreText = new createjs.Text(TEXT_FINAL_SCORE + "\n99999","32px "+FONT_GAME, "#ffffff");
        _oScoreText.x = CANVAS_WIDTH/2 + 20;
        _oScoreText.y = (CANVAS_HEIGHT/2)+10;
        _oScoreText.textAlign = "center";
        
        _oGroup = new createjs.Container();
        _oGroup.alpha = 0;
        _oGroup.visible=false;
        
        _oGroup.addChild(_oBg, _oScoreTextBack,_oScoreText,_oMsgTextBack,_oMsgText);

        s_oStage.addChild(_oGroup);
    };
    
    this.unload = function(){
        _oGroup.off("mousedown",this._onExit);
        s_oStage.removeChild(_oGroup);
    };
    
    this._initListener = function(){
        _oGroup.on("mousedown",this._onExit);
        $(s_oMain).trigger("show_interlevel_ad");
    };
    
    this.show = function(iScore,bWin){
        if(bWin){
            _oMsgTextBack.text = TEXT_CONGRATS;
            _oMsgText.text = TEXT_CONGRATS;
        }else{
            _oMsgTextBack.text = TEXT_GAMEOVER;
            _oMsgText.text = TEXT_GAMEOVER;
        }
        _oScoreTextBack.text = TEXT_FINAL_SCORE+"\n "+iScore;
        _oScoreText.text = TEXT_FINAL_SCORE+"\n "+iScore;
        _oGroup.visible = true;
        
        var oParent = this;
        createjs.Tween.get(_oGroup).to({alpha:1 }, 500).call(function() {oParent._initListener();});
        
        $(s_oMain).trigger("save_score",iScore);
    };
    
    this._onExit = function(){
        _oGroup.off("mousedown");
        s_oGame.onExit();
    };
    
    this._init(oSpriteBg);
    
    return this;
}