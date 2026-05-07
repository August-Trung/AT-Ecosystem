////////////////////////////////////////////////////////////
// EDIT TRACKS
////////////////////////////////////////////////////////////
var editData = {show:true, hiddenNum:0, editPath:null, editPathColour:'yellow', rightMask:null};

var puzzleLoader, puzzleFileFest;

/*!
 * 
 * EDIT READY
 * 
 */
$(function() {
	$.editor.enable = true;
});

function loadEditPage(){
	gameLayoutContainer.visible = false;
	
	$.get('editTools.html', function(data){
		$('body').prepend(data);
		$('#editWrapper').show();
		toggleEditOption();
		buildEditButtons();
		buttonExit.visible = false;
	});		
}

/*!
 * 
 * BUILD EDIT BUTTONS - This is the function that runs to build edit buttons
 * 
 */
function buildEditButtons(){
	$('#toggleShowOption').click(function(){
		toggleShowOption();
	});
	
	//puzzles list
	gameData.puzzleNum = 0;
	buildPuzzleDropdown();
	
	$('#togglePanel').click(function(){
		togglePanel();
	});
	
	$("#puzzlesList").change(function() {
		if($(this).val() != ''){
			gameData.puzzleNum = $(this).val();
			loadPuzzleData();
		}
	});
	
	$('#prevPuzzle').click(function(){
		togglePuzzle(false);
	});
	
	$('#nextPuzzle').click(function(){
		togglePuzzle(true);
	});
	
	$('#addPuzzle').click(function(){
		actionPuzzle('new');
	});
	
	$('#removePuzzle').click(function(){
		actionPuzzle('remove');
	});
	
	$('#movePuzzleUp').click(function(){
		actionPuzzle('moveup');
	});
	
	$('#movePuzzleDown').click(function(){
		actionPuzzle('movedown');
	});
	
	$('#updateImage').click(function(){
		puzzles_arr[gameData.puzzleNum].thumbnail = $('#thumbnail').val();
		puzzles_arr[gameData.puzzleNum].image = $('#image').val();
		puzzles_arr[gameData.puzzleNum].timer = $('#timer').val();
		
		loadPuzzleAssets();
	});
	
	$('#editPuzzle').click(function(){
		toggleEditOption('puzzle', true);
	});
	
	$('#puzzleBack').click(function(){
		toggleEditOption();
	});
	
	$('#editHidden').click(function(){
		toggleEditOption('hidden', true);
	});
	
	//hidden
	$('#prevHidden').click(function(){
		toggleHidden(false);
	});
	
	$('#nextHidden').click(function(){
		toggleHidden(true);
	});
	
	editData.hiddenNum = 0;
	buildHiddenDropdown();
	$("#hiddenList").change(function() {
		if($(this).val() != ''){
			editData.hiddenNum = $(this).val();
			loadHiddenData();
		}
	});
	
	/*$('#addHidden').click(function(){
		actionHidden('new');
	});*/
	
	$('#removeHidden').click(function(){
		actionHidden('remove');
	});
	
	$('#moveHiddenUp').click(function(){
		actionHidden('moveup');
	});
	
	$('#moveHiddenDown').click(function(){
		actionHidden('movedown');
	});
	
	$('#updateHidden').click(function(){
		updateHiddenCircle();
	});
	
	$('#hiddenBack').click(function(){
		toggleEditOption();
	});
	
	
	//generate
	$('#generateArray').click(function(){
		generateArray();
	});
	
	stage.addEventListener("dblclick", function(evt) {
		if(editData.option == 'hidden'){
			actionHidden('new');
		}
	});
}

 /*!
 * 
 * TOGGLE DISPLAY OPTION - This is the function that runs to toggle display option
 * 
 */
 
function toggleShowOption(){
	if(editData.show){
		editData.show = false;
		$('#editOption').hide();
		$('#toggleShowOption').val('Show Edit Option');
	}else{
		editData.show = true;
		$('#editOption').show();
		$('#toggleShowOption').val('Hide Edit Option');
	}
}

/*!
 * 
 * TOGGLE EDIT OPTION - This is the function that runs to toggle edit option
 * 
 */
function toggleEditOption(con, update){
	editData.option = con;
	
	$('#editPuzzleWrapper').hide();
	$('#puzzleEditWrapper').hide();
	$('#hiddenEditWrapper').hide();
	
	hiddenSpotLeftContainer.visible = false;
	hiddenSpotRightContainer.visible = false;
	
	if(con == 'puzzle'){
		$('#puzzleEditWrapper').show();
	}else if(con == 'hidden'){
		$('#hiddenEditWrapper').show();
		hiddenSpotLeftContainer.visible = true;
		hiddenSpotRightContainer.visible = true;
		
		if(update){
			editData.hiddenNum = 0;
			buildHiddenDropdown();
		}else{
			buildHiddenSpot();
			loadHiddenData();
		}
	}else{
		$('#editPuzzleWrapper').show();
	}
}

