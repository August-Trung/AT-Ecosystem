////////////////////////////////////////////////////////////
// GAME v1.3
////////////////////////////////////////////////////////////

/*!
 * 
 * GAME SETTING CUSTOMIZATION START
 * 
 */

var selectPuzzleCon = true; //enable select puzzles page

var circleHighlight = {color:'#fff', stroke:5}; //game circle highlight settings
var statusPuzzleComplete = 'COMPLETE'; //game status when complete
var statusPuzzleTimer = 'TIME\'S UP'; //game status when time's up

var resultTitle = 'GAME RESULT!'; //game result title
var resultDesc = 'BEST SCORE'; //game result description

var exitMessage = 'ARE YOUR SURE YOU\nWANT TO QUIT THE GAME?'; //go to main page message


//Social share, [SCORE] will replace with game score
var shareEnable = true; //toggle share
var shareText = 'SHARE THIS GAME'; //social share message
var shareTitle = 'My final score on Spot the Differences Game is [NUMBER].';//social share score title
var shareMessage = '[NUMBER] is mine new score on Spot the Differences Game! Try it now!'; //social share score message
				
/*!
 *
 * GAME SETTING CUSTOMIZATION END
 *
 */

$.editor = {enable:false};
var playerData = {score:false, complete:false};
var gameData = {paused:true, puzzleNum:0, rightX:500, hidden:[], timer:false, startDate:'', nowDate:'', timerCount:0};
$.hiddenCircle = {};

/*!
 * 
 * GAME BUTTONS - This is the function that runs to setup button event
 * 
 */
function buildGameButton(){
	if($.browser.mobile || isTablet){
		
	}else{
		var isInIframe = (window.location != window.parent.location) ? true : false;
		if(isInIframe){
			$(window).blur(function() {
				appendFocusFrame();
			});
			appendFocusFrame();
        }
	}
	
	buttonStart.cursor = "pointer";
	buttonStart.addEventListener("click", function(evt) {
		playSound('soundClick');
		if(selectPuzzleCon){
			goPage('level');
		}else{
			goPage('game');	
		}
	});
	
	buttonLeft.cursor = "pointer";
	buttonLeft.addEventListener("click", function(evt) {
		playSound('soundClick');
		toggleSelect(false);
	});
	
	buttonRight.cursor = "pointer";
	buttonRight.addEventListener("click", function(evt) {
		playSound('soundClick');
		toggleSelect(true);
	});
	
	for(var n=0;n<puzzles_arr.length;n++){
		$.thumbs['thumb_'+n].name = n;
		$.thumbs['thumb_'+n].cursor = "pointer";
		$.thumbs['thumb_'+n].addEventListener("click", function(evt) {
			selectBoardThumbs(evt.target.name);
			playSound('soundSelect');
			goPage('game');
		});
	}
	
	buttonContinue.cursor = "pointer";
	buttonContinue.addEventListener("click", function(evt) {
		playSound('soundClick');
		goPage('main');
	});
	
	buttonNext.cursor = "pointer";
	buttonNext.addEventListener("click", function(evt) {
		playSound('soundClick');
		gameData.puzzleNum++;
		goPage('game');
	});
	
	buttonFacebook.cursor = "pointer";
	buttonFacebook.addEventListener("click", function(evt) {
		share('facebook');
	});
	buttonTwitter.cursor = "pointer";
	buttonTwitter.addEventListener("click", function(evt) {
		share('twitter');
	});
	
	buttonSoundOff.cursor = "pointer";
	buttonSoundOff.addEventListener("click", function(evt) {
		toggleGameMute(true);
		toggleOption();
	});
	
	buttonSoundOn.cursor = "pointer";
	buttonSoundOn.addEventListener("click", function(evt) {
		toggleGameMute(false);
		toggleOption();
	});
	
	buttonFullscreen.cursor = "pointer";
	buttonFullscreen.addEventListener("click", function(evt) {
		toggleFullScreen();
		toggleOption();
	});
	
	buttonSettings.cursor = "pointer";
	buttonSettings.addEventListener("click", function(evt) {
		toggleOption();
	});
	
	buttonExit.cursor = "pointer";
	buttonExit.addEventListener("click", function(evt) {
		toggleConfirm(true);
		toggleOption();
	});
	
	buttonConfirm.cursor = "pointer";
	buttonConfirm.addEventListener("click", function(evt) {
		toggleConfirm(false);
		stopGame();
		goPage('main');
	});
	
	buttonCancel.cursor = "pointer";
	buttonCancel.addEventListener("click", function(evt) {
		toggleConfirm(false);
	});
}

