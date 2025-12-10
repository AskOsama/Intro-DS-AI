/**
 * GreedyAI - Team 1 Default Agent
 *
 * Strategy: Simple heuristic-based AI
 * - Bids Hokum with strong trump hands (3+ cards with J or 9)
 * - Bids Sun with many high cards (5+ Aces, 10s, Kings)
 * - Plays highest winning card when possible
 * - Plays lowest card when partner is winning
 *
 * This file can be loaded via the AI Upload feature to test the loading mechanism.
 *
 * @author DS-AI Course
 * @version 1.0.0
 */

class CustomAgent extends BalootAIAgent {
    constructor(playerIndex, teamIndex) {
        super(playerIndex, teamIndex);
        this.name = 'GreedyAI';
        this.version = '1.0.0';
        this.hand = [];
        this.playedCards = new Set();
    }

    /**
     * Called when a new round starts
     */
    onRoundStart(roundInfo) {
        this.playedCards.clear();
    }

    /**
     * Called when receiving cards
     */
    onReceiveHand(hand) {
        this.hand = [...hand];
    }

    /**
     * Decide what to bid
     * Strategy:
     * - Round 1: Bid Hokum if 3+ trump cards with J or 9, Sun if 5+ high cards
     * - Round 2: Bid Hokum Second if strong alternative suit
     */
    async decideBid(biddingState) {
        const { biddingCard, biddingRound } = biddingState;
        const hand = this.hand;
        const biddingCardSuit = biddingCard.suit;

        // Count cards in bidding card suit
        const suitCount = hand.filter(c => c.suit === biddingCardSuit).length;
        const hasJack = hand.some(c => c.suit === biddingCardSuit && c.rank === 'J');
        const hasNine = hand.some(c => c.suit === biddingCardSuit && c.rank === '9');

        if (biddingRound === 1) {
            // Strong trump hand: 3+ cards with Jack or Nine
            if (suitCount >= 3 && (hasJack || hasNine)) {
                return { bidType: BID_TYPES.HOKUM };
            }

            // Strong Sun hand: 5+ high cards (A, 10, K)
            const highCards = hand.filter(c => ['A', '10', 'K'].includes(c.rank)).length;
            if (highCards >= 5) {
                return { bidType: BID_TYPES.SUN };
            }

            return { bidType: BID_TYPES.PASS };

        } else {
            // Second round: look for best alternative suit
            const suits = Object.values(SUITS).filter(s => s !== biddingCardSuit);
            let bestSuit = null;
            let bestScore = 0;

            for (const suit of suits) {
                const cards = hand.filter(c => c.suit === suit);
                let score = cards.length * 10;
                if (cards.some(c => c.rank === 'J')) score += 30;
                if (cards.some(c => c.rank === '9')) score += 20;
                if (cards.some(c => c.rank === 'A')) score += 10;

                if (score > bestScore) {
                    bestScore = score;
                    bestSuit = suit;
                }
            }

            // Bid Hokum Second if decent alternative suit
            if (bestScore >= 40 && bestSuit) {
                return { bidType: BID_TYPES.HOKUM_SECOND, suitChoice: bestSuit };
            }

            return { bidType: BID_TYPES.PASS };
        }
    }

    /**
     * Decide which card to play
     * Strategy:
     * - When leading: play highest non-trump, or highest trump
     * - When following: try to win with lowest winning card
     * - When partner winning: play lowest card
     */
    async decideCard(trickState, legalCards) {
        const { currentTrick, trumpSuit, gameType } = trickState;
        const partnerIndex = (this.playerIndex + 2) % 4;

        // Leading
        if (currentTrick.length === 0) {
            // Lead with highest non-trump if possible
            const nonTrump = legalCards.filter(c => c.suit !== trumpSuit);
            if (nonTrump.length > 0) {
                return this.getHighestCard(nonTrump, gameType, false);
            }
            // Otherwise lead with highest trump
            return this.getHighestCard(legalCards, gameType, true);
        }

        // Following
        const ledSuit = currentTrick[0].card.suit;
        const currentWinner = this.getCurrentWinner(currentTrick, trumpSuit, gameType);
        const partnerIsWinning = currentWinner && currentWinner.playerIndex === partnerIndex;

        // Partner is winning - play lowest card
        if (partnerIsWinning) {
            return this.getLowestCard(legalCards, gameType, ledSuit === trumpSuit);
        }

        // Try to win the trick
        const winningCards = legalCards.filter(card =>
            this.cardBeats(card, currentWinner.card, ledSuit, trumpSuit, gameType)
        );

        if (winningCards.length > 0) {
            // Win with lowest winning card to preserve high cards
            return this.getLowestCard(winningCards, gameType, legalCards[0]?.suit === trumpSuit);
        }

        // Can't win - play lowest card
        return this.getLowestCard(legalCards, gameType, false);
    }

    /**
     * Get the highest card by ranking power
     */
    getHighestCard(cards, gameType, isTrump) {
        return cards.reduce((best, card) =>
            card.getRankingPower(gameType, isTrump) > best.getRankingPower(gameType, isTrump)
                ? card : best
        );
    }

    /**
     * Get the lowest card by ranking power
     */
    getLowestCard(cards, gameType, isTrump) {
        return cards.reduce((lowest, card) =>
            card.getRankingPower(gameType, isTrump) < lowest.getRankingPower(gameType, isTrump)
                ? card : lowest
        );
    }

    /**
     * Find current winner of the trick
     */
    getCurrentWinner(trick, trumpSuit, gameType) {
        if (trick.length === 0) return null;

        const ledSuit = trick[0].card.suit;
        let winner = trick[0];

        for (let i = 1; i < trick.length; i++) {
            if (this.cardBeats(trick[i].card, winner.card, ledSuit, trumpSuit, gameType)) {
                winner = trick[i];
            }
        }

        return winner;
    }

    /**
     * Check if card A beats card B
     */
    cardBeats(cardA, cardB, ledSuit, trumpSuit, gameType) {
        const aIsTrump = trumpSuit && cardA.suit === trumpSuit;
        const bIsTrump = trumpSuit && cardB.suit === trumpSuit;

        // Trump beats non-trump
        if (aIsTrump && !bIsTrump) return true;
        if (!aIsTrump && bIsTrump) return false;

        // Both trump - compare trump ranking
        if (aIsTrump && bIsTrump) {
            return cardA.getRankingPower(gameType, true) > cardB.getRankingPower(gameType, true);
        }

        // Non-trump: led suit beats off-suit
        const aIsLed = cardA.suit === ledSuit;
        const bIsLed = cardB.suit === ledSuit;

        if (aIsLed && !bIsLed) return true;
        if (!aIsLed && bIsLed) return false;

        // Same suit - compare normal ranking
        if (cardA.suit === cardB.suit) {
            return cardA.getRankingPower(gameType, false) > cardB.getRankingPower(gameType, false);
        }

        return false;
    }

    /**
     * Track played cards
     */
    onCardPlayed(playerIndex, card) {
        this.playedCards.add(card.id);
    }
}
