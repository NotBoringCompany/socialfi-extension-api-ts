/**
 * The base speed of the raft at level 1 (in m/s).
 */
export const RAFT_BASE_SPEED = 10;

/**
 * Gets the actual raft speed based on its level.
 */
export const ACTUAL_RAFT_SPEED = (baseSpeed: number, currentLevel: number) => {
    // Return Current Level Actual Raft Speed from `baseSpeed + (1 * by currentLevel - 1)`
    return baseSpeed + (1 * (currentLevel - 1));
}

/**
 * Calculates the cost (in xCookies) of evolving the raft given the current level of the raft.
 */
export const RAFT_EVOLUTION_COST = (currentLevel: number) => {
    // price starts at 100 cookies at currentLevel of 1 and 50 cookies increase per level
    return 100 + (50 * currentLevel);
}