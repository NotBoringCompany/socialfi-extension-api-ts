/**
 * Represents a modifier instance (which shows the origin and the value of the modifier).
 */
export interface Modifier {
    /** origin of the modifier */
    origin: string;
    /** value of the modifier */
    value: number;
}

/**
 * Represents the modifier effect of a Bit's trait.
 */
export interface BitTraitModifier {
    bitGatheringRate?: Modifier;
    bitEarningRate?: Modifier;
    energyDepletionRate?: Modifier;
    foodConsumptionEfficiency?: Modifier;
    islandGatheringRate?: Modifier;
    islandEarningRate?: Modifier;
}