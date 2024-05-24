import { KOS_CONTRACT } from '../utils/constants/web3';
import { ReturnValue, Status } from '../utils/retVal';
import { getWallets } from './user';
import { KOSExplicitOwnership, KOSMetadata } from '../models/kos';
import fs from 'fs';
import path from 'path';
import { UserModel } from '../utils/constants/db';
import { KOS_DAILY_BENEFITS } from '../utils/constants/kos';
import { ExtendedXCookieData, XCookieSource } from '../models/user';
import { Item } from '../models/item';
import { BoosterItem } from '../models/booster';
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { BigNumber } from 'ethers';

dotenv.config();

/**
 * Checks, for each user who owns at least 1 Key of Salvation, if they have owned each key for at least 1 day (from 23:59 UTC the previous day to 23:59 UTC now).
 * If they have, they will be eligible to earn the daily KOS rewards based on the amount of keys that match that 1-day criteria.
 * 
 * Called by a scheduler every day at 23:59 UTC.
 */
export const checkDailyKOSOwnershipAndGiveRewards = async (): Promise<ReturnValue> => {
    try {
        await mongoose.connect(process.env.MONGODB_URI as string);

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
            const { status: ownershipStatus, message: ownershipMessage, data: ownershipData } = await explicitOwnershipsOf(ownedKeyIds);

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

            // give the user the rewards
            if (xCookies > 0) {
                // if xCookies > 0, do 2 things:
                // 1. increment the user's `inventory.xCookieData.currentXCookies` by `xCookies`
                // 2. check if the user's `inventory.xCookieData.extendedXCookieData.source` contains `KOS_BENEFITS`.
                // if not, add a new entry with `source: KOS_BENEFITS` and `xCookies: xCookies`. else, increment the `xCookies` by `xCookies`.

                // increment the user's `inventory.xCookieData.currentXCookies` by `xCookies`
                updateOperations.push({
                    updateOne: {
                        filter: { twitterId: user.twitterId },
                        update: {
                            $inc: {
                                'inventory.xCookieData.currentXCookies': xCookies
                            }
                        }
                    }
                })

                // check if the user's `inventory.xCookieData.extendedXCookieData.source` contains `KOS_BENEFITS`.
                const kosBenefitsIndex = (user.inventory.xCookieData.extendedXCookieData as ExtendedXCookieData[]).findIndex((data) => data.source === XCookieSource.KOS_BENEFITS);

                if (kosBenefitsIndex === -1) {
                    // if not, add a new entry with `source: KOS_BENEFITS` and `xCookies: xCookies`
                    updateOperations.push({
                        updateOne: {
                            filter: { twitterId: user.twitterId },
                            update: {
                                $push: {
                                    'inventory.xCookieData.extendedXCookieData': {
                                        source: XCookieSource.KOS_BENEFITS,
                                        xCookies
                                    }
                                }
                            }
                        }
                    })
                } else {
                    // else, increment the `xCookies` by `xCookies`
                    updateOperations.push({
                        updateOne: {
                            filter: { twitterId: user.twitterId },
                            update: {
                                $inc: {
                                    [`inventory.xCookieData.extendedXCookieData.${kosBenefitsIndex}.xCookies`]: xCookies
                                }
                            }
                        }
                    })
                }
            }

            if (gatheringBooster25 > 0) {
                // if gatheringBooster25 > 0, check if the user's `inventory.items` contain a `BoosterItem` with `type: GATHERING_PROGRESS_BOOSTER_25`.
                // if not, add a new entry with `type: GATHERING_PROGRESS_BOOSTER_25` and `amount: gatheringBooster25`. else, increment the `amount` by `gatheringBooster25`.

                // check if the user's `inventory.items` contain a `BoosterItem` with `type: GATHERING_PROGRESS_BOOSTER_25`.
                const boosterIndex = (user.inventory.items as Item[]).findIndex((item) => item.type === BoosterItem.GATHERING_PROGRESS_BOOSTER_25);

                if (boosterIndex === -1) {
                    // if not, add a new entry with `type: GATHERING_PROGRESS_BOOSTER_25` and `amount: gatheringBooster25`
                    updateOperations.push({
                        updateOne: {
                            filter: { twitterId: user.twitterId },
                            update: {
                                $push: {
                                    'inventory.items': {
                                        type: BoosterItem.GATHERING_PROGRESS_BOOSTER_25,
                                        amount: gatheringBooster25
                                    }
                                }
                            }
                        }
                    })
                } else {
                    // else, increment the `amount` by `gatheringBooster25`
                    updateOperations.push({
                        updateOne: {
                            filter: { twitterId: user.twitterId },
                            update: {
                                $inc: {
                                    [`inventory.items.${boosterIndex}.amount`]: gatheringBooster25
                                }
                            }
                        }
                    })
                }
            }

            if (gatheringBooster50 > 0) {
                // if gatheringBooster50 > 0, check if the user's `inventory.items` contain a `BoosterItem` with `type: GATHERING_PROGRESS_BOOSTER_50`.
                // if not, add a new entry with `type: GATHERING_PROGRESS_BOOSTER_50` and `amount: gatheringBooster50`. else, increment the `amount` by `gatheringBooster50`.

                // check if the user's `inventory.items` contain a `BoosterItem` with `type: GATHERING_PROGRESS_BOOSTER_50`.
                const boosterIndex = (user.inventory.items as Item[]).findIndex((item) => item.type === BoosterItem.GATHERING_PROGRESS_BOOSTER_50);

                if (boosterIndex === -1) {
                    // if not, add a new entry with `type: GATHERING_PROGRESS_BOOSTER_50` and `amount: gatheringBooster50`
                    updateOperations.push({
                        updateOne: {
                            filter: { twitterId: user.twitterId },
                            update: {
                                $push: {
                                    'inventory.items': {
                                        type: BoosterItem.GATHERING_PROGRESS_BOOSTER_50,
                                        amount: gatheringBooster50
                                    }
                                }
                            }
                        }
                    })
                } else {
                    // else, increment the `amount` by `gatheringBooster50`
                    updateOperations.push({
                        updateOne: {
                            filter: { twitterId: user.twitterId },
                            update: {
                                $inc: {
                                    [`inventory.items.${boosterIndex}.amount`]: gatheringBooster50
                                }
                            }
                        }
                    })
                }
            }

            if (gatheringBooster100 > 0) {
                // if gatheringBooster100 > 0, check if the user's `inventory.items` contain a `BoosterItem` with `type: GATHERING_PROGRESS_BOOSTER_100`.
                // if not, add a new entry with `type: GATHERING_PROGRESS_BOOSTER_100` and `amount: gatheringBooster100`. else, increment the `amount` by `gatheringBooster100`.

                // check if the user's `inventory.items` contain a `BoosterItem` with `type: GATHERING_PROGRESS_BOOSTER_100`.
                const boosterIndex = (user.inventory.items as Item[]).findIndex((item) => item.type === BoosterItem.GATHERING_PROGRESS_BOOSTER_100);

                if (boosterIndex === -1) {
                    // if not, add a new entry with `type: GATHERING_PROGRESS_BOOSTER_100` and `amount: gatheringBooster100`
                    updateOperations.push({
                        updateOne: {
                            filter: { twitterId: user.twitterId },
                            update: {
                                $push: {
                                    'inventory.items': {
                                        type: BoosterItem.GATHERING_PROGRESS_BOOSTER_100,
                                        amount: gatheringBooster100
                                    }
                                }
                            }
                        }
                    })
                } else {
                    // else, increment the `amount` by `gatheringBooster100`
                    updateOperations.push({
                        updateOne: {
                            filter: { twitterId: user.twitterId },
                            update: {
                                $inc: {
                                    [`inventory.items.${boosterIndex}.amount`]: gatheringBooster100
                                }
                            }
                        }
                    })
                }
            }

            return updateOperations;
        });

        const bulkWriteOpsArrays = await Promise.all(bulkWriteOpsPromises);

        const bulkWriteOps = bulkWriteOpsArrays.flat().filter(op => op !== undefined);

        if (bulkWriteOps.length === 0) {
            console.log(`(checkDailyKOSOwnership) No users were eligible for daily KOS rewards.`);
            return;
        }

        // execute the bulk write operations
        await UserModel.bulkWrite(bulkWriteOps);

        console.log(`(checkDailyKOSOwnership) Successfully gave daily KOS rewards.`);
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(checkDailyKOSOwnership) Error: ${err.message}`
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

        // loop through each wallet address and get the key IDs owned (call `tokensOfOwner` in the contract)
        const keyIDs: string[] = [];

        // for each wallet address, call `tokensOfOwner` in the contract and add the key IDs to `keyIDs`
        for (const walletAddress of data.walletAddresses) {
            const ownedIds = await KOS_CONTRACT.tokensOfOwner(walletAddress as string);

            keyIDs.push(...ownedIds.map((id: any) => id.toNumber()));
        }

        return {
            status: Status.SUCCESS,
            message: `(getOwnedKeys) Successfully retrieved owned Key of Salvation IDs.`,
            data: {
                ownedKeyIDs: keyIDs
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getOwnedKeys) Error: ${err.message}`
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
export const explicitOwnershipsOf = async (keyIds: number[]): Promise<ReturnValue> => {
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