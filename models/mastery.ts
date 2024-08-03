export interface TappingMastery {
    level: number;
    totalExp: number;
    rerollCount: number;
}

export interface CraftingMastery
{
    level: number;
    totalExp: number;
}

export interface SmeltingMastery extends CraftingMastery
{

}

export interface CookingMastery extends CraftingMastery
{

}

export interface CarpentingMastery extends CraftingMastery
{

}

export interface TailoringMastery extends CraftingMastery
{

}