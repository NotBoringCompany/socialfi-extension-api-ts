import { KOSAuraTypes, KOSHouseTypes, KOSMetadata, KOSPillarTypes, KOSPodiumTypes } from '../../models/kos';

/** represents the current pillar rotation where, if a user obtains X amount of keys with this pillar, they get benefits. */
export const CURRENT_PILLAR_ROTATION: KOSPillarTypes = KOSPillarTypes.PILLAR_OF_ETERNITY;
/** represents the current podium rotation where, if a user obtains X amount of keys with this podium, they get benefits. */
export const CURRENT_PODIUM_ROTATION: KOSPodiumTypes = KOSPodiumTypes.TIMELESS_TRIUNE;
/** represents the current aura rotation where, if a user obtains X amount of keys with this aura, they get benefits. */
export const CURRENT_AURA_ROTATION: KOSAuraTypes = KOSAuraTypes.SNOW;
/** represents the current house rotation where, if a user obtains X amount of keys with this house, they get benefits. */
export const CURRENT_HOUSE_ROTATION: KOSHouseTypes = KOSHouseTypes.TRADITION;

/** a constant used to calculate the weekly xCookies earnable for KOS benefits */
export const BASE_X_COOKIES_EARNING_RATE = 900;
/** a constant used to calculate the weekly xCookies earnable for KOS benefits */
export const BASE_X_COOKIES_EARNING_GROWTH_RATE = 25;
/** the exponential decay constant used to calculate weekly xCookies earnable for KOS benefits */
export const BASE_X_COOKIES_EXPONENTIAL_DECAY_RATE = 0.0002;

/**
 * Gets the benefits (xCookies and gathering boosters) for holding a certain amount of keys and other requirements daily.
 */
export const KOS_DAILY_BENEFITS = (
    keys: KOSMetadata[],
): {
    xCookies: number,
    gatheringBooster25: number,
    gatheringBooster50: number,
    gatheringBooster100: number
} => {
    const bronzeKeys = keys.filter(key => key.attributes.find(attr => attr.traitType === 'Coating' && attr.value === 'Bronze')).length;
    const silverKeys = keys.filter(key => key.attributes.find(attr => attr.traitType === 'Coating' && attr.value === 'Silver')).length;
    const goldKeys = keys.filter(key => key.attributes.find(attr => attr.traitType === 'Coating' && attr.value === 'Gold')).length;
    // const keysOwned = keys.length;

    // let xCookies: number = 0;
    const earnableGatheringBooster25 = KOS_BENEFITS_EARNABLE_GATHERING_BOOSTER_25(bronzeKeys);
    const earnableGatheringBooster50 = KOS_BENEFITS_EARNABLE_GATHERING_BOOSTER_50(silverKeys);
    const earnableGatheringBooster100 = KOS_BENEFITS_EARNABLE_GATHERING_BOOSTER_100(goldKeys);

    // if (keysOwned < 1) {
    //     xCookies = 0;
    // } else if (keysOwned === 1) {
    //     xCookies = 50;
    // } else if (keysOwned === 2) {
    //     xCookies = 60;
    // } else if (keysOwned >= 3 && keysOwned < 5) {
    //     xCookies = 90;
    // } else if (keysOwned >= 5 && keysOwned < 7) {
    //     xCookies = 150;
    // } else if (keysOwned >= 7 && keysOwned < 15) {
    //     xCookies = 210;
    // } else if (keysOwned >= 15 && keysOwned < 25) {
    //     xCookies = 450;
    // } else if (keysOwned >= 25 && keysOwned < 50) {
    //     xCookies = 750;
    // } else if (keysOwned >= 50 && keysOwned < 100) {
    //     xCookies = 1500;
    // } else if (keysOwned >= 100 && keysOwned < 200) {
    //     xCookies = 3000;
    // } else {
    //     xCookies = 6000;
    // }

    return {
        xCookies: 0,
        gatheringBooster25: earnableGatheringBooster25,
        gatheringBooster50: earnableGatheringBooster50,
        gatheringBooster100: earnableGatheringBooster100
    }
}

/**
 * Gets the benefits for holding a certain amount of keys and other requirements weekly.
 */
