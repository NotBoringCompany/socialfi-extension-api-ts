import { BitCosmeticEnum, BitCosmeticType } from '../../models/cosmetic';
import { BitCosmeticModel } from './db';

/**
 * Populates the `BitCosmeticEnum` enum with the values from the database.
 */
export const populateBitCosmeticEnum = async (): Promise<void> => {
    try {
        const cosmetics = await BitCosmeticModel.find().lean();

        if (!cosmetics) {
            return;
        }

        cosmetics.forEach(cosmetic => {
            BitCosmeticEnum[cosmetic.name] = cosmetic.name;
        });

        console.log(`(populateBitCosmeticEnum) Successfully populated the BitCosmeticEnum enum.`);
    } catch (err: any) {
        console.error(`(populateBitCosmeticEnum) ${err.message}`);
    }
}