/*!
 * 
 * BUILD PUZZLE DROPDOWN - This is the function that runs to build puzzle dropdown
 * 
 */
function buildPuzzleDropdown(){
	$('#puzzlesList').empty();
	for(n=0;n<puzzles_arr.length;n++){
		$('#puzzlesList').append($("<option/>", {
			value: n,
			text: 'Puzzle '+(n+1)
		}));
	}
	$('#puzzlesList').val(gameData.puzzleNum);
	
	loadPuzzleData();
}

/*!
 * 
 * BUILD HIDDEN DROPDOWN - This is the function that runs to build hidden dropdown
 * 
 */
function buildHiddenDropdown(){
	$('#hiddenList').empty();
	for(n=0;n<puzzles_arr[gameData.puzzleNum].hidden.length;n++){
		$('#hiddenList').append($("<option/>", {
			value: n,
			text: 'Hidden '+(n+1)
		}));
	}
	$('#hiddenList').val(editData.hiddenNum);
	
	buildHiddenSpot();
	loadHiddenData();
}

/*!
 * 
 * TOGGLE PUZZLE - This is the function that runs to toggle puzzle
 * 
 */
function togglePuzzle(con){
	if(con){
		gameData.puzzleNum++;
		gameData.puzzleNum = gameData.puzzleNum > puzzles_arr.length - 1 ? 0 : gameData.puzzleNum;
	}else{
		gameData.puzzleNum--;
		gameData.puzzleNum = gameData.puzzleNum < 0 ? puzzles_arr.length - 1 : gameData.puzzleNum;
	}
	
	$('#puzzlesList').prop("selectedIndex", gameData.puzzleNum);
	
	loadPuzzleData();
}

/*!
 * 
 * TOGGLE HIDDEN SPOT - This is the function that runs to toggle hidden spot
 * 
 */
function toggleHidden(con){
	if(con){
		editData.hiddenNum++;
		editData.hiddenNum = editData.hiddenNum > puzzles_arr[gameData.puzzleNum].hidden.length - 1 ? 0 : editData.hiddenNum;
	}else{
		editData.hiddenNum--;
		editData.hiddenNum = editData.hiddenNum < 0 ? puzzles_arr[gameData.puzzleNum].hidden.length - 1 : editData.hiddenNum;
	}
	
	$('#hiddenList').prop("selectedIndex", editData.hiddenNum);
	
	loadHiddenData();
}

/*!
 * 
 * LOAD EDITOR PUZZLE - This is the function that runs to load editor data
 * 
 */
function loadPuzzleData(){
	toggleEditOption();
	
	$('#thumbnail').val(puzzles_arr[gameData.puzzleNum].thumbnail);
	$('#image').val(puzzles_arr[gameData.puzzleNum].image);
	$('#timer').val(puzzles_arr[gameData.puzzleNum].timer);
	
	loadPuzzleAssets();
}

function loadHiddenData(){
	if(puzzles_arr[gameData.puzzleNum].hidden.length == 0){
		return;	
	}
	
	$('#hiddenX').val(puzzles_arr[gameData.puzzleNum].hidden[editData.hiddenNum].x);
	$('#hiddenY').val(puzzles_arr[gameData.puzzleNum].hidden[editData.hiddenNum].y);
	$('#hiddenRatio').val(puzzles_arr[gameData.puzzleNum].hidden[editData.hiddenNum].ratio);
	
	if(hiddenSpotLeftContainer.visible){
		editData.editPath.graphics.clear();
		editData.editPath.graphics.beginFill(editData.editPathColour).drawCircle(0, 0, puzzles_arr[gameData.puzzleNum].hidden[editData.hiddenNum].ratio);
		editData.editPath.x = Number($('#hiddenX').val());
		editData.editPath.y = Number($('#hiddenY').val());
	}
}

/*!
 * 
 * EDITOR ACTION - This is the function that runs to for editor action
 * 
 */
