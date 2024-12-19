import { POIName } from '../../models/poi';
import { getRandomTimeBetween } from '../time';

/**
 * Time ranges (hour) for resetting the POI item data (in UTC).
 */
export const POI_ITEM_DATA_RESET_TIME_RANGES = [
    { start: 0, end: 2 },
    { start: 8, end: 10 },
    { start: 16, end: 18 }
];

/**
 * Lists the required account level before being able to travel to a specific POI.
 */
export const POI_TRAVEL_LEVEL_REQUIREMENT = (poi: POIName): number => {
    switch (poi) {
        case POIName.HOME:
            return 1;
        case POIName.EVERGREEN_VILLAGE:
            return 1;
        case POIName.PALMSHADE_VILLAGE:
            return 9;
        case POIName.SEABREEZE_HARBOR:
            return 20;
        case POIName.STARFALL_SANCTUARY:
            return 40;
    }
}