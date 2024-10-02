import mongoose from 'mongoose';
import { summonBit } from '../api/bitOrb';
import { BitOrbType } from '../models/item';
import { Bit } from '../models/bit';
import { addBitToDatabase } from '../api/bit';
import { redis } from '../utils/constants/redis';
import { BitModel } from '../utils/constants/db';

// Clean up the database before each test
beforeEach(async () => {
    await BitModel.deleteMany({
        owner: 'owner1234',
    });
});

describe('Bit Create', () => {
    test('should not create duplicate bitId', async () => {
        const totalRequests = 20;

        const execute = async (): Promise<Bit> => {
            const bit = await summonBit('owner1234', BitOrbType.BIT_ORB_I);
            await addBitToDatabase(bit.data.bit);

            return bit.data.bit;
        };

        // create an array of promises for concurrent function calls
        const requests = Array.from({ length: totalRequests }, async (_, index) => {
            return await execute();
        });

        // await all requests to complete
        const results = await Promise.all(requests);

        // collect all bitIds from the results
        const bitIds = results.map((res) => res.bitId);

        // check for duplicates
        const uniqueBitIds = new Set(bitIds);

        expect(uniqueBitIds.size).toBe(totalRequests); // Ensure all bitIds are unique
    });
});

// disconnect from the database after all tests
afterAll(async () => {
    await BitModel.deleteMany({
        owner: 'owner1234',
    });

    await mongoose.disconnect();
    await redis.quit();
});