export const KOS_WEEKLY_BENEFITS = (
    keys: KOSMetadata[],
    keychainsOwned: number,
    superiorKeychainsOwned: number
): {
    points: number,
    xCookies: number,
    bitOrbI: number,
    bitOrbII: number,
    terraCapI: number,
    terraCapII: number,
    raftBooster60: number,
} => {
    // there are 3 auras, snow, lightning and smoke. check if the user has all 3 auras from all the keys (not for each key since they can only have 1 aura each)
    const hasAllAuras = keys.filter(key => key.attributes.find(attr => attr.traitType === 'Aura' && (attr.value === 'Snow' || attr.value === 'Lightning' || attr.value === 'Smoke'))).length === 3;
    // there are 3 houses, tradition, chaos and glory. check if the user has all 3 houses from all the keys (not for each key since they can only have 1 house each)
    const hasAllHouses = keys.filter(key => key.attributes.find(attr => attr.traitType === 'House' && (attr.value === 'Tradition' || attr.value === 'Chaos' || attr.value === 'Glory'))).length === 3;
    // there are 3 podiums, timeless triune, primordial prism and stellar selenite. check if the user has all 3 podiums from all the keys (not for each key since they can only have 1 podium each)
    const hasAllPodiums = keys.filter(key => key.attributes.find(attr => attr.traitType === 'Podium' && (attr.value === 'Timeless Triune' || attr.value === 'Primordial Prism' || attr.value === 'Stellar Selenite'))).length === 3;

    const points = KOS_BENEFITS_POINTS_FORMULA(keys);
    const xCookies = KOS_BENEFITS_X_COOKIES_FORMULA(keys, keychainsOwned, superiorKeychainsOwned);
    const obtainableBitOrbI = KOS_BENEFITS_EARNABLE_BIT_ORB_I(keys.filter(key => key.attributes.find(attr => attr.traitType === 'Aura' && attr.value === CURRENT_AURA_ROTATION)).length);
    const obtainableTerraCapI = KOS_BENEFITS_EARNABLE_TERRA_CAP_I(keys.filter(key => key.attributes.find(attr => attr.traitType === 'House' && attr.value === CURRENT_HOUSE_ROTATION)).length);

    const obtainableRaftBooster60 = hasAllAuras ? 5 : 0;
    const obtainableBitOrbII = hasAllHouses ? 1 : 0;
    const obtainableTerraCapII = hasAllPodiums ? 1 : 0;

    return {
        points,
        xCookies,
        bitOrbI: obtainableBitOrbI,
        bitOrbII: obtainableBitOrbII,
        terraCapI: obtainableTerraCapI,
        terraCapII: obtainableTerraCapII,
        raftBooster60: obtainableRaftBooster60,
    }
}

/**
 * Gets the total number of Bit Orb (I) earnable from holding a certain amount of keys with the aura that's currently rotating.
 */
export const KOS_BENEFITS_EARNABLE_BIT_ORB_I = (keysWithAuraRotationOwned: number): number => {
    if (keysWithAuraRotationOwned < 1) {
        return 0;
    } else if (keysWithAuraRotationOwned === 1) {
        return 1;
    } else if (keysWithAuraRotationOwned === 2) {
        return 2;
    } else if (keysWithAuraRotationOwned >= 3 && keysWithAuraRotationOwned < 5) {
        return 3;
    } else if (keysWithAuraRotationOwned >= 5 && keysWithAuraRotationOwned < 7) {
        return 4;
    } else if (keysWithAuraRotationOwned >= 7 && keysWithAuraRotationOwned < 15) {
        return 5;
    } else if (keysWithAuraRotationOwned >= 15 && keysWithAuraRotationOwned < 25) {
        return 8;
    } else if (keysWithAuraRotationOwned >= 25 && keysWithAuraRotationOwned < 50) {
        return 15;
    } else {
        return 25;
    }
}

/**
 * Gets the total number of Terra Capsulator (I) earnable from holding a certain amount of keys with the house that's currently rotating.
 */
export const KOS_BENEFITS_EARNABLE_TERRA_CAP_I = (keysWithHouseRotationOwned: number): number => {
    if (keysWithHouseRotationOwned < 1) {
        return 0;
    } else if (keysWithHouseRotationOwned === 1) {
        return 1;
    } else if (keysWithHouseRotationOwned === 2) {
        return 2;
    } else if (keysWithHouseRotationOwned >= 3 && keysWithHouseRotationOwned < 5) {
        return 3;
    } else if (keysWithHouseRotationOwned >= 5 && keysWithHouseRotationOwned < 7) {
        return 4;
    } else if (keysWithHouseRotationOwned >= 7 && keysWithHouseRotationOwned < 15) {
        return 5;
    } else if (keysWithHouseRotationOwned >= 15 && keysWithHouseRotationOwned < 25) {
        return 8;
    } else if (keysWithHouseRotationOwned >= 25 && keysWithHouseRotationOwned < 50) {
        return 15;
    } else {
        return 25;
    }
}

/**
 * Gets the total number of 25% gathering boosters earnable from holding a certain amount of keys with bronze coating.
 */