function appendFocusFrame(){
	$('#mainHolder').prepend('<div id="focus" style="position:absolute; width:100%; height:100%; z-index:1000;"></div');
	$('#focus').click(function(){
		$('#focus').remove();
	});	
}


/*!
 * 
 * SELECT BOARDS - This is the function that runs to display select boards
 * 
 */
var selectPageNum = 1;
var selectPageTotal = 1;
var maxThumbPerPage = 1;
function buildSelectPagination(){
	selectPageTotal=puzzles_arr.length/maxThumbPerPage;
	if (String(selectPageTotal).indexOf('.') > -1){
		selectPageTotal=Math.floor(selectPageTotal)+1;
	}
	toggleSelect(false);
}

function toggleSelect(con){
	if(con){
		selectPageNum++;
		selectPageNum = selectPageNum > selectPageTotal ? selectPageTotal : selectPageNum;
	}else{
		selectPageNum--;
		selectPageNum = selectPageNum < 1 ? 1 : selectPageNum;
	}
	
	selectTxt.text = selectPageNum+'/'+puzzles_arr.length;
	selectPage(selectPageNum);
}

function selectPage(num){
	selectPageNum = num;
	
	var startNum = (selectPageNum-1) * maxThumbPerPage;
	var endNum = startNum + (maxThumbPerPage-1);
	var thumbCount = 1;
	
	var thumbCount = 0;
	for(var n=0;n<puzzles_arr.length;n++){
		if(n >= startNum && n <= endNum){
			thumbCount++;
			$.thumbs['thumb_'+n].visible = true;
			$.thumbs['thumb_'+n].visible = true;
		}else{
			$.thumbs['thumb_'+n].visible = false;	
		}
	}
	
	if(selectPageNum == 1){
		buttonLeft.visible = false;	
	}else{
		buttonLeft.visible = true;	
	}
	
	if(selectPageNum == selectPageTotal || selectPageTotal == 1){
		buttonRight.visible = false;	
	}else{
		buttonRight.visible = true;	
	}
}

function selectBoardThumbs(num){
	gameData.puzzleNum = num;
}

/*!
 * 
 * DISPLAY PAGES - This is the function that runs to display pages
 * 
 */
var curPage=''
function goPage(page){
	curPage=page;
	
	mainContainer.visible = false;
	selectContainer.visible = false;
	gameContainer.visible = false;
	resultContainer.visible = false;
	
	var targetContainer = null;
	switch(page){
		case 'main':
			targetContainer = mainContainer;
		break;
			
		case 'level':
			targetContainer = selectContainer;
		break;
		
		case 'game':
			targetContainer = gameContainer;
			startGame();
		break;
		
		case 'result':
			targetContainer = resultContainer;
			stopGame();
			
			buttonNext.visible = false;
			if(gameData.puzzleNum+1 < puzzles_arr.length && playerData.complete){
				buttonNext.visible = true;
				buttonContinue.x = canvasW/100 * 40;
				buttonNext.x = canvasW/100 * 60;
			}else{
				buttonContinue.x = canvasW/2;	
			}
			
			resultScoreTxt.text = millisecondsToTime(playerData.score);
			
			saveGame(playerData.score);
		break;
	}
	
	if(targetContainer != null){
		targetContainer.visible = true;
		targetContainer.alpha = 0;
		TweenMax.to(targetContainer, .5, {alpha:1, overwrite:true});
	}
	
	resizeCanvas();
}

function toggleConfirm(con){
	confirmContainer.visible = con;
	
	if(con){
		TweenMax.pauseAll(true, true);
		gameData.paused = true;
	}else{
		TweenMax.resumeAll(true, true)
		gameData.paused = false;
	}
}

/*!
 * 
 * START GAME - This is the function that runs to start play game
 * 
 */

function startGame(){
	if(!$.editor.enable){
		gameData.paused = false;
	}
	playerData.complete = false;
	displayGameStatus();
	
	loadPuzzle();
	updateStats();
}


 /*!
 * 
 * STOP GAME - This is the function that runs to stop play game
 * 
 */
function stopGame(){
	TweenMax.killAll();
	hiddenSpotLeftContainer.removeAllChildren();
	hiddenSpotRightContainer.removeAllChildren();
}

/*!
 * 
 * SAVE GAME - This is the function that runs to save game
 * 
 */
