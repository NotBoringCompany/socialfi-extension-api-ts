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