export const KOS_BENEFITS_EARNABLE_GATHERING_BOOSTER_25 = (bronzeKeys: number): number => {
    if (bronzeKeys < 1) {
        return 0;
    } else if (bronzeKeys === 1) {
        return 5;
    } else if (bronzeKeys === 2) {
        return 10;
    } else if (bronzeKeys >= 3 && bronzeKeys < 5) {
        return 15;
    } else if (bronzeKeys >= 5 && bronzeKeys < 7) {
        return 25;
    } else if (bronzeKeys >= 7 && bronzeKeys < 15) {
        return 35;
    } else if (bronzeKeys >= 15 && bronzeKeys < 25) {
        return 50;
    } else if (bronzeKeys >= 25 && bronzeKeys < 50) {
        return 80;
    } else {
        return 125;
    }
}

/**
 * Gets the total number of 50% gathering boosters earnable from holding a certain amount of keys with silver coating. 
 */
export const KOS_BENEFITS_EARNABLE_GATHERING_BOOSTER_50 = (silverKeys: number): number => {
    if (silverKeys < 1) {
        return 0;
    } else if (silverKeys === 1) {
        return 5;
    } else if (silverKeys === 2) {
        return 10;
    } else if (silverKeys >= 3 && silverKeys < 5) {
        return 15;
    } else if (silverKeys >= 5 && silverKeys < 7) {
        return 25;
    } else if (silverKeys >= 7 && silverKeys < 15) {
        return 35;
    } else if (silverKeys >= 15 && silverKeys < 25) {
        return 50;
    } else if (silverKeys >= 25 && silverKeys < 50) {
        return 80;
    } else {
        return 125;
    }
}

/**
 * Gets the total number of 100% gathering boosters earnable from holding a certain amount of keys with gold coating.
 */
export const KOS_BENEFITS_EARNABLE_GATHERING_BOOSTER_100 = (goldKeys: number): number => {
    if (goldKeys < 1) {
        return 0;
    } else if (goldKeys === 1) {
        return 5;
    } else if (goldKeys === 2) {
        return 10;
    } else if (goldKeys >= 3 && goldKeys < 5) {
        return 15;
    } else if (goldKeys >= 5 && goldKeys < 7) {
        return 25;
    } else if (goldKeys >= 7 && goldKeys < 15) {
        return 35;
    } else if (goldKeys >= 15 && goldKeys < 25) {
        return 50;
    } else if (goldKeys >= 25 && goldKeys < 50) {
        return 80;
    } else {
        return 125;
    }
}

/**
 * Gets the points obtainable weekly from the benefits of holding a certain amount of keys based on its luck-related attributes as well.
 */
export const KOS_BENEFITS_POINTS_FORMULA = (
    keys: KOSMetadata[],
): number => {
    const keysOwned = keys.length;

    if (keysOwned < 1) {
        return 0;
    } else if (keysOwned == 1) {
        return 50;
    } else if (keysOwned >= 2 && keysOwned < 5) {
        return 250;
    } else if (keysOwned >= 5 && keysOwned < 7) {
        return 500;
    } else if (keysOwned >= 7 && keysOwned < 10) {
        return 1000;
    } else if (keysOwned >= 10 && keysOwned < 25) {
        return 1500;
    } else if (keysOwned >= 25 && keysOwned < 100) {
        return 2000;
    } else {
        return 3000;
    }
}

/**
 * Gets the total xCookies earnable weekly from the benefits of holding a certain amount of keys based on its luck-related attributes as well.
 */
export const KOS_BENEFITS_X_COOKIES_FORMULA = (
    keys: KOSMetadata[],
    keychainsOwned: number,
    superiorKeychainsOwned: number
): number => {
    const keysOwned = keys.length;

    if (keysOwned === 0) return 0;

    if (keysOwned < 7) {
        if (keysOwned === 1) return 150;
        if (keysOwned === 2) return 300;
        if (keysOwned === 3) return 450;
        if (keysOwned === 4) return 600;
        if (keysOwned === 5) return 800;
        if (keysOwned === 6) return 1000;
    }

    // for every keychain owned, add 0.06% to the total multiplier. for every superior keychain owned, add 0.4% to the total multiplier.
    const totalKeychainMultiplier = 1 + (keychainsOwned * 0.0006) + (superiorKeychainsOwned * 0.004);

    const averageLuck = keys.length > 0 ? keys.reduce((acc, key) => acc + parseInt(key.attributes.find(attr => attr.traitType === 'Luck')?.value as string ?? '0'), 0) / keysOwned : 0;
    const averageLuckBoost = keys.length > 0 ? keys.reduce((acc, key) => acc + parseInt(key.attributes.find(attr => attr.traitType === 'Luck Boost')?.value as string ?? '0'), 0) / keysOwned : 0;

    return Math.floor(
        BASE_X_COOKIES_EARNING_RATE +
            (BASE_X_COOKIES_EARNING_GROWTH_RATE + averageLuck) *
                (1 + (averageLuckBoost / 100)) * totalKeychainMultiplier *
                (keysOwned - 1) *
                Math.exp(-BASE_X_COOKIES_EXPONENTIAL_DECAY_RATE * (keysOwned - 1))
    );
}
