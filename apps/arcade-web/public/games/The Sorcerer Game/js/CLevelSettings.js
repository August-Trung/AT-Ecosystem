function CLevelSettings(oJson){
    var _oJson;
    var _aBallSpeed;
    var _aBallNumber;
    var _aBallColors;
    var _aHeroPos;
    var _aCurveLevel;
    var _aBgPerLevel;
    
    this._init = function(oJson){
        _oJson = oJson;
        NUM_LEVELS = Object.keys(_oJson).length;
        trace("NUM_LEVELS: "+NUM_LEVELS)
        this._initBallSpeed();
        this._initBallNumber();
        this._initBallColors();
        this._initHeroPos();
        this._initCurveLevel();
        this._initBgLevel();
    };
    
    this._initBallSpeed = function(){
        _aBallSpeed = new Array();
       
       for(var i=0;i<NUM_LEVELS;i++){
           _aBallSpeed[i] = _oJson[i].ball_speed;
       }
       
    };
    
    this._initBallNumber = function(){
        _aBallNumber = new Array();
        
        for(var i=0;i<NUM_LEVELS;i++){
            _aBallNumber[i] = _oJson[i].ball_number;
        }
    };
    
    this._initBallColors = function(){
        _aBallColors = new Array();
        
        for(var i=0;i<NUM_LEVELS;i++){
            _aBallColors[i] = _oJson[i].num_colors;
        }
    };
    
    this._initHeroPos = function(){
        _aHeroPos = new Array();
        
        for(var i=0;i<NUM_LEVELS;i++){
            _aHeroPos[i] = new createjs.Point(_oJson[i].hero_pos.x,_oJson[i].hero_pos.y);
        }
    };
    
    this._initCurveLevel = function(){
        _aCurveLevel = new Array();
        
        for(var i=0;i<NUM_LEVELS;i++){
            _aCurveLevel[i] = new Array();
            var aPoints = _oJson[i].curve_point;
            for(var j=0;j<aPoints.length;j++){
                _aCurveLevel[i].push( [aPoints[j].x,aPoints[j].y]);
            }
        }
        
    };
    
    this._initBgLevel = function(){
        _aBgPerLevel = new Array();
        
        for(var i=0;i<NUM_LEVELS;i++){
            _aBgPerLevel[i] = _oJson[i].bg_image;
        }
    };
    
    this.getBallSpeedForLevel = function(iLevel){
        return _aBallSpeed[iLevel-1];
    };
    
    this.getBallNumberForLevel = function(iLevel){
        return _aBallNumber[iLevel-1];
    };
    
    this.getBallColorsForLevel = function(iLevel){
        return _aBallColors[iLevel-1];
    };
    
    this.getHeroPosForLevel = function(iLevel){
        return _aHeroPos[iLevel-1];
    };
    
    this.getCurveForLevel = function(iLevel){
        return _aCurveLevel[iLevel-1];
    };
    
    this.getNumLevels = function(){
        return _aCurveLevel.length;
    };
    
    this.getBgForLevel = function(iLevel){
        return _aBgPerLevel[iLevel-1];
    };
    
     this._init(oJson);
}