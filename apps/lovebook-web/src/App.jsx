import { Loader } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useRef } from "react";
import styled from "styled-components";
import { motion } from "framer-motion";
import { Experience } from "./components/Experience";
import { UI } from "./components/UI";
import FloatingHearts from "./components/FloatingHearts";
import "./index.css";

const AppContainer = styled.div`
	width: 100%;
	height: 100vh;
	background: black;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	overflow: hidden;
	position: relative;
`;

const DecorationCircle = styled(motion.div)`
	position: absolute;
	border-radius: 50%;
	background: radial-gradient(
		circle,
		rgba(255, 105, 180, 0.3) 0%,
		rgba(255, 105, 180, 0) 70%
	);
	filter: blur(8px);
	z-index: 1;
`;

const StarContainer = styled.div`
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	z-index: 2;
	pointer-events: none;
`;

const Star = styled.div`
	position: absolute;
	width: ${(props) => props.size}px;
	height: ${(props) => props.size}px;
	background-color: white;
	border-radius: 50%;
	opacity: ${(props) => props.opacity};
	animation: twinkle ${(props) => props.duration}s ease-in-out infinite;

	@keyframes twinkle {
		0%,
		100% {
			opacity: ${(props) => props.opacity};
			transform: scale(1);
		}
		50% {
			opacity: ${(props) => props.opacity * 0.5};
			transform: scale(0.8);
		}
	}
`;

const Title = styled(motion.h1)`
	font-size: clamp(1.8rem, 5vw, 3rem);
	color: #ff69b4;
	text-shadow: 0 0 10px rgba(255, 105, 180, 0.7),
		0 0 20px rgba(255, 105, 180, 0.5);
	margin-bottom: 0px;
	margin-top: 0px;
	z-index: 10;
	font-family: "Pacifico", cursive;
	letter-spacing: 1px;
	text-align: center;
	padding: 0 10px;
	width: 100%;
	max-width: 90vw;
	overflow: hidden;
	user-select: none;

	@media (max-width: 768px) {
		font-size: clamp(1.5rem, 4vw, 2rem);
		margin-bottom: 0px;
	}

	@media (max-width: 480px) {
		font-size: clamp(1.2rem, 3.5vw, 1.8rem);
		letter-spacing: 0.5px;
	}
`;

function App() {
	const modelViewerRef = useRef(null);

	const stars = Array.from({ length: 50 }).map((_, i) => {
		const size = Math.random() * 3 + 1;
		const opacity = Math.random() * 0.5 + 0.3;
		const top = Math.random() * 100;
		const left = Math.random() * 100;
		const duration = Math.random() * 3 + 2;

		return (
			<Star
				key={i}
				size={size}
				opacity={opacity}
				duration={duration}
				style={{ top: `${top}%`, left: `${left}%` }}
			/>
		);
	});

	const circles = [
		{ size: 300, x: "10%", y: "20%", delay: 0 },
		{ size: 200, x: "85%", y: "15%", delay: 0.3 },
		{ size: 250, x: "75%", y: "80%", delay: 0.6 },
		{ size: 180, x: "15%", y: "75%", delay: 0.9 },
	];

	return (
		<AppContainer>
			<UI />
			<Loader />
			<FloatingHearts count={20} />
			<Title
				initial={{ opacity: 0, y: -50 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 1 }}>
				Ngày 8/3 vui vẻ nhé vợ yêu của anh ❤
			</Title>
			<Canvas shadows camera={{ position: [-0.5, 1, 4], fov: 45 }}>
				<group position-y={0}>
					<Suspense fallback={null}>
						<Experience />
					</Suspense>
				</group>
			</Canvas>

			<StarContainer>{stars}</StarContainer>
			{circles.map((circle, index) => (
				<DecorationCircle
					key={index}
					style={{
						width: circle.size,
						height: circle.size,
						left: circle.x,
						top: circle.y,
					}}
					initial={{ opacity: 0 }}
					animate={{ opacity: 0.6 }}
					transition={{ delay: circle.delay, duration: 1 }}
				/>
			))}
		</AppContainer>
	);
}

export default App;
