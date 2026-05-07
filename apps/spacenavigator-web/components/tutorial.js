const tutorialStyles = `
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	background: rgba(0, 20, 40, 0.92);
	border: 2px solid #00aaff;
	border-radius: 15px;
	padding: 20px;
	color: white;
	width: 80%;
	max-width: 620px;
	max-height: 80%;
	overflow-y: auto;
	display: none;
	box-shadow: 0 0 30px rgba(0, 170, 255, 0.5);
	z-index: 100;
`;

const helpButtonStyles = `
	position: absolute;
	top: 20px;
	right: 20px;
	width: 40px;
	height: 40px;
	background: rgba(0, 150, 255, 0.7);
	border: none;
	border-radius: 50%;
	color: white;
	font-size: 24px;
	cursor: pointer;
	box-shadow: 0 0 15px rgba(0, 150, 255, 0.5);
`;

const TUTORIAL_SEEN_KEY = "spaceNavigatorTutorialSeenV1";

function buildTutorialModal() {
	const modal = document.createElement("div");
	modal.style.cssText = tutorialStyles;
	modal.innerHTML = `
		<h2 style="text-align: center; color: #00ccff;">Space Navigator: Controls</h2>
		<hr style="border-color: #00aaff;">
		<p><strong>Basic Controls:</strong></p>
		<ul>
			<li>Mouse or touch drag to steer your spacecraft</li>
			<li>Arrow keys to steer (keyboard)</li>
			<li>ESC to pause and resume</li>
		</ul>
		<p><strong>Special Maneuvers:</strong></p>
		<ul>
			<li>A key: Barrel Roll Left</li>
			<li>D key: Barrel Roll Right</li>
			<li>W key: Speed Boost</li>
			<li>S key: Emergency Brake</li>
			<li>Spacebar: Energy Wave (costs 500 points)</li>
		</ul>
		<p><strong>Ability Cooldowns:</strong></p>
		<ul>
			<li>Barrel Roll (A/D): 2 seconds</li>
			<li>Speed Boost (W): 5 seconds</li>
			<li>Emergency Brake (S): 5 seconds</li>
			<li>Energy Wave (Spacebar): 10 seconds</li>
		</ul>
		<p><strong>Power-ups:</strong></p>
		<ul>
			<li>Yellow gems: Score bonus</li>
			<li>Blue gems: Shield activation</li>
			<li>Orange gems: Super bonus</li>
		</ul>
		<hr style="border-color: #00aaff;">
		<button id="closeInstructions" style="
			background: linear-gradient(to bottom, #00ccff, #0066cc);
			border: none;
			color: white;
			padding: 10px 20px;
			border-radius: 5px;
			cursor: pointer;
			display: block;
			margin: 0 auto;
		">Close</button>
	`;
	return modal;
}

function buildHelpButton() {
	const helpButton = document.createElement("button");
	helpButton.textContent = "?";
	helpButton.style.cssText = helpButtonStyles;
	return helpButton;
}

export function createTutorialUI({
	isGameActive,
	isGameOver,
	pauseGame,
	resumeGame,
}) {
	const modal = buildTutorialModal();
	document.body.appendChild(modal);

	const helpButton = buildHelpButton();
	document.body.appendChild(helpButton);

	const startScreen = document.getElementById("startScreen");
	const startScreenHelpBtn = helpButton.cloneNode(true);
	if (startScreen) {
		startScreen.appendChild(startScreenHelpBtn);
	}

	let pausedForTutorial = false;

	function closeTutorial() {
		modal.style.display = "none";
		if (pausedForTutorial && typeof resumeGame === "function") {
			resumeGame();
		}
		pausedForTutorial = false;
		try {
			localStorage.setItem(TUTORIAL_SEEN_KEY, "true");
		} catch (error) {
			// Ignore storage errors (private mode, blocked storage, etc.)
		}
	}

	function openTutorial() {
		modal.style.display = "block";
		pausedForTutorial = false;

		if (
			typeof isGameActive === "function" &&
			typeof isGameOver === "function"
		) {
			if (isGameActive() && !isGameOver()) {
				pausedForTutorial =
					typeof pauseGame === "function"
						? pauseGame()
						: false;
			}
		}

		const closeButton = modal.querySelector("#closeInstructions");
		if (closeButton) {
			closeButton.addEventListener("click", closeTutorial, {
				once: true,
			});
		}
	}

	helpButton.addEventListener("click", openTutorial);
	if (startScreenHelpBtn) {
		startScreenHelpBtn.addEventListener("click", openTutorial);
	}

	setTimeout(() => {
		try {
			if (!localStorage.getItem(TUTORIAL_SEEN_KEY)) {
				openTutorial();
			}
		} catch (error) {
			openTutorial();
		}
	}, 400);
}