function actionPuzzle(action){
	switch(action){
		case 'new':
			puzzles_arr.push({thumbnail:'', image:'', hidden:[], timer:0});
			gameData.puzzleNum = puzzles_arr.length - 1;
			buildPuzzleDropdown();
		break;
		
		case 'remove':
			if(puzzles_arr.length > 1){
				puzzles_arr.splice(gameData.puzzleNum, 1);
				gameData.puzzleNum = 0;
				buildPuzzleDropdown();
			}
		break;
		
		case 'moveup':
			if(gameData.puzzleNum-1 >= 0){
				swapArray(puzzles_arr, gameData.puzzleNum-1, gameData.puzzleNum);
				gameData.puzzleNum--;
				buildPuzzleDropdown();
			}
		break;
		
		case 'movedown':
			if(gameData.puzzleNum+1 < puzzles_arr.length){
				swapArray(puzzles_arr, gameData.puzzleNum+1, gameData.puzzleNum);
				gameData.puzzleNum++;
				buildPuzzleDropdown();
			}
		break;
	}
}

function actionHidden(action){
	switch(action){
		case 'new':
			var currentX = Math.round(stage.mouseX);
			var currentY = Math.round(stage.mouseY)
			puzzles_arr[gameData.puzzleNum].hidden.push({x:currentX, y:currentY, ratio:50});
			editData.hiddenNum = puzzles_arr[gameData.puzzleNum].hidden.length - 1;
			buildHiddenDropdown();
		break;
		
		case 'remove':
			if(puzzles_arr[gameData.puzzleNum].hidden.length > 1){
				puzzles_arr[gameData.puzzleNum].hidden.splice(editData.hiddenNum, 1);
				editData.hiddenNum = puzzles_arr[gameData.puzzleNum].hidden.length-1;
				buildHiddenDropdown();
			}
		break;
		
		case 'moveup':
			if(editData.hiddenNum-1 >= 0){
				swapArray(puzzles_arr[gameData.puzzleNum].hidden, editData.hiddenNum-1, editData.hiddenNum);
				editData.hiddenNum--;
				buildHiddenDropdown();
			}
		break;
		
		case 'movedown':
			if(gameData.puzzleNum+1 < puzzles_arr[gameData.puzzleNum].hidden.length){
				swapArray(puzzles_arr[gameData.puzzleNum].hidden, editData.hiddenNum+1, editData.hiddenNum);
				editData.hiddenNum++;
				buildHiddenDropdown();
			}
		break;
	}
}

/*!
 * 
 * BUILD HIDDEN SPOTS - This is the function that runs to build hidden spots
 * 
 */
function buildHiddenSpot(){
	hiddenSpotLeftContainer.removeAllChildren();
	hiddenSpotRightContainer.removeAllChildren();
	
	editData.rightMask = new createjs.Shape();
	editData.rightMask.graphics.beginFill('#B07E45').drawRect(649, 165, 490, 490);
	editData.rightMask.alpha = .7;
	hiddenSpotRightContainer.addChild(editData.rightMask);
	
	editData.editPath = new createjs.Shape();
	editData.editPath.alpha = .7;
	editData.editPath.graphics.beginFill(editData.editPathColour).drawCircle(0, 0, editData.editPathWidth);
	editData.editPath.visible = true;
	editData.editPath.x = canvasW/2;
	editData.editPath.y = canvasH/2;
	
	hiddenSpotLeftContainer.addChild(editData.editPath);
	
	for(var n=0;n<puzzles_arr[gameData.puzzleNum].hidden.length;n++){
		createEditHiddenSpot(n, puzzles_arr[gameData.puzzleNum].hidden[n].x, puzzles_arr[gameData.puzzleNum].hidden[n].y, puzzles_arr[gameData.puzzleNum].hidden[n].ratio);
	}
}

function createEditHiddenSpot(n,x,y,ratio){
	$.hiddenCircle[n] = new createjs.Shape();
	$.hiddenCircle[n].graphics.beginStroke(circleHighlight.color).setStrokeStyle(circleHighlight.stroke).drawCircle(0, 0, ratio);
	$.hiddenCircle[n].x = x;
	$.hiddenCircle[n].y = y;
	$.hiddenCircle[n].hitArea = new createjs.Shape(new createjs.Graphics().beginFill("#000").drawCircle(0, 0, ratio));
	
	hiddenSpotLeftContainer.addChild($.hiddenCircle[n]);
	
	$.hiddenCircle[n].cursor = "pointer";
	$.hiddenCircle[n].name = n;
	$.hiddenCircle[n].addEventListener("mousedown", function(evt) {
		toggleSpotDragEvent(evt, 'drag')
	});
	$.hiddenCircle[n].addEventListener("pressmove", function(evt) {
		toggleSpotDragEvent(evt, 'move')
	});
	$.hiddenCircle[n].addEventListener("pressup", function(evt) {
		toggleSpotDragEvent(evt, 'drop')
	});
}

