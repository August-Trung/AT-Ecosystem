import type { Card } from "../types";

export const FULL_DECK_SIZE = 52;
export const CARDS_PER_PLAYER = 13;
export const THREE_SPADES_ID = 0;

export const createCard = (id: number): Card => ({
	id,
	rank: Math.floor(id / 4),
	suit: id % 4,
});

export const getCardPower = (card: Card) => card.rank * 10 + card.suit;

export const createDeck = () =>
	Array.from({ length: FULL_DECK_SIZE }, (_, i) => i);

export const shuffleDeck = (
	deck: number[],
	random: () => number = Math.random,
) => {
	const shuffled = [...deck];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
};

export const dealInitialHands = (deck: number[]) => ({
	myCards: deck.slice(0, CARDS_PER_PLAYER),
	opponentCards: deck.slice(CARDS_PER_PLAYER, CARDS_PER_PLAYER * 2),
});

export const isValidCardId = (id: unknown): id is number =>
	typeof id === "number" &&
	Number.isInteger(id) &&
	id >= 0 &&
	id < FULL_DECK_SIZE;

export const isValidCardIdList = (
	cardIds: unknown,
	expectedLength?: number,
): cardIds is number[] => {
	if (!Array.isArray(cardIds)) return false;
	if (
		typeof expectedLength === "number" &&
		cardIds.length !== expectedLength
	)
		return false;
	if (!cardIds.every(isValidCardId)) return false;
	return new Set(cardIds).size === cardIds.length;
};

export const hasNoOverlap = (...cardGroups: number[][]) => {
	const allCards = cardGroups.flat();
	return new Set(allCards).size === allCards.length;
};

export const validateInitialHands = (
	myCards: unknown,
	opponentCards: unknown,
	openingCardId: unknown,
) => {
	if (!isValidCardIdList(myCards, CARDS_PER_PLAYER)) return false;
	if (!isValidCardIdList(opponentCards, CARDS_PER_PLAYER)) return false;
	if (!isValidCardId(openingCardId)) return false;
	if (!hasNoOverlap(myCards, opponentCards)) return false;
	return openingCardId === getOpeningCardId(myCards, opponentCards);
};

export const removeCardIds = (source: number[], cardIds: number[]) => {
	const toRemove = new Set(cardIds);
	return source.filter((id) => !toRemove.has(id));
};

export const getOpeningCardId = (
	myCards: number[],
	opponentCards: number[],
) => {
	const dealtCards = [...myCards, ...opponentCards];
	if (dealtCards.includes(THREE_SPADES_ID)) return THREE_SPADES_ID;
	return dealtCards.reduce((lowest, id) => {
		return getCardPower(createCard(id)) < getCardPower(createCard(lowest))
			? id
			: lowest;
	}, dealtCards[0]);
};

export const isSequence = (cards: Card[]) => {
	if (cards.length < 3) return false;
	const sorted = [...cards].sort((a, b) => a.rank - b.rank);
	for (let i = 0; i < sorted.length - 1; i++) {
		if (sorted[i + 1].rank !== sorted[i].rank + 1) return false;
	}
	if (sorted.some((c) => c.rank === 12)) return false;
	return true;
};

export const isPairSequence = (cards: Card[], pairCount: number) => {
	if (cards.length !== pairCount * 2) return false;
	const sorted = [...cards].sort((a, b) => a.rank - b.rank);
	for (let i = 0; i < sorted.length; i += 2) {
		if (sorted[i].rank !== sorted[i + 1].rank) return false;
	}
	for (let i = 2; i < sorted.length; i += 2) {
		if (sorted[i].rank !== sorted[i - 2].rank + 1) return false;
	}
	if (sorted.some((c) => c.rank === 12)) return false;
	return true;
};

export const isThreePairSequence = (cards: Card[]) => {
	return isPairSequence(cards, 3);
};

export const isFourPairSequence = (cards: Card[]) => {
	return isPairSequence(cards, 4);
};

export const isFourOfAKind = (cards: Card[]) => {
	if (cards.length !== 4) return false;
	return cards.every((c) => c.rank === cards[0].rank);
};

