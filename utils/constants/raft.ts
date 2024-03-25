/**
 * Randomizes the raft's base speed between 1 to 10.
 */
export const randomizeRaftBaseSpeed = () => {
    return Math.floor(Math.random() * 10) + 1;
}