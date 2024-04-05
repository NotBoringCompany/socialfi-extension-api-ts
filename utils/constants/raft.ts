/**
 * Randomizes the raft's base speed (+- 10% of 10 m/s)
 */
export const randomizeRaftBaseSpeed = () => {
    return 10 + Math.random() * 2 - 1;
}

/**
 * Gets the actual raft speed based on its level.
 */
export const ACTUAL_RAFT_SPEED = (baseSpeed: number, currentLevel: number) => {
    return baseSpeed + (0.1 * currentLevel - 1);
}

/**
 * Calculates the cost (in xCookies) of evolving the raft given the current level of the raft.
 */
export const RAFT_EVOLUTION_COST = (currentLevel: number) => {
    // price starts at 600 cookies at currentLevel of 1 and 100 cookies increase per level
    return 500 + (100 * currentLevel);
}