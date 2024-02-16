import { PrizeTier } from '../../models/lottery';
import { ResourceType } from '../../models/resource';
import { countMatchingNormalNumbers, isSpecialNumberCorrect } from '../lottery';

/**
 * Calculates the cost of a lottery ticket based on the resource type.
 * 
 * Returns the cost in x amount of the resource type.
 */
export const lotteryTicketCost = (resourceType: ResourceType): number => {
    switch (resourceType) {
        case ResourceType.STONE:
            return 1;
        case ResourceType.KERATIN:
            return 1/3;
        case ResourceType.SILVER:
            return 1/7;
        case ResourceType.DIAMOND:
            return 1/25;
        case ResourceType.RELIC:
            return 1/75;
        default:
            throw new Error(`(lotteryTicketCost) Invalid resource type: ${resourceType.toString()}`)
    }
}

/**
 * Returns the prize tier for a ticket given the `pickedNumbers` and `winningNumbers` of that draw.
 */
export const lotteryPrizeTier = (pickedNumbers: number[], winningNumbers: Set<number>): PrizeTier => {
    const matchingNormalCount = countMatchingNormalNumbers(pickedNumbers, winningNumbers);
    const specialCorrect = isSpecialNumberCorrect(pickedNumbers, winningNumbers);

    if (matchingNormalCount === 0 && specialCorrect) return PrizeTier.MATCH_SPECIAL_ONLY;
    if (matchingNormalCount === 1 && specialCorrect) return PrizeTier.MATCH_1_PLUS_SPECIAL;
    if (matchingNormalCount === 2 && specialCorrect) return PrizeTier.MATCH_2_PLUS_SPECIAL;
    if (matchingNormalCount === 3 && !specialCorrect) return PrizeTier.MATCH_3_ONLY;
    if (matchingNormalCount === 3 && specialCorrect) return PrizeTier.MATCH_3_PLUS_SPECIAL;
    if (matchingNormalCount === 4 && !specialCorrect) return PrizeTier.MATCH_4_ONLY;
    if (matchingNormalCount === 4 && specialCorrect) return PrizeTier.MATCH_4_PLUS_SPECIAL;
    if (matchingNormalCount === 5 && !specialCorrect) return PrizeTier.MATCH_5_ONLY;
    if (matchingNormalCount === 5 && specialCorrect) return PrizeTier.JACKPOT;

    return PrizeTier.NO_PRIZE;
}