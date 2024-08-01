export const TAPPING_LEVEL_CAP = 5;

export const TAPPING_EXP_CAP = 67500;

/** Get tapping exp range for each level */
export const TAPPING_MASTERY_LEVEL = (totalExp: number): number => {
    if (totalExp >= 0 && totalExp <= 4999) {
        return 1;
    } else if (totalExp >= 5000 && totalExp <= 12499) {
        return 2;
    } else if (totalExp >= 12500 && totalExp <= 22499) {
        return 3;
    } else if (totalExp >= 22500 && totalExp <= 34999) {
        return 4;
    } else if (totalExp >= 35000 && totalExp <= 49999) {
        return 5;
    } else if (totalExp >= 50000 && totalExp <= 67499) {
        return 6;
    } else if (totalExp >= 67500 && totalExp <= 87499) {
        return 7;
    } else if (totalExp >= 87500 && totalExp <= 109999) {
        return 8;
    } else if (totalExp >= 110000 && totalExp <= 134999) {
        return 9;
    } else if (totalExp >= 135000 && totalExp <= 162499) {
        return 10;
    } else if (totalExp >= 162500 && totalExp <= 192499) {
        return 11;
    } else if (totalExp >= 192500 && totalExp <= 224999) {
        return 12;
    } else if (totalExp >= 225000 && totalExp <= 259999) {
        return 13;
    } else if (totalExp >= 260000 && totalExp <= 297499) {
        return 14;
    } else if (totalExp >= 297500) {
        return 15;
    } else {
        throw new Error('Invalid experience points');
    }
};