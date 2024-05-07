/** the initial max members allowed for new squads */
export const INITIAL_MAX_MEMBERS = 10;
/** the max amount of max members a squad can have */
export const MAX_MEMBERS_LIMIT = 100;

/** the increase in max members count upon upgrading once */
export const MAX_MEMBERS_INCREASE_UPON_UPGRADE = 5;

/**
 * Gets the total number of leaders allowed for a squad given the current max members count.
 */
export const SQUAD_MAX_LEADERS = (currentMaxMembers: number) => {
    if (currentMaxMembers < 25) {
        return 1;
    } else if (currentMaxMembers < 50) {
        return 2;
    } else if (currentMaxMembers < 100) {
        return 3;
    } else {
        return 5;
    }
}

/**
 * Gets the cost (in xCookies) for upgrading the max members count of a squad.
 * 
 * Each upgrade increases the max members count by `MAX_MEMBERS_INCREASE_UPON_UPGRADE`.
 */
export const UPGRADE_SQUAD_MAX_MEMBERS_COST = (currentMaxMembers: number) => {
    if (currentMaxMembers < 25) {
        return 2;
    } else if (currentMaxMembers < 50) {
        return 5;
    } else if (currentMaxMembers < 100) {
        return 10;
    } else {
        return 20;
    }
}

/** cost in xCookies for creating a squad */
export const CREATE_SQUAD_COST = 5;