export const isStrongMove = (cards: Card[]) => {
	return (
		isFourOfAKind(cards) ||
		isThreePairSequence(cards) ||
		isFourPairSequence(cards)
	);
};

export const isValidMove = (
	selected: Card[],
	last: Card[],
	requiredOpeningCardId: number | null = null,
) => {
	if (selected.length === 0) return false;
	if (
		requiredOpeningCardId !== null &&
		last.length === 0 &&
		!selected.some((c) => c.id === requiredOpeningCardId)
	)
		return false;

	const sortedSelected = [...selected].sort(
		(a, b) => getCardPower(a) - getCardPower(b),
	);
	const maxSelected = sortedSelected[sortedSelected.length - 1];
	const selIs4Kind = isFourOfAKind(selected);
	const selIs3Pair = isThreePairSequence(selected);
	const selIs4Pair = isFourPairSequence(selected);

	if (last.length === 0) {
		if (selected.length === 1) return true;
		const allSameRank = selected.every((c) => c.rank === selected[0].rank);
		if (
			allSameRank &&
			(selected.length === 2 ||
				selected.length === 3 ||
				selected.length === 4)
		)
			return true;
		if (isSequence(selected)) return true;
		if (selIs3Pair) return true;
		if (selIs4Pair) return true;
		return false;
	}

	const sortedLast = [...last].sort(
		(a, b) => getCardPower(a) - getCardPower(b),
	);
	const maxLast = sortedLast[sortedLast.length - 1];
	const lastIs4Kind = isFourOfAKind(last);
	const lastIs3Pair = isThreePairSequence(last);
	const lastIs4Pair = isFourPairSequence(last);

	if (last.length === 1 && last[0].rank === 12) {
		if (selIs3Pair || selIs4Kind || selIs4Pair) return true;
	}
	if (last.length === 2 && last[0].rank === 12 && last[1].rank === 12) {
		if (selIs4Kind || selIs4Pair) return true;
	}
	if (lastIs3Pair) {
		if (selIs4Pair) return true;
		if (selIs4Kind) return true;
		if (selIs3Pair && getCardPower(maxSelected) > getCardPower(maxLast))
			return true;
	}
	if (lastIs4Kind) {
		if (selIs4Pair) return true;
		if (selIs4Kind && getCardPower(maxSelected) > getCardPower(maxLast))
			return true;
	}
	if (lastIs4Pair) {
		if (selIs4Pair && getCardPower(maxSelected) > getCardPower(maxLast))
			return true;
	}

	if (selected.length !== last.length) return false;
	const selectedAllSameRank = selected.every(
		(c) => c.rank === selected[0].rank,
	);
	const lastAllSameRank = last.every((c) => c.rank === last[0].rank);
	if (selectedAllSameRank && lastAllSameRank) {
		return getCardPower(maxSelected) > getCardPower(maxLast);
	}
	const selectedIsSeq = isSequence(selected);
	const lastIsSeq = isSequence(last);
	if (selectedIsSeq && lastIsSeq) {
		return getCardPower(maxSelected) > getCardPower(maxLast);
	}
	return false;
};

export const validateOpponentMove = (
	cardIds: unknown,
	reportedCount: unknown,
	opponentCardIds: number[],
	lastPlayedCards: Card[],
	requiredOpeningCardId: number | null,
) => {
	if (!isValidCardIdList(cardIds)) return null;
	if (!cardIds.every((id) => opponentCardIds.includes(id))) return null;
	const playedCards = cardIds.map(createCard);
	const nextOpponentCardIds = removeCardIds(opponentCardIds, cardIds);
	const expectedCount = nextOpponentCardIds.length;
	if (expectedCount < 0) return null;
	if (typeof reportedCount !== "number") return null;
	if (reportedCount !== expectedCount) return null;
	if (!isValidMove(playedCards, lastPlayedCards, requiredOpeningCardId))
		return null;

	return {
		playedCards,
		nextOpponentCardIds,
		nextOpponentCount: expectedCount,
	};
};
