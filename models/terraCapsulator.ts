// import { ObtainMethod } from './obtainMethod';

// /****************
//  * TERRA CAPSULATOR-RELATED MODELS
//  ****************/
/**
 * Represents all Terra Capsulator types in the game.
 */
export enum TerraCapsulatorType {
    TERRA_CAPSULATOR_I = 'Terra Capsulator (I)',
    TERRA_CAPSULATOR_II = 'Terra Capsulator (II)',
    TERRA_CAPSULATOR_III = 'Terra Capsulator (III)'
}

/**
 * Represents the interface for a user's terra capsulators owned.
 */
export interface UserTerraCapsulator {
    /** the type of terra capsulator */
    type: TerraCapsulatorType;
    /** the amount of this particular terra capsulator type owned */
    amount: number;
}