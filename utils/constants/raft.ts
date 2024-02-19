/** the maximum amount of bits allowed in a raft */
export const RAFT_BIT_PLACEMENT_CAP = 5;

/**
 * Gets the gathering rate of seaweed per hour given the bit's level.
 */
export const SEAWEED_GATHERING_RATE = (level: number): number => {
    if (level < 1) throw new Error(`(SEAWEED_LEVEL_GATHERING_RATE) Invalid level: ${level}`);

    // level 1 starts with 1 seaweed/hour; every level after is 1.04x the previous level
    return 1 * (1.04 ** (level - 1));
}

/**
 * Gets the gathering rates of seaweed per hour given the bit's levels.
 * 
 * Calculation is as simple as iterating through the bit's level and incrementing the gathering rates based on each bit.
 */
export const SEAWEED_GATHERING_RATES = (levels: number[]): number => {
    return levels.reduce((acc, level) => acc + SEAWEED_GATHERING_RATE(level), 0);
}