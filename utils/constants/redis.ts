import Redis from 'ioredis';
import { getLatestBitId } from '../../api/bit';
import { getLatestIslandId } from '../../api/island';
import { getLatestRaftId } from '../../api/raft';
import { getLatestBitCosmeticId } from '../../api/cosmetic';

export const redis = new Redis(process.env.REDIS_URL);

redis.on('connect', async () => {
    console.log('Redis connected, URL: ' + process.env.REDIS_URL);

    // initialize bit latest id counter
    getLatestBitId();

    // initialize island latest id counter
    getLatestIslandId();

    // initialize raft latest id counter
    getLatestRaftId();

    // initialize bit cosmetic latest id counter
    getLatestBitCosmeticId();
});
