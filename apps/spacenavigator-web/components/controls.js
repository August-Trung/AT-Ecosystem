const inputState = {
	pointerX: 0,
	pointerY: 0,
	pointerActive: false,
	keyboardX: 0,
	keyboardY: 0,
	keyboardActive: false,
};

const keyState = {
	left: false,
	right: false,
	up: false,
	down: false,
};

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

function isTypingTarget(target) {
	if (!target) return false;
	const tag = target.tagName;
	return (
		tag === "INPUT" ||
		tag === "TEXTAREA" ||
		tag === "SELECT" ||
		target.isContentEditable
	);
}

function updateKeyboardVector() {
	const x = (keyState.right ? 1 : 0) - (keyState.left ? 1 : 0);
	const y = (keyState.up ? 1 : 0) - (keyState.down ? 1 : 0);
	const length = Math.hypot(x, y);

	if (length > 0) {
		inputState.keyboardX = x / length;
		inputState.keyboardY = y / length;
		inputState.keyboardActive = true;
	} else {
		inputState.keyboardX = 0;
		inputState.keyboardY = 0;
		inputState.keyboardActive = false;
	}
}

function setPointerPosition(clientX, clientY) {
	const width = window.innerWidth || 1;
	const height = window.innerHeight || 1;
	const normalizedX = (clientX / width) * 2 - 1;
	const normalizedY = -(clientY / height) * 2 + 1;
	inputState.pointerX = clamp(normalizedX, -1, 1);
	inputState.pointerY = clamp(normalizedY, -1, 1);
	inputState.pointerActive = true;
}

function handleMouseMove(event, shouldCapture) {
	if (!shouldCapture()) return;
	setPointerPosition(event.clientX, event.clientY);
}

function handleTouchStart(event, shouldCapture) {
	if (!shouldCapture()) return;
	if (event.touches.length === 0) return;
	setPointerPosition(event.touches[0].clientX, event.touches[0].clientY);
	event.preventDefault();
}

function handleTouchMove(event, shouldCapture) {
	if (!shouldCapture()) return;
	if (event.touches.length === 0) return;
	setPointerPosition(event.touches[0].clientX, event.touches[0].clientY);
	event.preventDefault();
}

function handleTouchEnd() {
	inputState.pointerActive = false;
}

function handleKeyDown(event, shouldCapture) {
	if (!shouldCapture()) return;
	if (isTypingTarget(event.target)) return;

	let handled = true;
	switch (event.key) {
		case "ArrowLeft":
			keyState.left = true;
			break;
		case "ArrowRight":
			keyState.right = true;
			break;
		case "ArrowUp":
			keyState.up = true;
			break;
		case "ArrowDown":
			keyState.down = true;
			break;
		default:
			handled = false;
			break;
	}

	if (handled) {
		updateKeyboardVector();
		event.preventDefault();
	}
}

function handleKeyUp(event, shouldCapture) {
	const capture = shouldCapture();
	if (isTypingTarget(event.target)) return;

	let handled = true;
	switch (event.key) {
		case "ArrowLeft":
			keyState.left = false;
			break;
		case "ArrowRight":
			keyState.right = false;
			break;
		case "ArrowUp":
			keyState.up = false;
			break;
		case "ArrowDown":
			keyState.down = false;
			break;
		default:
			handled = false;
			break;
	}

	if (handled) {
		updateKeyboardVector();
		if (capture) {
			event.preventDefault();
		}
	}
}

export function createInputController(options = {}) {
	const { shouldCapture = () => true } = options;

	document.addEventListener(
		"mousemove",
		(event) => handleMouseMove(event, shouldCapture),
		false
	);
	document.addEventListener(
		"touchstart",
		(event) => handleTouchStart(event, shouldCapture),
		{
			passive: false,
		}
	);
	document.addEventListener(
		"touchmove",
		(event) => handleTouchMove(event, shouldCapture),
		{
			passive: false,
		}
	);
	document.addEventListener("touchend", handleTouchEnd, false);
	document.addEventListener(
		"keydown",
		(event) => handleKeyDown(event, shouldCapture),
		false
	);
	document.addEventListener(
		"keyup",
		(event) => handleKeyUp(event, shouldCapture),
		false
	);

	return {
		getInputVector() {
			if (inputState.keyboardActive) {
				return { x: inputState.keyboardX, y: inputState.keyboardY };
			}
			if (inputState.pointerActive) {
				return { x: inputState.pointerX, y: inputState.pointerY };
			}
			return { x: 0, y: 0 };
		},
		resetInput() {
			inputState.pointerActive = false;
			inputState.pointerX = 0;
			inputState.pointerY = 0;
			inputState.keyboardActive = false;
			inputState.keyboardX = 0;
			inputState.keyboardY = 0;
			keyState.left = false;
			keyState.right = false;
			keyState.up = false;
			keyState.down = false;
		},
	};
}
