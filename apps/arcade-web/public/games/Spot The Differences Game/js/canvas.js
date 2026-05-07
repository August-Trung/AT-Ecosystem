////////////////////////////////////////////////////////////
// CANVAS
////////////////////////////////////////////////////////////
var stage
var canvasW=0;
var canvasH=0;

/*!
 * 
 * START GAME CANVAS - This is the function that runs to setup game canvas
 * 
 */
function initGameCanvas(w,h){
	var gameCanvas = document.getElementById("gameCanvas");
	gameCanvas.width = w;
	gameCanvas.height = h;
	
	canvasW=w;
	canvasH=h;
	stage = new createjs.Stage("gameCanvas");
	
	createjs.Touch.enable(stage);
	stage.enableMouseOver(20);
	stage.mouseMoveOutside = true;
	
	createjs.Ticker.setFPS(60);
	createjs.Ticker.addEventListener("tick", tick);	
}

var guide = false;
var canvasContainer, mainContainer, gameContainer, confirmContainer, resultContainer;
var guideline, bg, logo, buttonStart, buttonContinue, buttonFacebook, buttonTwitter, buttonGoogle, buttonFullscreen, buttonSoundOn, buttonSoundOff;

$.thumbs = {};
$.puzzles = {};

/*!
 * 
 * BUILD GAME CANVAS ASSERTS - This is the function that runs to build game canvas asserts
 * 
 */
