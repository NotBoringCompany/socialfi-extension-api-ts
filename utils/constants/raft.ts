/**
 * Randomizes the raft's base speed (+- 10% of 10 m/s)
 */
export const randomizeRaftBaseSpeed = () => {
    return 10 + Math.random() * 2 - 1;
}