export function createCustomizationScreen() {
	const customizeScreen = document.createElement("div");
	customizeScreen.id = "customizeScreen";
	customizeScreen.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(to bottom, rgba(0, 0, 20, 0.9), rgba(0, 20, 40, 0.95));
        display: none;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 100;
    `;

	customizeScreen.innerHTML = `
        <h2 style="color: #00ccff; font-size: 48px; margin: 0px 0px	;">Ship Customization</h2>
        
        <div class="customization-area" style="display: flex; width: 100vw; max-width: 1000px; max-height: 100vh;">
        <div class="ship-preview" style="flex: 1; display: flex; justify-content: center; align-items: center;">
            <div id="shipPreviewContainer" style="width: 300px; height: 300px; border: 2px solid #00aaff; border-radius: 10px;"></div>
        </div>
        
        <div class="options-area" style="flex: 1; padding: 10px; color: white;">
            <div class="option-section">
            <h3 style="color: #00ccff;">Ship Color</h3>
            <div id="colorOptions" class="option-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px;"></div>
            </div>
            
            <div class="option-section" style="margin-top: 10px;">
            <h3 style="color: #00ccff;">Wing Design</h3>
            <div id="wingOptions" class="option-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 5px;"></div>
            </div>
            
            <div class="option-section" style="margin-top: 10px;">
            <h3 style="color: #00ccff;">Engine Effect</h3>
            <div id="engineOptions" class="option-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px;"></div>
            </div>
        </div>
        </div>
        
        <div style="margin-top: 10px;">
        <button id="saveCustomization" style="
            background: linear-gradient(to bottom, #00ccff, #0066cc);
            border: none;
            color: white;
            padding: 15px 30px;
            font-size: 24px;
            border-radius: 8px;
            cursor: pointer;
            margin-right: 20px;
            box-shadow: 0 0 15px rgba(0, 150, 255, 0.5);
        ">Save & Return</button>
        
        <button id="cancelCustomization" style="
            background: linear-gradient(to bottom, #cc3333, #991111);
            border: none;
            color: white;
            padding: 15px 30px;
            font-size: 24px;
            border-radius: 8px;
            cursor: pointer;
            box-shadow: 0 0 15px rgba(204, 51, 51, 0.5);
        ">Cancel</button>
        </div>
    `;

	document.body.appendChild(customizeScreen);

	// Add customization button to the start screen
	const customizeButton = document.createElement("button");
	customizeButton.id = "customizeShipButton";
	customizeButton.textContent = "Customize Ship";
	customizeButton.style.cssText = `
        padding: 20px 40px;
	font-size: 32px;
	background: linear-gradient(to bottom, #00ccff, #0066cc);
	border: none;
	border-radius: 10px;
	cursor: pointer;
	color: white;
	text-shadow: 0 0 5px black;
	box-shadow: 0 0 30px rgba(0, 150, 255, 0.8);
	transition: all 0.3s ease;
	margin-right: 20px;
    `;

	// Add hover effect using event listeners
	customizeButton.addEventListener("mouseover", () => {
		customizeButton.style.transform = "scale(1.1)";
		customizeButton.style.boxShadow = "0 0 50px rgba(0, 150, 255, 1)";
	});

	customizeButton.addEventListener("mouseout", () => {
		customizeButton.style.transform = "scale(1)";
		customizeButton.style.boxShadow = "0 0 30px rgba(0, 150, 255, 0.8)";
	});

	// Insert before the start button
	const startButton = document.getElementById("startButton");
	startButton.parentNode.insertBefore(customizeButton, startButton);

	// Populate options and add event listeners
	populateCustomizationOptions();
	setupShipPreview();
}
