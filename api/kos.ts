import { KEYCHAIN_CONTRACT, KOS_CONTRACT, SUPERIOR_KEYCHAIN_CONTRACT } from '../utils/constants/web3';
import { ReturnValue, Status } from '../utils/retVal';
import { getWallets } from './user';
import { KOSExplicitOwnership, KOSMetadata } from '../models/kos';
import fs from 'fs';
import path from 'path';
import { LeaderboardModel, SquadLeaderboardModel, SquadModel, UserModel } from '../utils/constants/db';
import { KOS_DAILY_BENEFITS, KOS_WEEKLY_BENEFITS } from '../utils/constants/kos';
import { ExtendedXCookieData, XCookieSource } from '../models/user';
import { Item } from '../models/item';
import { BoosterItem } from '../models/booster';
import { LeaderboardPointsSource, LeaderboardUserData } from '../models/leaderboard';
import { GET_SEASON_0_PLAYER_LEVEL, GET_SEASON_0_PLAYER_LEVEL_REWARDS } from '../utils/constants/user';
import { BitOrbType } from '../models/bitOrb';
import { TerraCapsulatorType } from '../models/terraCapsulator';

/**
 * Checks, for each user who owns at least 1 Key of Salvation, if they have owned each key for at least 1 day (from 23:59 UTC the previous day to 23:59 UTC now).
 * If they have, they will be eligible to earn the daily KOS rewards based on the amount of keys that match that 1-day criteria.
 * 
 * Called by a scheduler every day at 23:59 UTC.
 */
