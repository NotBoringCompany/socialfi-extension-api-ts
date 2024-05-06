/** the initial max members allowed for new squads */
export const INITIAL_MAX_MEMBERS = 10;
/** the max amount of max members a squad can have */
export const MAX_MEMBERS_LIMIT = 100;

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

/**
 * Gets the total number of leaders allowed for a squad given the current max members count.
 */
export const SQUAD_MAX_LEADERS = (currentMaxMembers: number) => {
    switch (currentMaxMembers) {
        case 10:
            return 1;
        case 25:
            return 2;
        case 50:
            return 3;
        case 100:
            return 5;
        default:
            throw new Error('(SQUAD_MAX_LEADERS) Invalid max members count');
    }
}

/**
 * Gets the cost (in xCookies) for upgrading the max members count of a squad.
 */
export const SQUAD_MAX_MEMBERS_UPGRADE_COST = (newMaxMembers: number) => {
    switch (newMaxMembers) {
        case 25:
            return 10;
        case 50:
            return 25;
        case 100:
            return 50;
        default:
            throw new Error('(SQUAD_MAX_MEMBERS_UPGRADE_COST) Invalid max members count');
    }
}

/** cost in xCookies for creating a squad */
export const CREATE_SQUAD_COST = 5;