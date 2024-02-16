import { Prize } from '../../models/lottery';
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
 * 
 *  If both `fixedAmount` and `points` are 0, then there is no prize.
 * 
 * If both `fixedAmount` and `points` are > 0, the lowest value out of the two after calculation will be the prize.
 * Prizes that use `points` will be calculated as follows: points / total points from all tickets * total prize pool.
 */
export const lotteryPrizeTier = (pickedNumbers: number[], winningNumbers: Set<number>): Prize => {
    const matchingNormalCount = countMatchingNormalNumbers(pickedNumbers, winningNumbers);
    const specialCorrect = isSpecialNumberCorrect(pickedNumbers, winningNumbers);

    if (matchingNormalCount === 0 && specialCorrect) {
        return {
            fixedAmount: 2,
            points: 1
        }
    } else if (matchingNormalCount === 1 && specialCorrect) {
        return {
            fixedAmount: 2,
            points: 1
        }
    } else if (matchingNormalCount === 2 && specialCorrect) {
        return {
            fixedAmount: 4,
            points: 2
        }
    } else if (matchingNormalCount === 3 && !specialCorrect) {
        return {
            fixedAmount: 4,
            points: 2
        }
    } else if (matchingNormalCount === 3 && specialCorrect) {
        return {
            fixedAmount: 50,
            points: 25
        }
    } else if (matchingNormalCount === 4 && !specialCorrect) {
        return {
            fixedAmount: 50,
            points: 25
        }
    } else if (matchingNormalCount === 4 && specialCorrect) {
        return {
            fixedAmount: 25000,
            points: 12500
        }
    } else if (matchingNormalCount === 5 && !specialCorrect) {
        return {
            fixedAmount: 500000,
            points: 250000
        }
    } else if (matchingNormalCount === 5 && specialCorrect) {
        return {
            fixedAmount: 15000000,
            points: 7500000
        }
    } else {
        return {
            fixedAmount: 0,
            points: 0
        }
    }
}