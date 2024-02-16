import { ResourceType } from '../../models/resource';

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