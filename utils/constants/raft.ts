/** the maximum amount of bits allowed in a raft */
export const RAFT_BIT_PLACEMENT_CAP = 5;
/** the maximum level of a raft */
export const RAFT_MAX_LEVEL = 30;

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

/**
 * Calculates the cost (in seaweed) to evolve a user's raft to the next level.
 */
export const RAFT_EVOLUTION_COST = (currentLevel: number): number => {
    if (currentLevel === 30) throw new Error(`(RAFT_EVOLUTION_COST) Raft is already at max level: ${currentLevel}`);

    // level 1 starts with 10 seaweed, and every level after is 1.125x the previous level
    return 10 * (1.125 ** (currentLevel - 1)); 
}