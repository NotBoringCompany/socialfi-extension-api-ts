/****************
 * FOOD-RELATED MODELS
 ****************/

/**
 * Represents a food.
 * 
 * Since this is not an SFT/NFT yet, we don't associate a single food with an ID, but rather treat it as a quantitative asset.
 */
export interface Food {
    /** the type of food */
    type: FoodType;
    /** 
     * the amount of food 
     * 
     * for the inventory, this includes both mintable and non-mintable amounts combined.
     */
    amount: number;
    /**
     * the amount from `amount` of this food that can be minted as SFTs.
     */
    mintableAmount?: number;
}

/**
 * Represents the type of food.
 */
export enum FoodType {
    CANDY = 'Candy',
    CHOCOLATE = 'Chocolate',
    JUICE = 'Juice',
    BURGER = 'Burger',
}