function buildGameCanvas(){
	canvasContainer = new createjs.Container();
	mainContainer = new createjs.Container();
	selectContainer = new createjs.Container();
	gameContainer = new createjs.Container();
	puzzlesContainer = new createjs.Container();
	hiddenSpotLeftContainer = new createjs.Container();
	hiddenSpotRightContainer = new createjs.Container();
	gameLayoutContainer = new createjs.Container();
	statusContainer = new createjs.Container();
	confirmContainer = new createjs.Container();
	resultContainer = new createjs.Container();
	optionsContainer = new createjs.Container();
	
	bg = new createjs.Bitmap(loader.getResult('background'));
	logo = new createjs.Bitmap(loader.getResult('logo'));
	
	buttonStart = new createjs.Bitmap(loader.getResult('buttonStart'));
	centerReg(buttonStart);
	buttonStart.x = canvasW/2;
	buttonStart.y = canvasH/100 * 78;
	
	//select
	selectTxt = new createjs.Text();
	selectTxt.font = "33px riffic_free_mediumbold";
	selectTxt.color = "#fff";
	selectTxt.textAlign = "center";
	selectTxt.textBaseline='alphabetic';
	selectTxt.text = '';
	selectTxt.x = canvasW/100 * 68;
	selectTxt.y = canvasH/100 * 78;
	
	itemSelect = new createjs.Bitmap(loader.getResult('itemSelect'));
	
	buttonRight = new createjs.Bitmap(loader.getResult('buttonRight'));
	centerReg(buttonRight);
	buttonRight.x = canvasW/100 * 83;
	buttonRight.y = canvasH/100 * 50;
	
	buttonLeft = new createjs.Bitmap(loader.getResult('buttonLeft'));
	centerReg(buttonLeft);
	buttonLeft.x = canvasW/100 * 17;
	buttonLeft.y = canvasH/100 * 50;
	selectContainer.addChild(itemSelect, buttonRight, buttonLeft, selectTxt);
		
	//game
	var thumbCount = 0;
	for(var n = 0; n<puzzles_arr.length; n++){
		$.thumbs['thumb_'+n] = new createjs.Bitmap(loader.getResult('boardThumbnail'+n));
		centerReg($.thumbs['thumb_'+n]);
		$.thumbs['thumb_'+n].x = canvasW/2;
		$.thumbs['thumb_'+n].y = canvasH/2 + 47;
		selectContainer.addChild($.thumbs['thumb_'+n]);
		
		$.puzzles[n] = new createjs.Bitmap(loader.getResult('boardImage'+n));
		$.puzzles[n].visible = false;
		puzzlesContainer.addChild($.puzzles[n]);
	}
	
	itemBoard = new createjs.Bitmap(loader.getResult('itemBoard'));
	itemTime = new createjs.Bitmap(loader.getResult('itemTime'));
	centerReg(itemTime);
	itemFind = new createjs.Bitmap(loader.getResult('itemFind'));
	centerReg(itemFind);
	
	itemTime.x = canvasW/100 * 19;
	itemTime.y = canvasH/100 * 17;
	
	itemFind.x = canvasW/2;
	itemFind.y = canvasH/100 * 17;
	
	timerTxt = new createjs.Text();
	timerTxt.font = "33px riffic_free_mediumbold";
	timerTxt.color = "#fff";
	timerTxt.textAlign = "left";
	timerTxt.textBaseline='alphabetic';
	timerTxt.text = '0 : 00';
	timerTxt.x = itemTime.x - 20;
	timerTxt.y = itemTime.y + 11;
	
	findTxt = new createjs.Text();
	findTxt.font = "33px riffic_free_mediumbold";
	findTxt.color = "#fff";
	findTxt.textAlign = "left";
	findTxt.textBaseline='alphabetic';
	findTxt.text = '1/6';
	findTxt.x = itemFind.x - 5;
	findTxt.y = itemFind.y + 11;
	
	itemStatus = new createjs.Bitmap(loader.getResult('itemStatus'));
	statusTxt = new createjs.Text();
	statusTxt.font = "50px riffic_free_mediumbold";
	statusTxt.color = "#fff";
	statusTxt.textAlign = "center";
	statusTxt.textBaseline='alphabetic';
	statusTxt.text = 'asdasd';
	statusTxt.x = canvasW/2;
	statusTxt.y = canvasH/2 + 15;
	
	//result
	itemResult = new createjs.Bitmap(loader.getResult('itemResult'));
	
	resultTitleTxt = new createjs.Text();
	resultTitleTxt.font = "52px riffic_free_mediumbold";
	resultTitleTxt.color = "#fff";
	resultTitleTxt.textAlign = "center";
	resultTitleTxt.textBaseline='alphabetic';
	resultTitleTxt.text = resultTitle;
	resultTitleTxt.x = canvasW/2;
	resultTitleTxt.y = canvasH/100 * 28;
	
	resultTitleTxt = new createjs.Text();
	resultTitleTxt.font = "52px riffic_free_mediumbold";
	resultTitleTxt.color = "#fff";
	resultTitleTxt.textAlign = "center";
	resultTitleTxt.textBaseline='alphabetic';
	resultTitleTxt.text = resultTitle;
	resultTitleTxt.x = canvasW/2;
	resultTitleTxt.y = canvasH/100 * 28;
	
	resultDescTxt = new createjs.Text();
	resultDescTxt.font = "40px riffic_free_mediumbold";
	resultDescTxt.color = "#fff";
	resultDescTxt.textAlign = "center";
	resultDescTxt.textBaseline='alphabetic';
	resultDescTxt.text = resultDesc;
	resultDescTxt.x = canvasW/2;
	resultDescTxt.y = canvasH/100 * 38;
	
	resultScoreTxt = new createjs.Text();
	resultScoreTxt.font = "60px riffic_free_mediumbold";
	resultScoreTxt.color = "#ffeb00";
	resultScoreTxt.textAlign = "center";
	resultScoreTxt.textBaseline='alphabetic';
	resultScoreTxt.text = resultDesc;
	resultScoreTxt.x = canvasW/2;
	resultScoreTxt.y = canvasH/100 * 47;
	
	resultShareTxt = new createjs.Text();
	resultShareTxt.font = "30px riffic_free_mediumbold";
	resultShareTxt.color = "#ccc";
	resultShareTxt.textAlign = "center";
	resultShareTxt.textBaseline='alphabetic';
	resultShareTxt.text = shareText;
	resultShareTxt.x = canvasW/2;
	resultShareTxt.y = canvasH/100 * 57;
	
	buttonFacebook = new createjs.Bitmap(loader.getResult('buttonFacebook'));
	buttonTwitter = new createjs.Bitmap(loader.getResult('buttonTwitter'));
	centerReg(buttonFacebook);
	createHitarea(buttonFacebook);
	centerReg(buttonTwitter);
	createHitarea(buttonTwitter);
	buttonFacebook.x = canvasW/100 * 47;
	buttonTwitter.x = canvasW/100 * 53;
	buttonFacebook.y = buttonTwitter.y = canvasH/100*62;
	
	buttonContinue = new createjs.Bitmap(loader.getResult('buttonContinue'));
	centerReg(buttonContinue);
	createHitarea(buttonContinue);
	buttonContinue.x = canvasW/2;
	buttonContinue.y = canvasH/100 * 73;
	
	buttonNext = new createjs.Bitmap(loader.getResult('buttonNext'));
	centerReg(buttonNext);
	createHitarea(buttonNext);
	buttonNext.x = canvasW/2;
	buttonNext.y = canvasH/100 * 73;
	
	//option
	buttonFullscreen = new createjs.Bitmap(loader.getResult('buttonFullscreen'));
	centerReg(buttonFullscreen);
	buttonSoundOn = new createjs.Bitmap(loader.getResult('buttonSoundOn'));
	centerReg(buttonSoundOn);
	buttonSoundOff = new createjs.Bitmap(loader.getResult('buttonSoundOff'));
	centerReg(buttonSoundOff);
	buttonSoundOn.visible = false;
	buttonExit = new createjs.Bitmap(loader.getResult('buttonExit'));
	centerReg(buttonExit);
	buttonSettings = new createjs.Bitmap(loader.getResult('buttonSettings'));
	centerReg(buttonSettings);
	
	createHitarea(buttonFullscreen);
	createHitarea(buttonSoundOn);
	createHitarea(buttonSoundOff);
	createHitarea(buttonExit);
	createHitarea(buttonSettings);
	
	//exit
	itemExit = new createjs.Bitmap(loader.getResult('itemExit'));
	
	buttonConfirm = new createjs.Bitmap(loader.getResult('buttonConfirm'));
	centerReg(buttonConfirm);
	buttonConfirm.x = canvasW/100* 39;
	buttonConfirm.y = canvasH/100 * 62;
	
	buttonCancel = new createjs.Bitmap(loader.getResult('buttonCancel'));
	centerReg(buttonCancel);
	buttonCancel.x = canvasW/100 * 61;
	buttonCancel.y = canvasH/100 * 62;
	
	confirmMessageTxt = new createjs.Text();
	confirmMessageTxt.font = "30px riffic_free_mediumbold";
	confirmMessageTxt.color = "#fff";
	confirmMessageTxt.textAlign = "center";
	confirmMessageTxt.textBaseline='alphabetic';
	confirmMessageTxt.text = exitMessage;
	confirmMessageTxt.lineHeight = 35;
	confirmMessageTxt.x = canvasW/2;
	confirmMessageTxt.y = canvasH/100 *45;
	
	confirmContainer.addChild(itemExit, buttonConfirm, buttonCancel, confirmMessageTxt);
	confirmContainer.visible = false;
	
	if(guide){
		guideline = new createjs.Shape();
		guideline.graphics.setStrokeStyle(2).beginStroke('red').drawRect((stageW-contentW)/2, (stageH-contentH)/2, contentW, contentH);
	}
	
	//mask
	maskGuideL = new createjs.Shape();
	maskGuideL.graphics.beginFill('red').drawRect(147, 165, 490, 490);
	hiddenSpotLeftContainer.mask = maskGuideL;
	
	maskGuideR = new createjs.Shape();
	maskGuideR.graphics.beginFill('red').drawRect(649, 165, 490, 490);
	hiddenSpotRightContainer.mask = maskGuideR;
	
	mainContainer.addChild(logo, buttonStart);
	gameContainer.addChild(itemBoard, puzzlesContainer, hiddenSpotLeftContainer, hiddenSpotRightContainer, gameLayoutContainer);
	statusContainer.addChild(itemStatus, statusTxt);
	gameLayoutContainer.addChild(itemTime, timerTxt, itemFind, findTxt, statusContainer);
	resultContainer.addChild(itemResult, resultTitleTxt, resultDescTxt, resultScoreTxt, buttonContinue, buttonNext);
	optionsContainer.addChild(buttonFullscreen, buttonSoundOn, buttonSoundOff, buttonExit);
	optionsContainer.visible = false;
	
	if(shareEnable){
		resultContainer.addChild(resultShareTxt, buttonFacebook, buttonTwitter, buttonGoogle);
	}
	
	canvasContainer.addChild(bg, mainContainer, selectContainer, gameContainer, resultContainer, confirmContainer, optionsContainer, buttonSettings, guideline);
	stage.addChild(canvasContainer);
	
	resizeCanvas();
}


