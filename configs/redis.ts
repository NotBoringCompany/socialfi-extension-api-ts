import { configDotenv } from 'dotenv';
import { createClient } from 'redis';

configDotenv();

const redisUrl = process.env.REDIS_URL!;

const redis = createClient({
    url: redisUrl,
});

redis.on('error', (err) => {
    console.log('Redis Client Error', err);
});

redis.connect();

export default redis;
