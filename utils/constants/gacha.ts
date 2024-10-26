import Bull from 'bull';

/**
 * Creates a new Bull queue for Wonderspin rolls.
 */
export const WONDERSPIN_QUEUE = new Bull('wonderspinQueue', {
    redis: process.env.REDIS_URL
});