function saveGame(score){
	/*$.ajax({
      type: "POST",
      url: 'saveResults.php',
      data: {score:score},
      success: function (result) {
          console.log(result);
      }
    });*/
}

function updateGame(){
	if(!gameData.paused){
		if(gameData.timer){
			gameData.nowDate = new Date();
			gameData.timerCount = (gameData.nowDate.getTime() - gameData.startDate.getTime());
			
			if(gameData.timerCount > puzzles_arr[gameData.puzzleNum].timer){
				gameData.timer = false;
				displayGameStatus('timer');
			}
			
			updateStats();
		}
	}
}

/*!
 * 
 * LOAD PUZZLE - This is the function that runs to load puzzle
 * 
 */
function loadPuzzle(){
	for(var n = 0; n<puzzles_arr.length; n++){
		$.puzzles[n].visible = false;
	}
	$.puzzles[gameData.puzzleNum].visible = true;
	
	gameData.timer = puzzles_arr[gameData.puzzleNum].timer == 0 ? false : true;
	gameData.startDate = new Date();
	gameData.timerCount = 0;
	
	gameData.hidden = [];
	for(var n=0;n<puzzles_arr[gameData.puzzleNum].hidden.length;n++){
		gameData.hidden.push({spotted:false, ratio:0});
		createHiddenSpot(n, puzzles_arr[gameData.puzzleNum].hidden[n].x, puzzles_arr[gameData.puzzleNum].hidden[n].y, puzzles_arr[gameData.puzzleNum].hidden[n].ratio);
	}
}

function createHiddenSpot(n,x,y,ratio,con){
	$.hiddenCircle['left'+n] = new createjs.Shape();
	//$.hiddenCircle['left'+n].graphics.beginStroke(circleHighlight.color).setStrokeStyle(circleHighlight.stroke).drawCircle(0, 0, ratio);
	$.hiddenCircle['left'+n].x = x;
	$.hiddenCircle['left'+n].y = y;
	$.hiddenCircle['left'+n].hitArea = new createjs.Shape(new createjs.Graphics().beginFill("#000").drawCircle(0, 0, ratio));
	
	hiddenSpotLeftContainer.addChild($.hiddenCircle['left'+n]);
	$.hiddenCircle['left'+n].name = n;
	$.hiddenCircle['left'+n].addEventListener("click", function(evt) {
		updateHiddenSpot(evt.target.name);
	});
	
	$.hiddenCircle['right'+n] = new createjs.Shape();
	//å$.hiddenCircle['right'+n].graphics.beginStroke(circleHighlight.color).setStrokeStyle(circleHighlight.stroke).drawCircle(0, 0, ratio);
	$.hiddenCircle['right'+n].x = x+gameData.rightX;
	$.hiddenCircle['right'+n].y = y;
	$.hiddenCircle['right'+n].hitArea = new createjs.Shape(new createjs.Graphics().beginFill("#000").drawCircle(0, 0, ratio));
	
	hiddenSpotLeftContainer.addChild($.hiddenCircle['left'+n]);
	hiddenSpotRightContainer.addChild($.hiddenCircle['right'+n]);
	$.hiddenCircle['right'+n].name = n;
	$.hiddenCircle['right'+n].addEventListener("click", function(evt) {
		updateHiddenSpot(evt.target.name);
	});
}

/*!
 * 
 * UPDATE HIDDEN SPOT - This is the function that runs to update hidden spot
 * 
 */
function updateHiddenSpot(n){
	if(gameData.paused){
		return;	
	}
	
	if(!gameData.hidden[n].spotted){
		playSound('soundFound');
		gameData.hidden[n].ratio = 0;
		gameData.hidden[n].spotted = true;
		
		var tweenSpeed = 1;
		TweenMax.to(gameData.hidden[n], tweenSpeed, {ratio:puzzles_arr[gameData.puzzleNum].hidden[n].ratio, ease:Elastic.easeOut, onUpdate:function(){
			$.hiddenCircle['left'+n].graphics.clear();
			$.hiddenCircle['right'+n].graphics.clear();
			
			$.hiddenCircle['left'+n].graphics.beginStroke(circleHighlight.color).setStrokeStyle(circleHighlight.stroke).drawCircle(0, 0, gameData.hidden[n].ratio);
			$.hiddenCircle['right'+n].graphics.beginStroke(circleHighlight.color).setStrokeStyle(circleHighlight.stroke).drawCircle(0, 0, gameData.hidden[n].ratio);
		}});
		
		updateStats();
	}
}

