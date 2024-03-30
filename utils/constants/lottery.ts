import { Prize } from '../../models/lottery';
import { ResourceRarity, ResourceType } from '../../models/resource';
import { countMatchingNormalNumbers, isSpecialNumberCorrect } from '../lottery';
import { resources } from './resource';

/**
 * Calculates the cost of a lottery ticket based on the resource type.
 * 
 * Returns the cost in x amount of the resource type.
 */
export const lotteryTicketCost = (resourceType: ResourceType): number => {
    // check if the resource type is either common, uncommon, rare, epic or legendary
    // from the `resources` array
    const resource = resources.find(r => r.type === resourceType);

    if (!resource) {
        throw new Error(`(lotteryTicketCost) Invalid resource type: ${resourceType.toString()}`);
    }

    switch (resource.rarity) {
        case ResourceRarity.COMMON:
            return 1;
        case ResourceRarity.UNCOMMON:
            return 1 / 3;
        case ResourceRarity.RARE:
            return 1 / 7;
        case ResourceRarity.EPIC:
            return 1 / 25;
        case ResourceRarity.LEGENDARY:
            return 1 / 75;
        default:
            throw new Error(`(lotteryTicketCost) Invalid resource rarity: ${resource.rarity}`);
    
    }
}

/**
 * Returns the prize tier for a ticket given the `pickedNumbers` and `winningNumbers` of that draw.
 * 
 *  If both `fixedAmount` and `points` are 0, then there is no prize.
 * 
 * If both `fixedAmount` and `points` are > 0, the lowest value out of the two after calculation will be the prize.
 * Prizes that use `points` will be calculated as follows: points / total points from all tickets * total prize pool.
 * 
 * `fixedAmount` is in ETH; assuming 1 ETH = $2800.
 */
export const lotteryPrizeTier = (pickedNumbers: number[], winningNumbers: Set<number>): Prize => {
    const matchingNormalCount = countMatchingNormalNumbers(pickedNumbers, winningNumbers);
    const specialCorrect = isSpecialNumberCorrect(pickedNumbers, winningNumbers);

    if (matchingNormalCount === 0 && specialCorrect) {
        return {
            fixedAmount: 0.001,
            points: 1
        }
    } else if (matchingNormalCount === 1 && specialCorrect) {
        return {
            fixedAmount: 0.001,
            points: 1
        }
    } else if (matchingNormalCount === 2 && specialCorrect) {
        return {
            fixedAmount: 0.002,
            points: 2
        }
    } else if (matchingNormalCount === 3 && !specialCorrect) {
        return {
            fixedAmount: 0.002,
            points: 2
        }
    } else if (matchingNormalCount === 3 && specialCorrect) {
        return {
            fixedAmount: 0.0025,
            points: 25
        }
    } else if (matchingNormalCount === 4 && !specialCorrect) {
        return {
            fixedAmount: 0.0025,
            points: 25
        }
    } else if (matchingNormalCount === 4 && specialCorrect) {
        return {
            fixedAmount: 8.9,
            points: 12500
        }
    } else if (matchingNormalCount === 5 && !specialCorrect) {
        return {
            fixedAmount: 175,
            points: 250000
        }
    } else if (matchingNormalCount === 5 && specialCorrect) {
        return {
            fixedAmount: 5350,
            points: 7500000
        }
    } else {
        return {
            fixedAmount: 0,
            points: 0
        }
    }
}