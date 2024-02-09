import { ObtainMethod } from './obtainMethod';

/****************
 * TERRA CAPSULATOR-RELATED MODELS
 ****************/

/**
 * Represents a Terra Capsulator.
 */
export interface TerraCapsulator {
    /** unique id to distinguish the terra capsulator, starts from 1 */
    terraCapsulatorId: number;
    /** owner of this terra capsulator; equates to the user's object ID in the database */
    owner: string;
    /** obtain method of the terra capsulator */
    obtainMethod: ObtainMethod;
    /** purchase date of this terra capsulator (currently limited to when it was obtained from our shop) */
    purchaseDate: number;
    /** data of the terra capsulator when it is opened; will default to default values if not yet opened */
    openedData: OpenedTerraCapsulatorData;
}

/**
 * Represents the data of the terra capsulator when it is opened.
 */
export interface OpenedTerraCapsulatorData {
    /** if the terra capsulator is opened */
    opened: boolean;
    /** the timestamp of when the terra capsulator was opened; 0 if not opened yet */
    openedTimestamp: number;
    /** the ID of the island obtained from this terra capsulator if already opened */
    obtainedIslandId: number;
}