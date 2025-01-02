import Redis from 'ioredis';
import { getLatestBitId } from '../../api/bit';
import { getLatestIslandId } from '../../api/island';
import { getLatestRaftId } from '../../api/raft';
import { getUserId } from '../../api/user';

export const redis = new Redis(process.env.REDIS_URL);

redis.on('connect', async () => {
    console.log('Redis connected');

    // initialize bit latest id counter
    getLatestBitId();

    // initialize island latest id counter
    getLatestIslandId();

    // initialize raft latest id counter
    getLatestRaftId();

    // initialize user latest id counter
    getUserId();
});