export const checkDailyKOSRewards = async (): Promise<ReturnValue> => {
    try {
        const errors: string[] = [];
        const users = await UserModel.find();

        if (!users || users.length === 0) {
            return {
                status: Status.ERROR,
                message: `(checkDailyKOSOwnership) No users found.`
            }
        }

        // fetch the metadata file
        const metadataFile = fetchKOSMetadataFile();

        const bulkWriteOpsPromises = users.map(async (user) => {
            const updateOperations = [];

            // get all owned key IDs of the user
            const { status, message, data } = await getOwnedKeyIDs(user.twitterId);

            if (status !== Status.SUCCESS) {
                errors.push(message + ` User: ${user.twitterId}`);
                // continue to the next user if there was an error
                return [];
            }

            const ownedKeyIds = data.ownedKeyIDs;

            // get the explicit ownerships of the owned key IDs
            const { status: ownershipStatus, message: ownershipMessage, data: ownershipData } = await explicitOwnershipsOfKOS(ownedKeyIds);

            if (ownershipStatus !== Status.SUCCESS) {
                errors.push(ownershipMessage + ` User: ${user.twitterId}`);
                // continue to the next user if there was an error
                return;
            }

            const keyOwnerships = ownershipData.keyOwnerships as KOSExplicitOwnership[];

            // get the total keys owned by the user for at least 1 day
            const validKeys = keyOwnerships.filter((ownership) => ownership.startTimestamp <= Math.floor(Date.now() / 1000) - 86400);

            // get the metadata for each of the valid keys
            const validKeysMetadata: KOSMetadata[] = validKeys.map((key) => {
                return metadataFile.find((metadata) => metadata.keyId === key.tokenId) as KOSMetadata;
            });

            // get the eligible daily rewards
            const { xCookies, gatheringBooster25, gatheringBooster50, gatheringBooster100 } = KOS_DAILY_BENEFITS(validKeysMetadata);

            // // give the user the rewards
            // if (xCookies > 0) {
            //     // if xCookies > 0, do 2 things:
            //     // 1. increment the user's `inventory.xCookieData.currentXCookies` by `xCookies`
            //     // 2. check if the user's `inventory.xCookieData.extendedXCookieData.source` contains `KOS_BENEFITS`.
            //     // if not, add a new entry with `source: KOS_BENEFITS` and `xCookies: xCookies`. else, increment the `xCookies` by `xCookies`.

            //     // increment the user's `inventory.xCookieData.currentXCookies` by `xCookies`
            //     updateOperations.push({
            //         updateOne: {
            //             filter: { twitterId: user.twitterId },
            //             update: {
            //                 $inc: {
            //                     'inventory.xCookieData.currentXCookies': xCookies
            //                 }
            //             }
            //         }
            //     })

            //     // check if the user's `inventory.xCookieData.extendedXCookieData.source` contains `KOS_BENEFITS`.
            //     const kosBenefitsIndex = (user.inventory.xCookieData.extendedXCookieData as ExtendedXCookieData[]).findIndex((data) => data.source === XCookieSource.KOS_BENEFITS);

            //     if (kosBenefitsIndex === -1) {
            //         // if not, add a new entry with `source: KOS_BENEFITS` and `xCookies: xCookies`
            //         updateOperations.push({
            //             updateOne: {
            //                 filter: { twitterId: user.twitterId },
            //                 update: {
            //                     $push: {
            //                         'inventory.xCookieData.extendedXCookieData': {
            //                             source: XCookieSource.KOS_BENEFITS,
            //                             xCookies
            //                         }
            //                     }
            //                 }
            //             }
            //         })
            //     } else {
            //         // else, increment the `xCookies` by `xCookies`
            //         updateOperations.push({
            //             updateOne: {
            //                 filter: { twitterId: user.twitterId },
            //                 update: {
            //                     $inc: {
            //                         [`inventory.xCookieData.extendedXCookieData.${kosBenefitsIndex}.xCookies`]: xCookies
            //                     }
            //                 }
            //             }
            //         })
            //     }
            // }

            // if (gatheringBooster25 > 0) {
            //     // if gatheringBooster25 > 0, check if the user's `inventory.items` contain a `BoosterItem` with `type: GATHERING_PROGRESS_BOOSTER_25`.
            //     // if not, add a new entry with `type: GATHERING_PROGRESS_BOOSTER_25` and `amount: gatheringBooster25`. else, increment the `amount` by `gatheringBooster25`.

            //     // check if the user's `inventory.items` contain a `BoosterItem` with `type: GATHERING_PROGRESS_BOOSTER_25`.
            //     const boosterIndex = (user.inventory.items as Item[]).findIndex((item) => item.type === BoosterItem.GATHERING_PROGRESS_BOOSTER_25);

            //     if (boosterIndex === -1) {
            //         // if not, add a new entry with `type: GATHERING_PROGRESS_BOOSTER_25` and `amount: gatheringBooster25`
            //         updateOperations.push({
            //             updateOne: {
            //                 filter: { twitterId: user.twitterId },
            //                 update: {
            //                     $push: {
            //                         'inventory.items': {
            //                             type: BoosterItem.GATHERING_PROGRESS_BOOSTER_25,
            //                             amount: gatheringBooster25
            //                         }
            //                     }
            //                 }
            //             }
            //         })
            //     } else {
            //         // else, increment the `amount` by `gatheringBooster25`
            //         updateOperations.push({
            //             updateOne: {
            //                 filter: { twitterId: user.twitterId },
            //                 update: {
            //                     $inc: {
            //                         [`inventory.items.${boosterIndex}.amount`]: gatheringBooster25
            //                     }
            //                 }
            //             }
            //         })
            //     }
            // }

            // if (gatheringBooster50 > 0) {
            //     // if gatheringBooster50 > 0, check if the user's `inventory.items` contain a `BoosterItem` with `type: GATHERING_PROGRESS_BOOSTER_50`.
            //     // if not, add a new entry with `type: GATHERING_PROGRESS_BOOSTER_50` and `amount: gatheringBooster50`. else, increment the `amount` by `gatheringBooster50`.

            //     // check if the user's `inventory.items` contain a `BoosterItem` with `type: GATHERING_PROGRESS_BOOSTER_50`.
            //     const boosterIndex = (user.inventory.items as Item[]).findIndex((item) => item.type === BoosterItem.GATHERING_PROGRESS_BOOSTER_50);

            //     if (boosterIndex === -1) {
            //         // if not, add a new entry with `type: GATHERING_PROGRESS_BOOSTER_50` and `amount: gatheringBooster50`
            //         updateOperations.push({
            //             updateOne: {
            //                 filter: { twitterId: user.twitterId },
            //                 update: {
            //                     $push: {
            //                         'inventory.items': {
            //                             type: BoosterItem.GATHERING_PROGRESS_BOOSTER_50,
            //                             amount: gatheringBooster50
            //                         }
            //                     }
            //                 }
            //             }
            //         })
            //     } else {
            //         // else, increment the `amount` by `gatheringBooster50`
            //         updateOperations.push({
            //             updateOne: {
            //                 filter: { twitterId: user.twitterId },
            //                 update: {
            //                     $inc: {
            //                         [`inventory.items.${boosterIndex}.amount`]: gatheringBooster50
            //                     }
            //                 }
            //             }
            //         })
            //     }
            // }

            // if (gatheringBooster100 > 0) {
            //     // if gatheringBooster100 > 0, check if the user's `inventory.items` contain a `BoosterItem` with `type: GATHERING_PROGRESS_BOOSTER_100`.
            //     // if not, add a new entry with `type: GATHERING_PROGRESS_BOOSTER_100` and `amount: gatheringBooster100`. else, increment the `amount` by `gatheringBooster100`.

            //     // check if the user's `inventory.items` contain a `BoosterItem` with `type: GATHERING_PROGRESS_BOOSTER_100`.
            //     const boosterIndex = (user.inventory.items as Item[]).findIndex((item) => item.type === BoosterItem.GATHERING_PROGRESS_BOOSTER_100);

            //     if (boosterIndex === -1) {
            //         // if not, add a new entry with `type: GATHERING_PROGRESS_BOOSTER_100` and `amount: gatheringBooster100`
            //         updateOperations.push({
            //             updateOne: {
            //                 filter: { twitterId: user.twitterId },
            //                 update: {
            //                     $push: {
            //                         'inventory.items': {
            //                             type: BoosterItem.GATHERING_PROGRESS_BOOSTER_100,
            //                             amount: gatheringBooster100
            //                         }
            //                     }
            //                 }
            //             }
            //         })
            //     } else {
            //         // else, increment the `amount` by `gatheringBooster100`
            //         updateOperations.push({
            //             updateOne: {
            //                 filter: { twitterId: user.twitterId },
            //                 update: {
            //                     $inc: {
            //                         [`inventory.items.${boosterIndex}.amount`]: gatheringBooster100
            //                     }
            //                 }
            //             }
            //         })
            //     }
            // }

            return updateOperations;
        });

        // const bulkWriteOpsArrays = await Promise.all(bulkWriteOpsPromises);

        // const bulkWriteOps = bulkWriteOpsArrays.flat().filter(op => op !== undefined);

        // if (bulkWriteOps.length === 0) {
        //     console.log(`(checkDailyKOSOwnership) No users were eligible for daily KOS rewards.`);
        //     return;
        // }

        // // execute the bulk write operations
        // await UserModel.bulkWrite(bulkWriteOps);

        // if (errors.length > 0) {
        //     console.error(`(checkDailyKOSOwnership) Errors: ${errors.join('\n')}`);
        // }

        // console.log(`(checkDailyKOSOwnership) Successfully gave daily KOS rewards.`);
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(checkDailyKOSOwnership) Error: ${err.message}`
        }
    }
}

/**
 * Checks, for each user who owns at least 1 Key of Salvation, Keychain and/or Superior Keychain, if they have owned each key/keychain/superior keychain for at least 7 days (from 23:59 UTC 7 days ago to 23:59 UTC now).
 * 
 * If they have, and if the NFTs match certain required attributes/traits, they will be eligible to earn the weekly KOS rewards based on the amount of keys that match that 7-day criteria.
 */
export const checkWeeklyKOSRewards = async (): Promise<ReturnValue> => {
    try {
        const leaderboard = await LeaderboardModel.findOne({ name: 'Season 0' }).lean();
        const latestSquadLeaderboard = await SquadLeaderboardModel.findOne().sort({ week: -1 }).lean();

        if (!leaderboard) {
            return {
                status: Status.ERROR,
                message: `(checkWeeklyKOSOwnership) Leaderboard not found.`
            };
        }

        if (!latestSquadLeaderboard) {
            return {
                status: Status.ERROR,
                message: `(checkWeeklyKOSOwnership) Squad leaderboard not found.`
            };
        }

        const users = await UserModel.find();

        if (!users || users.length === 0) {
            return {
                status: Status.ERROR,
                message: `(checkWeeklyKOSOwnership) No users found.`
            }
        }

        const errors: string[] = [];

        // fetch the metadata file
        const metadataFile = fetchKOSMetadataFile();

        const bulkWriteOpsPromises = users.map(async (user) => {
            const updateOperations = [];
            const leaderboardUpdateOperations = [];
            const squadUpdateOperations = [];
            const squadLeaderboardUpdateOperations = [];

            // get all owned key IDs of the user
            const { status, message, data } = await getOwnedKeyIDs(user.twitterId);

            if (status !== Status.SUCCESS) {
                errors.push(message + ` User: ${user.twitterId}`);
                // continue to the next user if there was an error
                return [];
            }

            const ownedKeyIds = data.ownedKeyIDs;

            // get the explicit ownerships of the owned key IDs
            const { status: ownershipStatus, message: ownershipMessage, data: ownershipData } = await explicitOwnershipsOfKOS(ownedKeyIds);

            if (ownershipStatus !== Status.SUCCESS) {
                errors.push(ownershipMessage + ` User: ${user.twitterId}`);
                // continue to the next user if there was an error
                return [];
            }

            const keyOwnerships = ownershipData.keyOwnerships as KOSExplicitOwnership[];

            // get the total keys owned by the user for at least 7 days
            const validKeys = keyOwnerships.filter((ownership) => ownership.startTimestamp <= Math.floor(Date.now() / 1000) - 604800);

            // get the metadata for each of the valid keys
            const validKeysMetadata: KOSMetadata[] = validKeys.map((key) => {
                return metadataFile.find((metadata) => metadata.keyId === key.tokenId) as KOSMetadata;
            });

            // get all owned keychain IDs of the user
            const { status: keychainStatus, message: keychainMessage, data: keychainData } = await getOwnedKeychainIDs(user.twitterId);

            if (keychainStatus !== Status.SUCCESS) {
                errors.push(keychainMessage + ` User: ${user.twitterId}`);
                // continue to the next user if there was an error
                return [];
            }

            const ownedKeychainIds = keychainData.ownedKeychainIDs;

            // get the explicit ownerships of the owned keychain IDs
            const { status: keychainOwnershipStatus, message: keychainOwnershipMessage, data: keychainOwnershipData } = await explicitOwnershipsOfKeychain(ownedKeychainIds);

            if (keychainOwnershipStatus !== Status.SUCCESS) {
                errors.push(keychainOwnershipMessage + ` User: ${user.twitterId}`);
                // continue to the next user if there was an error
                return [];
            }

            const keychainOwnerships = keychainOwnershipData.keychainOwnerships as KOSExplicitOwnership[];

            // get the total keychains owned by the user for at least 7 days
            const validKeychains = keychainOwnerships.filter((ownership) => ownership.startTimestamp <= Math.floor(Date.now() / 1000) - 604800);

            // get all owned superior keychain IDs of the user
            const { status: superiorKeychainStatus, message: superiorKeychainMessage, data: superiorKeychainData } = await getOwnedSuperiorKeychainIDs(user.twitterId);

            if (superiorKeychainStatus !== Status.SUCCESS) {
                errors.push(superiorKeychainMessage + ` User: ${user.twitterId}`);
                // continue to the next user if there was an error
                return [];
            }

            const ownedSuperiorKeychainIds = superiorKeychainData.ownedSuperiorKeychainIDs;

            // get the explicit ownerships of the owned keychain IDs
            const { status: superiorKeychainOwnershipStatus, message: superiorKeychainOwnershipMessage, data: superiorKeychainOwnershipData } = await explicitOwnershipsOfSuperiorKeychain(ownedSuperiorKeychainIds);

            if (superiorKeychainOwnershipStatus !== Status.SUCCESS) {
                errors.push(superiorKeychainOwnershipMessage + ` User: ${user.twitterId}`);
                // continue to the next user if there was an error
                return [];
            }

            const superiorKeychainOwnerships = superiorKeychainOwnershipData.superiorKeychainOwnerships as KOSExplicitOwnership[];

            // get the total superior keychains owned by the user for at least 7 days
            const validSuperiorKeychains = superiorKeychainOwnerships.filter((ownership) => ownership.startTimestamp <= Math.floor(Date.now() / 1000) - 604800);

            // get the eligible weekly rewards
            const { points, bitOrbI, bitOrbII, terraCapI, terraCapII, raftBooster60 } = KOS_WEEKLY_BENEFITS(
                validKeysMetadata, 
                validKeychains.length, 
                validSuperiorKeychains.length
            );

            if (points > 0) {
                // do a few things:
                // check if the user exists in the season 0 leaderboard's `userData` array.
                // 1. if it doesn't, add a new entry.
                // 2. if it does, check if the source `KOS_BENEFITS` exists in the user's `pointsData` array.
                // if it doesn't, add a new entry. else, increment the points by `points`.
                // also, if the user is eligible for additional points, add the additional points to the `points`.
                const userIndex = (leaderboard.userData as LeaderboardUserData[]).findIndex(userData => userData.userId === user._id);

                let additionalPoints = 0;

                const currentLevel = user.inGameData.level;

                // if not found, create a new entry for the user
                if (userIndex === -1) {
                    // check if the user is eligible to level up to the next level
                    const newLevel = GET_SEASON_0_PLAYER_LEVEL(points);

                    if (newLevel > currentLevel) {
                        // set the user's `inGameData.level` to the new level
                        updateOperations.push({
                            updateOne: {
                                filter: { twitterId: user.twitterId },
                                update: {
                                    $set: {
                                        'inGameData.level': newLevel
                                    }
                                }
                            }
                        });

                        // add the additional points based on the rewards obtainable
                        additionalPoints = GET_SEASON_0_PLAYER_LEVEL_REWARDS(newLevel);
                    }

                    leaderboardUpdateOperations.push({
                        updateOne: {
                            filter: { name: 'Season 0' },
                            update: {
                                $push: {
                                    'userData': {
                                        userId: user._id,
                                        username: user.twitterUsername,
                                        twitterProfilePicture: user.twitterProfilePicture,
                                        pointsData: [
                                            {
                                                points,
                                                source: LeaderboardPointsSource.KOS_BENEFITS
                                            },
                                            {
                                                points: additionalPoints,
                                                source: LeaderboardPointsSource.LEVELLING_UP
                                            }
                                        ]
                                    }
                                }
                            }
                        }
                    });
                // if the user is found, we will increment the points
                } else {
                    // get the user's total leaderboard points
                    // this is done by summing up all the points from the `pointsData` array, BUT EXCLUDING SOURCES FROM:
                    // 1. LeaderboardPointsSource.LEVELLING_UP
                    const totalLeaderboardPoints = leaderboard.userData[userIndex].pointsData.reduce((acc, pointsData) => {
                        if (pointsData.source !== LeaderboardPointsSource.LEVELLING_UP) {
                            return acc + pointsData.points;
                        }

                        return acc;
                    }, 0);

                    const newLevel = GET_SEASON_0_PLAYER_LEVEL(totalLeaderboardPoints + points);

                    if (newLevel > currentLevel) {
                        // set the user's `inGameData.level` to the new level
                        updateOperations.push({
                            updateOne: {
                                filter: { twitterId: user.twitterId },
                                update: {
                                    $set: {
                                        'inGameData.level': newLevel
                                    }
                                }
                            }
                        });

                        // add the additional points based on the rewards obtainable
                        additionalPoints = GET_SEASON_0_PLAYER_LEVEL_REWARDS(newLevel);
                    }

                    // get the source index for `LeaderboardPointsSource.KOS_BENEFITS` and increment that
                    // if the source is not found, we create a new entry
                    const pointsData = leaderboard.userData[userIndex].pointsData;

                    const sourceIndex = pointsData.findIndex(pointsData => pointsData.source === LeaderboardPointsSource.KOS_BENEFITS);

                    if (sourceIndex === -1) {
                        leaderboardUpdateOperations.push({
                            updateOne: {
                                filter: { name: 'Season 0' },
                                update: {
                                    $push: {
                                        [`userData.${userIndex}.pointsData`]: {
                                            points,
                                            source: LeaderboardPointsSource.KOS_BENEFITS
                                        }
                                    }
                                }
                            }
                        });
                    } else {
                        leaderboardUpdateOperations.push({
                            updateOne: {
                                filter: { name: 'Season 0' },
                                update: {
                                    $inc: {
                                        [`userData.${userIndex}.pointsData.${sourceIndex}.points`]: points
                                    }
                                }
                            }
                        });
                    }

                    if (additionalPoints > 0) {
                        const levellingUpSourceIndex = pointsData.findIndex(pointsData => pointsData.source === LeaderboardPointsSource.LEVELLING_UP);

                        if (levellingUpSourceIndex === -1) {
                            leaderboardUpdateOperations.push({
                                updateOne: {
                                    filter: { name: 'Season 0' },
                                    update: {
                                        $push: {
                                            [`userData.${userIndex}.pointsData`]: {
                                                points: additionalPoints,
                                                source: LeaderboardPointsSource.LEVELLING_UP
                                            }
                                        }
                                    }
                                }
                            });
                        } else {
                            leaderboardUpdateOperations.push({
                                updateOne: {
                                    filter: { name: 'Season 0' },
                                    update: {
                                        $inc: {
                                            [`userData.${userIndex}.pointsData.${levellingUpSourceIndex}.points`]: additionalPoints
                                        }
                                    }
                                }
                            });
                        }
                    }
                }

                // if the user has a squad as well, add the points to the squad's total points
                if (user.inGameData.squadId !== null) {
                    // get the squad
                    const squad = await SquadModel.findOne({ _id: user.inGameData.squadId }).lean();

                    if (!squad) {
                        console.error(`(checkWeeklyKOSOwnership) Squad not found. User: ${user.twitterId}`);
                        return;
                    }

                    squadUpdateOperations.push({
                        updateOne: {
                            filter: { _id: user.inGameData.squadId },
                            update: {
                                $inc: {
                                    // don't include the additional points.
                                    'totalSquadPoints': points
                                }
                            }
                        }
                    });

                    // check if the squad exists in the squad leaderboard's `pointsData`. if not, we create a new instance.
                    const squadIndex = latestSquadLeaderboard.pointsData.findIndex((squadData) => squadData.squadId === squad._id);

                    if (squadIndex === -1) {
                        squadLeaderboardUpdateOperations.push({
                            updateOne: {
                                filter: { week: latestSquadLeaderboard.week },
                                update: {
                                    $push: {
                                        'pointsData': {
                                            squadId: squad._id,
                                            squadName: squad.name,
                                            memberPoints: [
                                                {
                                                    userId: user._id,
                                                    username: user.twitterUsername,
                                                    points
                                                }
                                            ]
                                        }
                                    }
                                }
                            }
                        });
                    } else {
                        // otherwise, we increment the points of the squad in the squad leaderboard
                        const userIndex = latestSquadLeaderboard.pointsData[squadIndex].memberPoints.findIndex((member) => member.userId === user._id);

                        // if the user is not found, we create a new instance
                        if (userIndex === -1) {
                            squadLeaderboardUpdateOperations.push({
                                updateOne: {
                                    filter: { week: latestSquadLeaderboard.week },
                                    update: {
                                        $push: {
                                            [`pointsData.${squadIndex}.memberPoints`]: {
                                                userId: user._id,
                                                username: user.twitterUsername,
                                                points
                                            }
                                        }
                                    }
                                }
                            });
                        } else {
                            // if the user is found, we increment the points
                            squadLeaderboardUpdateOperations.push({
                                updateOne: {
                                    filter: { week: latestSquadLeaderboard.week },
                                    update: {
                                        $inc: {
                                            [`pointsData.${squadIndex}.memberPoints.${userIndex}.points`]: points
                                        }
                                    }
                                }
                            });
                        }
                    }
                }
            }

            // if bit orb I is > 0, we:
            // 1. check if the user's `inventory.items` contains BitOrbType.BIT_ORB_I.
            // if not, add a new entry with `type: BitOrbType.BIT_ORB_I` and `amount: bitOrbI`. else, increment the `amount` by `bitOrbI`.
            if (bitOrbI > 0) {
                const bitOrbIIndex = (user.inventory.items as Item[]).findIndex((item) => item.type === BitOrbType.BIT_ORB_I);

                if (bitOrbIIndex === -1) {
                    updateOperations.push({
                        updateOne: {
                            filter: { twitterId: user.twitterId },
                            update: {
                                $push: {
                                    'inventory.items': {
                                        type: BitOrbType.BIT_ORB_I,
                                        amount: bitOrbI
                                    }
                                }
                            }
                        }
                    });
                } else {
                    updateOperations.push({
                        updateOne: {
                            filter: { twitterId: user.twitterId },
                            update: {
                                $inc: {
                                    [`inventory.items.${bitOrbIIndex}.amount`]: bitOrbI
                                }
                            }
                        }
                    });
                }
            }

            // if bit orb II is > 0, we:
            // 1. check if the user's `inventory.items` contains BitOrbType.BIT_ORB_II.
            // if not, add a new entry with `type: BitOrbType.BIT_ORB_II` and `amount: bitOrbII`. else, increment the `amount` by `bitOrbII`.
            if (bitOrbII > 0) {
                const bitOrbIIIndex = (user.inventory.items as Item[]).findIndex((item) => item.type === BitOrbType.BIT_ORB_II);

                if (bitOrbIIIndex === -1) {
                    updateOperations.push({
                        updateOne: {
                            filter: { twitterId: user.twitterId },
                            update: {
                                $push: {
                                    'inventory.items': {
                                        type: BitOrbType.BIT_ORB_II,
                                        amount: bitOrbII
                                    }
                                }
                            }
                        }
                    });
                } else {
                    updateOperations.push({
                        updateOne: {
                            filter: { twitterId: user.twitterId },
                            update: {
                                $inc: {
                                    [`inventory.items.${bitOrbIIIndex}.amount`]: bitOrbII
                                }
                            }
                        }
                    });
                }
            }

            // if terra cap I is > 0, we:
            // 1. check if the user's `inventory.items` contains TerraCapsulatorType.TERRA_CAPSULATOR_I.
            // if not, add a new entry with `type: TerraCapsulatorType.TERRA_CAPSULATOR_I` and `amount: terraCapI`. else, increment the `amount` by `terraCapI`.
            if (terraCapI > 0) {
                const terraCapIIndex = (user.inventory.items as Item[]).findIndex((item) => item.type === TerraCapsulatorType.TERRA_CAPSULATOR_I);

                if (terraCapIIndex === -1) {
                    updateOperations.push({
                        updateOne: {
                            filter: { twitterId: user.twitterId },
                            update: {
                                $push: {
                                    'inventory.items': {
                                        type: TerraCapsulatorType.TERRA_CAPSULATOR_I,
                                        amount: terraCapI
                                    }
                                }
                            }
                        }
                    });
                } else {
                    updateOperations.push({
                        updateOne: {
                            filter: { twitterId: user.twitterId },
                            update: {
                                $inc: {
                                    [`inventory.items.${terraCapIIndex}.amount`]: terraCapI
                                }
                            }
                        }
                    });
                }
            }

            // if terra cap II is > 0, we:
            // 1. check if the user's `inventory.items` contains TerraCapsulatorType.TERRA_CAPSULATOR_II.
            // if not, add a new entry with `type: TerraCapsulatorType.TERRA_CAPSULATOR_II` and `amount: terraCapII`. else, increment the `amount` by `terraCapII`.
            if (terraCapII > 0) {
                const terraCapIIIndex = (user.inventory.items as Item[]).findIndex((item) => item.type === TerraCapsulatorType.TERRA_CAPSULATOR_II);

                if (terraCapIIIndex === -1) {
                    updateOperations.push({
                        updateOne: {
                            filter: { twitterId: user.twitterId },
                            update: {
                                $push: {
                                    'inventory.items': {
                                        type: TerraCapsulatorType.TERRA_CAPSULATOR_II,
                                        amount: terraCapII
                                    }
                                }
                            }
                        }
                    });
                } else {
                    updateOperations.push({
                        updateOne: {
                            filter: { twitterId: user.twitterId },
                            update: {
                                $inc: {
                                    [`inventory.items.${terraCapIIIndex}.amount`]: terraCapII
                                }
                            }
                        }
                    });
                }
            }

            // if raft booster 60 is > 0, we:
            // 1. check if the user's `inventory.items` contains BoosterItem.RAFT_SPEED_BOOSTER_60_MIN.
            // if not, add a new entry with `type: BoosterItem.RAFT_SPEED_BOOSTER_60_MIN` and `amount: raftBooster60`. else, increment the `amount` by `raftBooster60`.
            if (raftBooster60 > 0) {
                const raftBooster60Index = (user.inventory.items as Item[]).findIndex((item) => item.type === BoosterItem.RAFT_SPEED_BOOSTER_60_MIN);

                if (raftBooster60Index === -1) {
                    updateOperations.push({
                        updateOne: {
                            filter: { twitterId: user.twitterId },
                            update: {
                                $push: {
                                    'inventory.items': {
                                        type: BoosterItem.RAFT_SPEED_BOOSTER_60_MIN,
                                        amount: raftBooster60
                                    }
                                }
                            }
                        }
                    });
                } else {
                    updateOperations.push({
                        updateOne: {
                            filter: { twitterId: user.twitterId },
                            update: {
                                $inc: {
                                    [`inventory.items.${raftBooster60Index}.amount`]: raftBooster60
                                }
                            }
                        }
                    });
                }
            }
            
            return {
                userUpdateOperations: updateOperations,
                leaderboardUpdateOperations,
                squadUpdateOperations,
                squadLeaderboardUpdateOperations,
            }
        });

        const bulkWriteOpsArrays = await Promise.all(bulkWriteOpsPromises);

        const bulkWriteOps = bulkWriteOpsArrays.flat().filter(op => op !== undefined);

        // at this point, bulkWriteOps consists of an array of objects with the user update operations, leaderboard update operations, squad update operations, and squad leaderboard update operations.
        // we need to separate them into their respective arrays.
        const userBulkWriteOps = bulkWriteOps.map((ops: any) => ops.userUpdateOperations).flat();
        const leaderboardBulkWriteOps = bulkWriteOps.map((ops: any) => ops.leaderboardUpdateOperations).flat();
        const squadBulkWriteOps = bulkWriteOps.map((ops: any) => ops.squadUpdateOperations).flat();
        const squadLeaderboardBulkWriteOps = bulkWriteOps.map((ops: any) => ops.squadLeaderboardUpdateOperations).flat();

        // for any of the arrays, if the length is 0, we don't execute the bulk write operation.
        if (userBulkWriteOps.length > 0) {
            await UserModel.bulkWrite(userBulkWriteOps);
        }

        if (leaderboardBulkWriteOps.length > 0) {
            await LeaderboardModel.bulkWrite(leaderboardBulkWriteOps);
        }

        if (squadBulkWriteOps.length > 0) {
            await SquadModel.bulkWrite(squadBulkWriteOps);
        }

        if (squadLeaderboardBulkWriteOps.length > 0) {
            await SquadLeaderboardModel.bulkWrite(squadLeaderboardBulkWriteOps);
        }

        if (errors.length > 0) {
            console.error(`(checkWeeklyKOSOwnership) Errors: ${errors.join('\n')}`);
        }

        console.log(`(checkWeeklyKOSOwnership) Successfully gave weekly KOS rewards.`);
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(checkWeeklyKOSOwnership) Error: ${err.message}`
        }
    }
}

