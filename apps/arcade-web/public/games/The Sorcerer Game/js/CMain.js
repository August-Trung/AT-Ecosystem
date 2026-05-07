function CMain(oData){
    var _bUpdate;
    var _iCurResource = 0;
    var RESOURCE_TO_LOAD = 0;
    var _iState = STATE_LOADING;
    
    var _oData;
    var _oPreloader;
    var _oMenu;
    var _oLevelMenu;
    var _oHelp;
    var _oGame;

    this.initContainer = function(){
        var canvas = document.getElementById("canvas");
        s_oStage = new createjs.Stage(canvas);       
        createjs.Touch.enable(s_oStage);
        
        s_bMobile = jQuery.browser.mobile;
        if(s_bMobile === false){
            s_oStage.enableMouseOver(20);  
        }
        
        
        s_iPrevTime = new Date().getTime();

        createjs.Ticker.setFPS(35);

        createjs.Ticker.on("tick",this._update);
        
        if(navigator.userAgent.match(/Windows Phone/i)){
            DISABLE_SOUND_MOBILE = true;
        }
		
        s_oSpriteLibrary  = new CSpriteLibrary();

        this.loadLocalStorage();
        
        //ADD PRELOADER
        _oPreloader = new CPreloader();
    };
    
    this.loadLocalStorage = function(){
        var szFlag = localStorage.getItem("sorcerer_level");
        if(szFlag !== null && szFlag !== undefined){
            s_iLastLevel = parseInt(localStorage.getItem("sorcerer_level"));
        }else{
            localStorage.setItem("sorcerer_level", 1);
        }
    };
    
    this.setLocalStorageLevel = function(iLevel){
        if(s_iLastLevel < iLevel){
            s_iLastLevel = iLevel;
            localStorage.setItem("sorcerer_level", s_iLastLevel);
        }
    };
    
    this.setLocalStorageScore = function(iCurScore,iTotScore,iLevel){
        localStorage.setItem("score_level_"+iLevel, iCurScore);
    };
    
    this.clearLocalStorage = function(){
        s_iLastLevel = 1;
        localStorage.clear();
    };
    
    this.getScoreTillLevel = function(iLevel){
        var iScore = 0;
        for(var i=0;i<iLevel-1;i++){
            iScore += parseInt(localStorage.getItem("score_level_"+(i+1) ));
        }
        
        return iScore;
    };
    
    this.preloaderReady = function(){
        if(DISABLE_SOUND_MOBILE === false || s_bMobile === false){
            this._initSounds();
        }
        
        this._loadImages();
        _bUpdate = true;
    };
    
    this.soundLoaded = function(){
        _iCurResource++;
        var iPerc = Math.floor(_iCurResource/RESOURCE_TO_LOAD *100);

        _oPreloader.refreshLoader(iPerc);
        if(_iCurResource === RESOURCE_TO_LOAD){
            this._allResourcesLoaded();
        }
    };
    
    this._initSounds = function(){
         if (!createjs.Sound.initializeDefaultPlugins()) {
             return;
         }
	
        if(navigator.userAgent.indexOf("Opera")>0 || navigator.userAgent.indexOf("OPR")>0){
                createjs.Sound.alternateExtensions = ["mp3"];
                createjs.Sound.addEventListener("fileload", createjs.proxy(this.soundLoaded, this));

                createjs.Sound.registerSound("./sounds/press_but.ogg", "press_but");
                createjs.Sound.registerSound("./sounds/win.ogg", "win");
                createjs.Sound.registerSound("./sounds/game_over.ogg", "game_over");
                createjs.Sound.registerSound("./sounds/combo.ogg", "combo");
                createjs.Sound.registerSound("./sounds/shot.ogg", "shot");
                createjs.Sound.registerSound("./sounds/soundtrack.ogg", "soundtrack");
        }else{
                createjs.Sound.alternateExtensions = ["ogg"];
                createjs.Sound.addEventListener("fileload", createjs.proxy(this.soundLoaded, this));

                createjs.Sound.registerSound("./sounds/press_but.mp3", "press_but");
                createjs.Sound.registerSound("./sounds/win.mp3", "win");
                createjs.Sound.registerSound("./sounds/game_over.mp3", "game_over");
                createjs.Sound.registerSound("./sounds/combo.mp3", "combo");
                createjs.Sound.registerSound("./sounds/shot.mp3", "shot");
                createjs.Sound.registerSound("./sounds/soundtrack.mp3", "soundtrack");
        }
        
        RESOURCE_TO_LOAD += 6;
        
    };
    
    this._loadImages = function(){
        s_oSpriteLibrary.init( this._onImagesLoaded,this._onAllImagesLoaded, this );

        s_oSpriteLibrary.addSprite("but_bg","./sprites/but_play_bg.png");
        s_oSpriteLibrary.addSprite("but_play","./sprites/but_play.png");
        s_oSpriteLibrary.addSprite("but_continue","./sprites/but_continue.png");
        s_oSpriteLibrary.addSprite("but_generic_small","./sprites/but_generic_small.png");
        s_oSpriteLibrary.addSprite("but_exit","./sprites/but_exit.png");
        s_oSpriteLibrary.addSprite("bg_menu","./sprites/bg_menu.jpg");
        s_oSpriteLibrary.addSprite("audio_icon","./sprites/audio_icon.png");
        s_oSpriteLibrary.addSprite("hero","./sprites/hero.png");
        s_oSpriteLibrary.addSprite("hit_area","./sprites/hit_area.png");
        s_oSpriteLibrary.addSprite("explosion","./sprites/explosion.png");
        s_oSpriteLibrary.addSprite("msg_box","./sprites/msg_box.png");
        s_oSpriteLibrary.addSprite("extra_score","./sprites/extra_score.png");
        s_oSpriteLibrary.addSprite("end_path","./sprites/end_path.png");
        s_oSpriteLibrary.addSprite("but_level","./sprites/but_level.png");
        s_oSpriteLibrary.addSprite("bg_menu_level","./sprites/bg_menu_level.jpg");
        s_oSpriteLibrary.addSprite("arrow_left","./sprites/arrow_left.png");
        s_oSpriteLibrary.addSprite("arrow_right","./sprites/arrow_right.png");
		s_oSpriteLibrary.addSprite("logo_ctl","./sprites/logo_ctl.png");
		s_oSpriteLibrary.addSprite("but_credits","./sprites/but_credits.png");
		s_oSpriteLibrary.addSprite("but_exit_small","./sprites/but_exit_small.png");
        
        for(var i=0;i<BALL_COLORS;i++){
            s_oSpriteLibrary.addSprite("ball_"+i,"./sprites/ball_"+i+".png");
        }
		
        s_oSpriteLibrary.addSprite("bg_game_1","./sprites/bg_game_1.jpg");
        s_oSpriteLibrary.addSprite("bg_game_2","./sprites/bg_game_2.jpg");
        s_oSpriteLibrary.addSprite("bg_game_3","./sprites/bg_game_3.jpg");
        s_oSpriteLibrary.addSprite("bg_game_4","./sprites/bg_game_4.jpg");

        RESOURCE_TO_LOAD += s_oSpriteLibrary.getNumSprites();

        s_oSpriteLibrary.loadSprites();
    };
    
    this._onImagesLoaded = function(){
        _iCurResource++;

        var iPerc = Math.floor(_iCurResource/RESOURCE_TO_LOAD *100);

        _oPreloader.refreshLoader(iPerc);
        if(_iCurResource === RESOURCE_TO_LOAD){
            this._allResourcesLoaded();
        }
    };
    
    this._onAllImagesLoaded = function(){
        
    };
    
    this.onAllPreloaderImagesLoaded = function(){
        this._loadImages();
    };
    
    this._allResourcesLoaded = function(){
        _oPreloader.unload();
        jQuery.getJSON("levels.json", this.onLoadedJSON);    
    };
    
    this.onLoadedJSON = function (oData) {
        s_oLevelSettings = new CLevelSettings(oData); 
        
        s_oMain.gotoMenu();
    };
    
    this.stopUpdate = function () {
        _bUpdate = false;
        createjs.Ticker.paused = true;
        $("#block_game").css("display", "block");
    };

    this.startUpdate = function () {
        s_iPrevTime = new Date().getTime();
        _bUpdate = true;
        createjs.Ticker.paused = false;
        $("#block_game").css("display", "none");
    };
    
    this.gotoMenu = function(){
        _oMenu = new CMenu();
        _iState = STATE_MENU;
    };
    
    this.gotoLevelMenu = function(){
        _oLevelMenu = new CLevelMenu();
    };
    
    this.gotoGame = function(iLevel,iScore){
        _oGame = new CGame(_oData,iLevel,iScore);   
							
        _iState = STATE_GAME;
    };
    
    this.gotoHelp = function(){
        _oHelp = new CHelp();
        _iState = STATE_HELP;
    };
    
    this.levelSelected = function(iLevel){
        if(iLevel >= s_iLastLevel){
            s_iLastLevel = iLevel;
        }
        var iScore = this.getScoreTillLevel(iLevel);
        //trace("iScore: "+iScore)
        
        
        this.gotoGame(iLevel,iScore);
    };
    
    this._update = function(event){
        if(_bUpdate === false){
                return;
        }
        var iCurTime = new Date().getTime();
        s_iTimeElaps = iCurTime - s_iPrevTime;
        s_iCntTime += s_iTimeElaps;
        s_iCntFps++;
        s_iPrevTime = iCurTime;
        
        if ( s_iCntTime >= 1000 ){
            s_iCurFps = s_iCntFps;
            s_iCntTime-=1000;
            s_iCntFps = 0;
        }
                
        if(_iState === STATE_GAME){
            _oGame.update();
        }
        
        if(s_oStage !== undefined){
            s_oStage.update(event);
        }
    };
    
    s_oMain = this;
    _oData = oData;

    this.initContainer();
}

var s_bMobile;
var s_bAudioActive = true;
var s_iCntTime = 0;
var s_iTimeElaps = 0;
var s_iPrevTime = 0;
var s_iCntFps = 0;
var s_iCurFps = 0;

var s_oSoundtrack;
var s_oDrawLayer;
var s_oStage;
var s_oMain = null;
var s_oSpriteLibrary;
var s_oLevelSettings;

var s_iLastLevel = 1;