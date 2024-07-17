/**
 * Represents a Tapping data
 */
export interface Tapping {
    type: TappingType;
    amount: number;
}

/**
 * Represents the tapping type
 */
export enum TappingType {
    ISLAND = 'Island',
}