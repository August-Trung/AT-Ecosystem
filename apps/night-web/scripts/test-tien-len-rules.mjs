import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const rulesPath = path.resolve("services/tienLenRules.ts");
const source = fs.readFileSync(rulesPath, "utf8");
const compiled = ts.transpileModule(source, {
	compilerOptions: {
		module: ts.ModuleKind.CommonJS,
		target: ts.ScriptTarget.ES2022,
	},
});

const module = { exports: {} };
vm.runInNewContext(compiled.outputText, {
	module,
	exports: module.exports,
	require() {
		throw new Error("Unexpected runtime import in tienLenRules.ts");
	},
});

const rules = module.exports;
const cards = (...ids) => ids.map(rules.createCard);

assert.equal(rules.getOpeningCardId([0, 4], [8, 12]), 0);
assert.equal(rules.getOpeningCardId([5, 9], [1, 8]), 1);
assert.equal(rules.validateInitialHands([0, 4], [8, 12], 0), false);
assert.equal(
	rules.validateInitialHands(
		Array.from({ length: 13 }, (_, i) => i),
		Array.from({ length: 13 }, (_, i) => i + 13),
		0,
	),
	true,
);
assert.equal(
	rules.validateInitialHands(
		Array.from({ length: 13 }, (_, i) => i),
		[1, ...Array.from({ length: 12 }, (_, i) => i + 13)],
		0,
	),
	false,
);
assert.equal(
	rules.validateInitialHands(
		Array.from({ length: 13 }, (_, i) => i),
		Array.from({ length: 13 }, (_, i) => i + 13),
		1,
	),
	false,
);

assert.equal(rules.isValidMove(cards(0), [], 0), true);
assert.equal(rules.isValidMove(cards(1), [], 0), false);

const fourPairSequence = cards(0, 1, 4, 5, 8, 9, 12, 13);
assert.equal(rules.isFourPairSequence(fourPairSequence), true);
assert.equal(rules.isStrongMove(fourPairSequence), true);
assert.equal(rules.isValidMove(fourPairSequence, cards(48, 49)), true);

const deck = rules.shuffleDeck(rules.createDeck(), () => 0.42);
assert.equal(deck.length, rules.FULL_DECK_SIZE);
assert.equal(new Set(deck).size, rules.FULL_DECK_SIZE);
const { myCards, opponentCards } = rules.dealInitialHands(deck);
assert.equal(myCards.length, rules.CARDS_PER_PLAYER);
assert.equal(opponentCards.length, rules.CARDS_PER_PLAYER);
assert.equal(new Set([...myCards, ...opponentCards]).size, rules.CARDS_PER_PLAYER * 2);

for (let i = 0; i < 1000; i++) {
	const shuffled = rules.shuffleDeck(rules.createDeck());
	const hands = rules.dealInitialHands(shuffled);
	assert.equal(
		new Set([...hands.myCards, ...hands.opponentCards]).size,
		rules.CARDS_PER_PLAYER * 2,
	);
	assert.equal(
		rules.validateInitialHands(
			hands.myCards,
			hands.opponentCards,
			rules.getOpeningCardId(hands.myCards, hands.opponentCards),
		),
		true,
	);
}

const validMove = rules.validateOpponentMove(
	[0],
	12,
	Array.from({ length: 13 }, (_, i) => i),
	[],
	0,
);
assert.equal(validMove?.nextOpponentCount, 12);
assert.deepEqual(validMove?.nextOpponentCardIds, [
	1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
]);

assert.equal(
	rules.validateOpponentMove([0, 0], 11, [0, 1, 2], [], null),
	null,
);
assert.equal(
	rules.validateOpponentMove([0, 1], 12, [0, 1, 2], [], null),
	null,
);
assert.equal(
	rules.validateOpponentMove([9], 2, [0, 1, 2], [], null),
	null,
);

console.log("tienLenRules tests passed");