/**
 * Gets all Key of Salvation IDs owned by the user (main + secondary wallets).
 */
export const getOwnedKeyIDs = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const { status, message, data } = await getWallets(twitterId);

        if (status !== Status.SUCCESS) {
            return {
                status,
                message: `(getOwnedKeys) Error from getWallets: ${message}`
            }
        }

        // create an array of requests to call `tokensOfOwner` in the contract
        const requests: Promise<any>[] = [];

        for (const walletAddress of data.walletAddresses) {
            requests.push(KOS_CONTRACT.tokensOfOwner(walletAddress as string));
        }

        // execute all the requests
        const keyIDs = await Promise.all(requests);

        return {
            status: Status.SUCCESS,
            message: `(getOwnedKeys) Successfully retrieved owned Key of Salvation IDs.`,
            data: {
                ownedKeyIDs: keyIDs.flat().map((id: any) => id.toNumber())
            }
        }
    } catch (err: any) {
        console.log('error: ', err.message)
        return {
            status: Status.ERROR,
            message: `(getOwnedKeys) Error: ${err.message}`
        }
    }
}

export const getOwnedKeychainIDs = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const { status, message, data } = await getWallets(twitterId);

        if (status !== Status.SUCCESS) {
            return {
                status,
                message: `(getOwnedKeychainIDs) Error from getWallets: ${message}`
            }
        }

        // create an array of requests to call `tokensOfOwner` in the contract
        const requests: Promise<any>[] = [];

        for (const walletAddress of data.walletAddresses) {
            requests.push(KEYCHAIN_CONTRACT.tokensOfOwner(walletAddress as string));
        }

        // execute all the requests
        const keychainIDs = await Promise.all(requests);

        return {
            status: Status.SUCCESS,
            message: `(getOwnedKeychainIDs) Successfully retrieved owned Keychain IDs.`,
            data: {
                ownedKeychainIDs: keychainIDs.flat().map((id: any) => id.toNumber())
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getOwnedKeychainIDs) Error: ${err.message}`
        }
    }
}

/**
 * Gets all Superior Keychain IDs owned by the user (main + secondary wallets).
 */
export const getOwnedSuperiorKeychainIDs = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const { status, message, data } = await getWallets(twitterId);

        if (status !== Status.SUCCESS) {
            return {
                status,
                message: `(getOwnedSuperiorKeychainIDs) Error from getWallets: ${message}`
            }
        }

        // create an array of requests to call `tokensOfOwner` in the contract
        const requests: Promise<any>[] = [];

        for (const walletAddress of data.walletAddresses) {
            requests.push(SUPERIOR_KEYCHAIN_CONTRACT.tokensOfOwner(walletAddress as string));
        }

        // execute all the requests
        const superiorKeychainIDs = await Promise.all(requests);

        return {
            status: Status.SUCCESS,
            message: `(getOwnedSuperiorKeychainIDs) Successfully retrieved owned Superior Keychain IDs.`,
            data: {
                ownedSuperiorKeychainIDs: superiorKeychainIDs.flat().map((id: any) => id.toNumber())
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getOwnedSuperiorKeychainIDs) Error: ${err.message}`
        }
    }
}

