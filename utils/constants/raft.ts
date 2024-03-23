/**
 * Randomizes the raft's base speed between 1 to 10.
 */
export const randomizeRaftBaseSpeed = () => {
    return Math.floor(Math.random() * 10) + 1;
}

/**
 * Randomizes the raft's capacity from 3 to 7.
 */
export const randomizeRaftCapacity = () => {
    return Math.floor(Math.random() * 5) + 3;
}