/*!
 * 
 * RESIZE GAME CANVAS - This is the function that runs to resize game canvas
 * 
 */
function resizeCanvas(){
 	if(canvasContainer!=undefined){
		buttonSettings.x = (canvasW - offset.x) - 50;
		buttonSettings.y = offset.y + 32;
		
		var distanceNum = 58;
		if(curPage == 'main'){
			buttonExit.visible = false;
			buttonSoundOn.x = buttonSoundOff.x = buttonSettings.x;
			buttonSoundOn.y = buttonSoundOff.y = buttonSettings.y+distanceNum;
			buttonSoundOn.x = buttonSoundOff.x;
			buttonSoundOn.y = buttonSoundOff.y = buttonSettings.y+(distanceNum);
			
			buttonFullscreen.x = buttonSettings.x;
			buttonFullscreen.y = buttonSettings.y+(distanceNum*2);
		}else{
			buttonExit.visible = true;
			buttonSoundOn.x = buttonSoundOff.x = buttonSettings.x;
			buttonSoundOn.y = buttonSoundOff.y = buttonSettings.y+distanceNum;
			buttonSoundOn.x = buttonSoundOff.x;
			buttonSoundOn.y = buttonSoundOff.y = buttonSettings.y+(distanceNum);
			
			buttonFullscreen.x = buttonSettings.x;
			buttonFullscreen.y = buttonSettings.y+(distanceNum*2);
			
			buttonExit.x = buttonSettings.x;
			buttonExit.y = buttonSettings.y+(distanceNum*3);
		}
	}
}

/*!
 * 
 * REMOVE GAME CANVAS - This is the function that runs to remove game canvas
 * 
 */
 function removeGameCanvas(){
	 stage.autoClear = true;
	 stage.removeAllChildren();
	 stage.update();
	 createjs.Ticker.removeEventListener("tick", tick);
	 createjs.Ticker.removeEventListener("tick", stage);
 }

/*!
 * 
 * CANVAS LOOP - This is the function that runs for canvas loop
 * 
 */ 
function tick(event) {
	updateGame();
	stage.update(event);
}

/*!
 * 
 * CANVAS MISC FUNCTIONS
 * 
 */
function centerReg(obj){
	obj.regX=obj.image.naturalWidth/2;
	obj.regY=obj.image.naturalHeight/2;
}

function createHitarea(obj){
	obj.hitArea = new createjs.Shape(new createjs.Graphics().beginFill("#000").drawRect(0, 0, obj.image.naturalWidth, obj.image.naturalHeight));
}