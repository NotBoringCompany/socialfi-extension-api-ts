import { POIName } from '../../models/poi';

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
            return 5;
        case POIName.SEABREEZE_HARBOR:
            return 10;
        case POIName.STARFALL_SANCTUARY:
            return 15;
    }
}