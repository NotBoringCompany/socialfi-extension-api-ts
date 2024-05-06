/** the initial max members allowed for new squads */
export const INITIAL_MAX_MEMBERS = 10;

/**
 * Gets the next max members count for a squad given the current max members count.
 */
export const NEXT_MAX_MEMBERS = (currentMaxMembers: number) => {
    switch (currentMaxMembers) {
        case 10:
            return 25;
        case 25:
            return 50;
        case 50:
            return 100;
        case 100:
            return 100;
        default:
            throw new Error('(NEXT_MAX_MEMBERS) Invalid max members count');
    }
}

/** cost in xCookies for creating a squad */
export const CREATE_SQUAD_COST = 5;