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
    /** the amount of food */
    amount: number;
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