/**
 * Fetches all metadata of the Key of Salvation NFTs from the kosMetadata.json file.
 */
export const fetchKOSMetadataFile = (): KOSMetadata[] => {
    const metadataFile = JSON.parse(
        fs.readFileSync(
            path.join(__dirname, '../utils/kosMetadata.json'), 'utf8')
        ) as KOSMetadata[];

    return metadataFile;
}

/**
 * Fetches the `KOSExplicitOwnership` instance for each of the Key of Salvation NFTs from the contract using `explicitOwnershipsOf`.
 */
export const explicitOwnershipsOfKOS = async (keyIds: number[]): Promise<ReturnValue> => {
    if (!keyIds || keyIds.length === 0) {
        return {
            status: Status.SUCCESS,
            message: `(checkKeyOwnerships) No key IDs provided.`,
            data: {
                keyOwnerships: []
            }
        }
    }

    try {
        // call `explicitOwnershipsOf` in the contract for all key IDs and convert it to use `KOSExplicitOwnership`
        const keyOwnerships = await KOS_CONTRACT.explicitOwnershipsOf(keyIds);

        const formattedOwnerships: KOSExplicitOwnership[] = keyOwnerships.map((ownership: any, index: number) => {
            return {
                // get the key ID
                tokenId: keyIds[index],
                owner: ownership.addr,
                // convert startTimestamp to unix
                startTimestamp: ownership.startTimestamp.toNumber(),
                burned: ownership.burned,
                extraData: ownership.extraData
            }
        })

        return {
            status: Status.SUCCESS,
            message: `(checkKeyOwnerships) Successfully checked key ownerships.`,
            data: {
                keyOwnerships: formattedOwnerships
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(checkKeyOwnerships) Error: ${err.message}`
        }
    }
}

/**
 * Fetches the `KOSExplicitOwnership` instance for each of the Keychain NFTs from the contract using `explicitOwnershipsOf`.
 */
export const explicitOwnershipsOfKeychain = async (keychainIds: number[]): Promise<ReturnValue> => {
    if (!keychainIds || keychainIds.length === 0) {
        return {
            status: Status.SUCCESS,
            message: `(explicitOwnershipsOfKeychain) No keychain IDs provided.`,
            data: {
                keychainOwnerships: []
            }
        }
    }

    try {
        // call `explicitOwnershipsOf` in the contract for all keychain IDs and convert it to use `KOSExplicitOwnership`
        const keychainOwnerships = await KEYCHAIN_CONTRACT.explicitOwnershipsOf(keychainIds);

        // we can use the KOSExplicitOwnership interface here because the struct is the same for both Key of Salvation and Keychain
        const formattedOwnerships: KOSExplicitOwnership[] = keychainOwnerships.map((ownership: any, index: number) => {
            return {
                // get the keychain ID
                tokenId: keychainIds[index],
                owner: ownership.addr,
                // convert startTimestamp to unix
                startTimestamp: ownership.startTimestamp.toNumber(),
                burned: ownership.burned,
                extraData: ownership.extraData
            }
        })

        return {
            status: Status.SUCCESS,
            message: `(explicitOwnershipsOfKeychain) Successfully checked keychain ownerships.`,
            data: {
                keychainOwnerships: formattedOwnerships
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(explicitOwnershipsOfKeychain) Error: ${err.message}`
        }
    }
}

/**
 * Fetches the `KOSExplicitOwnership` instance for each of the Superior Keychain NFTs from the contract using `explicitOwnershipsOf`.
 */
export const explicitOwnershipsOfSuperiorKeychain = async (superiorKeychainIds: number[]): Promise<ReturnValue> => {
    if (!superiorKeychainIds || superiorKeychainIds.length === 0) {
        return {
            status: Status.SUCCESS,
            message: `(checkSuperiorKeychainOwnerships) No superior keychain IDs provided.`,
            data: {
                superiorKeychainOwnerships: []
            }
        }
    }

    try {
        // call `explicitOwnershipsOf` in the contract for all superior keychain IDs and convert it to use `KOSExplicitOwnership`
        const superiorKeychainOwnerships = await SUPERIOR_KEYCHAIN_CONTRACT.explicitOwnershipsOf(superiorKeychainIds);

        // we can use the KOSExplicitOwnership interface here because the struct is the same for both Key of Salvation and Superior Keychain
        const formattedOwnerships: KOSExplicitOwnership[] = superiorKeychainOwnerships.map((ownership: any, index: number) => {
            return {
                // get the superior keychain ID
                tokenId: superiorKeychainIds[index],
                owner: ownership.addr,
                // convert startTimestamp to unix
                startTimestamp: ownership.startTimestamp.toNumber(),
                burned: ownership.burned,
                extraData: ownership.extraData
            }
        })

        return {
            status: Status.SUCCESS,
            message: `(checkSuperiorKeychainOwnerships) Successfully checked superior keychain ownerships.`,
            data: {
                superiorKeychainOwnerships: formattedOwnerships
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(checkSuperiorKeychainOwnerships) Error: ${err.message}`
        }
    }
}