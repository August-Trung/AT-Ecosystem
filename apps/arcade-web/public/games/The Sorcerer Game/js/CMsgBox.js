function CMsgBox(szMsg,szButLeftText,szButCenterText,szButRightText){
    var _aCbCompleted;
    var _aCbOwner;
    
    var _oMsgText;
    var _oButLeft;
    var _oButCenter;
    var _oButRight;
    var _oContainer;
    
    this._init = function(szMsg,szButLeftText,szButCenterText,szButRightText){
        _aCbCompleted=new Array();
        _aCbOwner =new Array();
        
        _oContainer = new createjs.Container();
        s_oStage.addChild(_oContainer);
        
        var oBg = createBitmap(s_oSpriteLibrary.getSprite('msg_box'));
        _oContainer.addChild(oBg);
        
        _oMsgText = new createjs.Text("","24px "+FONT_GAME, "#fff");
        _oMsgText.textAlign = "center";
        _oMsgText.textBaseline = "alphabetic";
        _oMsgText.lineWidth = 220;
        _oMsgText.x = CANVAS_WIDTH/2 + 20;
        _oMsgText.y = 250;
        _oContainer.addChild(_oMsgText);
                                                               
        _oButLeft = new CTextButton( (CANVAS_WIDTH/2) - 100,CANVAS_HEIGHT -150,s_oSpriteLibrary.getSprite('but_generic_small'),"LEFT",FONT_GAME,"#ffffff",30,_oContainer);
        _oButLeft.addEventListener(ON_MOUSE_UP, this._onButLeftDownRelease, this);
        
        _oButCenter = new CTextButton(CANVAS_WIDTH/2,CANVAS_HEIGHT -150,s_oSpriteLibrary.getSprite('but_generic_small'),"CENTER",FONT_GAME,"#ffffff",30,_oContainer);
        _oButCenter.addEventListener(ON_MOUSE_UP, this._onButCenterDownRelease, this);
        
        _oButRight = new CTextButton((CANVAS_WIDTH/2) + 90,CANVAS_HEIGHT -150,s_oSpriteLibrary.getSprite('but_generic_small'),"LEFT",FONT_GAME,"#ffffff",30,_oContainer);
        _oButRight.addEventListener(ON_MOUSE_UP, this._onButRightDownRelease, this);
        
        this.show(szMsg,szButLeftText,szButCenterText,szButRightText);
    };
    
    this.show = function(szMsg,szButLeftText,szButCenterText,szButRightText){
        _oMsgText.text = szMsg;
        if(szButLeftText !== ""){
            _oButLeft.changeText(szButLeftText);
            _oButLeft.setVisible(true);
        }else{
            _oButLeft.setVisible(false);
        }
        
        if(szButCenterText !== ""){
            _oButCenter.changeText(szButCenterText);
            _oButCenter.setVisible(true);
        }else{
           _oButCenter.setVisible(false); 
        }
        
        if(szButRightText !== ""){
            _oButRight.changeText(szButRightText);
            _oButRight.setVisible(true);
        }else{
            _oButRight.setVisible(false);
        }
    };
    
    this.hide = function(){
        this.unload();
       s_oStage.removeChild(_oContainer);
    };
    
    this.unload = function(){
        _oButLeft.unload();
        _oButCenter.unload();
        _oButRight.unload();
    };
    
    this.addEventListener = function( iEvent,cbCompleted, cbOwner ){
        _aCbCompleted[iEvent]=cbCompleted;
        _aCbOwner[iEvent] = cbOwner; 
    };
    
    this._onButLeftDownRelease = function(){
        if(_aCbCompleted[ON_MSG_BOX_LEFT_BUT]){
            _aCbCompleted[ON_MSG_BOX_LEFT_BUT].call(_aCbOwner[ON_MSG_BOX_LEFT_BUT]);
            _oContainer.visible = false;
        }
    };
    
    this._onButCenterDownRelease = function(){
        if(_aCbCompleted[ON_MSG_BOX_CENTER_BUT]){
            _aCbCompleted[ON_MSG_BOX_CENTER_BUT].call(_aCbOwner[ON_MSG_BOX_CENTER_BUT]);
            _oContainer.visible = false;
        }
    };
    
    this._onButRightDownRelease = function(){
        if(_aCbCompleted[ON_MSG_BOX_RIGHT_BUT]){
            _aCbCompleted[ON_MSG_BOX_RIGHT_BUT].call(_aCbOwner[ON_MSG_BOX_RIGHT_BUT]);
            _oContainer.visible = false;
        }
    };
    
    this._init(szMsg,szButLeftText,szButCenterText,szButRightText);
}