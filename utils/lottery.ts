/**
 * Checks if two sets are equal. Used mainly for lottery draw verification.
 */
export const areSetsEqual = (setA: Set<number>, setB: Set<number>): boolean => {
    if (setA.size !== setB.size) return false;
    for (let a of setA) if (!setB.has(a)) return false;

    return true;
}