/*!
 * 
 * UPDATE GAME STATUS - This is the function that runs to update game status
 * 
 */
function updateStats(){
	var totalFound = 0;
	for(var n=0;n<gameData.hidden.length;n++){
		if(gameData.hidden[n].spotted){
			totalFound++;	
		}
	}
	
	findTxt.text = totalFound+'/'+puzzles_arr[gameData.puzzleNum].hidden.length;
	
	if(!gameData.timer){
		playerData.score = 0;
		timerTxt.text = millisecondsToTime(0);
	}else{
		playerData.score = puzzles_arr[gameData.puzzleNum].timer - gameData.timerCount;
		timerTxt.text = millisecondsToTime(playerData.score);
	}
	
	if(totalFound == puzzles_arr[gameData.puzzleNum].hidden.length){
		displayGameStatus('complete');
	}
}

/*!
 * 
 * DISPLAY GAME STATUS - This is the function that runs to display game status
 * 
 */
function displayGameStatus(con){
	statusContainer.visible = false;
	
	var fadeIn = false;
	if(con == 'complete'){
		playerData.complete = true;
		playSound('soundComplete');
		fadeIn = true;
		gameData.paused = true;
		statusTxt.text = statusPuzzleComplete;	
	}else if(con == 'timer'){
		playSound('soundFail');
		fadeIn = true;
		gameData.paused = true;
		statusTxt.text = statusPuzzleTimer;	
	}
	
	if(fadeIn){
		statusContainer.visible = true;
		statusContainer.alpha = 0;
		TweenMax.to(statusContainer, 1, {delay:1, alpha:1, overwrite:true, onComplete:function(){
			TweenMax.to(statusContainer, 2, {overwrite:true, onComplete:function(){
				goPage('result');
			}});
		}});
	}
}

/*!
 * 
 * START ANIMATE BUTTON - This is the function that runs to play blinking animation
 * 
 */
function startAnimateArrow(obj){
	TweenMax.to(obj, .3, {y:obj.oriY-10, overwrite:true, onComplete:function(){
		TweenMax.to(obj, .3, {y:obj.oriY, overwrite:true, onComplete:function(){
			startAnimateArrow(obj);
		}});	
	}});
}

/*!
 * 
 * STOP ANIMATE BUTTON - This is the function that runs to stop blinking animation
 * 
 */
function stopAnimateArrow(obj){
	TweenMax.killTweensOf(obj);
	obj.alpha = 0;
}

function toggleOption(){
	if(optionsContainer.visible){
		optionsContainer.visible = false;
	}else{
		optionsContainer.visible = true;
	}
}

/*!
 * 
 * OPTIONS - This is the function that runs to mute and fullscreen
 * 
 */
function toggleGameMute(con){
	buttonSoundOff.visible = false;
	buttonSoundOn.visible = false;
	toggleMute(con);
	if(con){
		buttonSoundOn.visible = true;
	}else{
		buttonSoundOff.visible = true;	
	}
}

function toggleFullScreen() {
  if (!document.fullscreenElement &&    // alternative standard method
      !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement ) {  // current working methods
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    } else if (document.documentElement.msRequestFullscreen) {
      document.documentElement.msRequestFullscreen();
    } else if (document.documentElement.mozRequestFullScreen) {
      document.documentElement.mozRequestFullScreen();
    } else if (document.documentElement.webkitRequestFullscreen) {
      document.documentElement.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }
}


/*!
 * 
 * SHARE - This is the function that runs to open share url
 * 
 */
function share(action){
	gtag('event','click',{'event_category':'share','event_label':action});
	
	var loc = location.href
	loc = loc.substring(0, loc.lastIndexOf("/") + 1);
	
	var title = shareTitle;
	var text = shareMessage;
	title = shareTitle.replace("[NUMBER]", millisecondsToTime(playerData.score));
	text = shareMessage.replace("[NUMBER]", millisecondsToTime(playerData.score));
	
	var shareurl = '';
	
	if( action == 'twitter' ) {
		shareurl = 'https://twitter.com/intent/tweet?url='+loc+'&text='+text;
	}else if( action == 'facebook' ){
		shareurl = 'https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(loc+'share.php?desc='+text+'&title='+title+'&url='+loc+'&thumb='+loc+'share.jpg&width=590&height=300');
	}else if( action == 'google' ){
		shareurl = 'https://plus.google.com/share?url='+loc;
	}
	
	window.open(shareurl);
}