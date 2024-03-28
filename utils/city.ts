import { City, CityName } from '../models/city';

/**
 * A list of all cities in the game.
 */
export const cities: City[] = [
    {
      name: CityName.HOME,
      distanceTo: {
        [CityName.EVERGREEN_VILLAGE]: 20000, // ~33 minutes
        [CityName.PALMSHADE_VILLAGE]: 30000, // ~50 minutes
        [CityName.SEABREEZE_HARBOR]: 45000, // ~75 minutes
        [CityName.STARFALL_SANCTUARY]: 60000, // ~100 minutes
      },
      shop: {
        globalItems: [],
        playerItems: []
      }
    },
    {
      name: CityName.EVERGREEN_VILLAGE,
      distanceTo: {
        [CityName.HOME]: 20000, // ~33 minutes
        [CityName.PALMSHADE_VILLAGE]: 15000, // ~25 minutes
        [CityName.SEABREEZE_HARBOR]: 55000, // ~92 minutes
        [CityName.STARFALL_SANCTUARY]: 70000, // ~117 minutes
      },
      shop: {
        globalItems: [],
        playerItems: []
      }
    },
    {
      name: CityName.PALMSHADE_VILLAGE,
      distanceTo: {
        [CityName.HOME]: 30000, // ~50 minutes
        [CityName.EVERGREEN_VILLAGE]: 15000, // ~25 minutes
        [CityName.SEABREEZE_HARBOR]: 22000, // ~37 minutes
        [CityName.STARFALL_SANCTUARY]: 50000, // ~83 minutes
      },
      shop: {
        globalItems: [],
        playerItems: []
      }
    },
    {
      name: CityName.SEABREEZE_HARBOR,
      distanceTo: {
        [CityName.HOME]: 45000, // ~75 minutes
        [CityName.EVERGREEN_VILLAGE]: 55000, // ~92 minutes
        [CityName.PALMSHADE_VILLAGE]: 22000, // ~37 minutes
        [CityName.STARFALL_SANCTUARY]: 12000, // ~20 minutes
      },
      shop: {
        globalItems: [],
        playerItems: []
      }
    },
    {
      name: CityName.STARFALL_SANCTUARY,
      distanceTo: {
        [CityName.HOME]: 60000, // ~100 minutes
        [CityName.EVERGREEN_VILLAGE]: 70000, // ~117 minutes
        [CityName.PALMSHADE_VILLAGE]: 50000, // ~83 minutes
        [CityName.SEABREEZE_HARBOR]: 12000, // ~20 minutes
      },
      shop: {
        globalItems: [],
        playerItems: []
      }
    }
  ];