/*!
 * 
 * POINT EVENT - This is the function that runs to for point event handler
 * 
 */
function toggleSpotDragEvent(obj, con){
	switch(con){
		case 'drag':
			obj.target.offset = {x:obj.target.x-(obj.stageX), y:obj.target.y-(obj.stageY)};
			obj.target.alpha = .5;
			
			editData.editPath.visible = true;
			editData.editPath.x = obj.target.x;
			editData.editPath.y = obj.target.y;
			
			editData.hiddenNum = Number(obj.target.name);
			$('#hiddenList').val(editData.hiddenNum);
			loadHiddenData();
		break;
		
		case 'move':
			obj.target.alpha = .5;
			obj.target.x = (obj.stageX) + obj.target.offset.x;
			obj.target.y = (obj.stageY) + obj.target.offset.y;
			
			editData.editPath.x = obj.target.x;
			editData.editPath.y = obj.target.y;
			
			var newPathX = Math.floor(obj.target.x);
			var newPathY = Math.floor(obj.target.y);
				
			$('#hiddenX').val(newPathX);
			$('#hiddenY').val(newPathY);
			
			puzzles_arr[gameData.puzzleNum].hidden[editData.hiddenNum].x = newPathX;
			puzzles_arr[gameData.puzzleNum].hidden[editData.hiddenNum].y = newPathY;
		break;
		
		case 'drop':
			obj.target.alpha = 1;
		break;
	}
}

/*!
 * 
 * UPDATE CIRCLE - This is the function that runs to update circle
 * 
 */
function updateHiddenCircle(){
	$.hiddenCircle[editData.hiddenNum].x = Number($('#hiddenX').val());
	$.hiddenCircle[editData.hiddenNum].y = Number($('#hiddenY').val());
	
	puzzles_arr[gameData.puzzleNum].hidden[editData.hiddenNum].x = Number($('#hiddenX').val());
	puzzles_arr[gameData.puzzleNum].hidden[editData.hiddenNum].y = Number($('#hiddenY').val());
	puzzles_arr[gameData.puzzleNum].hidden[editData.hiddenNum].ratio = Number($('#hiddenRatio').val());
	
	buildHiddenSpot();
	
	editData.editPath.graphics.clear();
	editData.editPath.graphics.beginFill(editData.editPathColour).drawCircle(0, 0, puzzles_arr[gameData.puzzleNum].hidden[editData.hiddenNum].ratio);
	editData.editPath.x = Number($('#hiddenX').val());
	editData.editPath.y = Number($('#hiddenY').val());
}

/*!
 * 
 * GENERATE ARRAY - This is the function that runs to generate array
 * 
 */
function generateArray(){
	var outputArray = '';
	var space = '					';
	var space2 = '						';
	var space3 = '							';
	
	outputArray += "[\n";
	for(e=0;e<puzzles_arr.length;e++){
		var pathArray = '';
		var actionArray = '';
		for(var l=0; l < puzzles_arr[e].hidden.length; l++){
			pathArray += "{x:"+puzzles_arr[e].hidden[l].x+", y:"+puzzles_arr[e].hidden[l].y+", ratio:"+puzzles_arr[e].hidden[l].ratio+"},";
		}
		
		outputArray += space+"{\n";
		outputArray += space2+"thumbnail:'"+puzzles_arr[e].thumbnail+"',\n";
		outputArray += space2+"image:'"+puzzles_arr[e].image+"',\n";
		outputArray += space2+"hidden:["+pathArray+"],\n";
		outputArray += space2+"timer:"+puzzles_arr[e].timer+",\n";
		outputArray += space+"},\n\n";
	}
	outputArray += space+'];';
	outputArray = outputArray.replace(/undefined/g,0);
	$('#outputArray').val(outputArray);	
}

/*!
 * 
 * LOAD PUZZLE ASSETS - This is the function that runs to load puzzle assets
 * 
 */
function loadPuzzleAssets(){
	puzzlesContainer.removeAllChildren();
	
	puzzleFileFest = [];
	puzzleFileFest = [{src:puzzles_arr[gameData.puzzleNum].image, id:'puzzleImage'}];
	
	puzzleLoader = new createjs.LoadQueue(false);
	puzzleLoader.addEventListener("complete", handlePuzzleComplete);
	puzzleLoader.loadManifest(puzzleFileFest);
}

function handlePuzzleComplete() {
	var puzzleImage = new createjs.Bitmap(puzzleLoader.getResult('puzzleImage'));
	puzzlesContainer.addChild(puzzleImage);
};