import { Redis } from "ioredis";

const redisDb = new Redis(process.env.REDIS_URL)

redisDb.on('connect', () => {
  console.log('Connected to Redis');
});

redisDb.on('error', (err) => {
  console.error('Redis connection error:', err);
});

export default redisDb