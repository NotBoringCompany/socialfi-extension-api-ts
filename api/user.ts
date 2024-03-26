import mongoose from 'mongoose';
import { ReturnValue, Status } from '../utils/retVal';
import { UserSchema } from '../schemas/User';
import { createUserWallet } from '../utils/wallet';
import { createRaft } from './raft';
import { generateObjectId } from '../utils/crypto';
import { addBitToDatabase, getLatestBitId, randomizeFarmingStats } from './bit';
import { BitSchema } from '../schemas/Bit';
import { RANDOMIZE_RARITY_FROM_ORB } from '../utils/constants/bitOrb';
import { BIT_TRAIT_EFFECT_ON_SELF, RANDOMIZE_GENDER, getBitStatsModifiersFromTraits, randomizeBitTraits } from '../utils/constants/bit';
import { ObtainMethod } from '../models/obtainMethod';
import { UserModel } from '../utils/constants/db';
import { createBarrenIsland } from './island';
import { BitTraitModifier } from '../models/modifier';
import { BitStatsModifiers } from '../models/bit';

/**
 * Twitter login logic. Creates a new user or simply log them in if they already exist.
 */
export const handleTwitterLogin = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        // if user doesn't exist, create a new user
        if (!user) {
            // generates a new object id for the user
            const userObjectId = generateObjectId();

            // creates a new raft for the user with the generated user object id
            const { status, message, data } = await createRaft(userObjectId);

            if (status !== Status.SUCCESS) {
                return {
                    status,
                    message: `(handleTwitterLogin) Error from createRaft: ${message}`
                }
            }

            // get the latest bit ID from the database
            const { status: bitIdStatus, message: bitIdMessage, data: bitIdData } = await getLatestBitId();

            if (bitIdStatus !== Status.SUCCESS) {
                return {
                    status: bitIdStatus,
                    message: `(handleTwitterLogin) Error from getLatestBitId: ${bitIdMessage}`
                }
            }

            // randomize bit rarity; follows the same rarity as when obtaining a bit from a bit orb
            const rarity = RANDOMIZE_RARITY_FROM_ORB();

            const traits = randomizeBitTraits(rarity);

            const bitStatsModifiers = getBitStatsModifiersFromTraits(traits);

            // add a free bit to the user's inventory (users get 1 for free when they sign up)
            const { status: bitStatus, message: bitMessage, data: bitData } = await addBitToDatabase({
                bitId: bitIdData?.latestBitId + 1,
                rarity,
                gender: RANDOMIZE_GENDER(),
                premium: false, // free bit, so not premium
                owner: userObjectId,
                purchaseDate: Math.floor(Date.now() / 1000),
                obtainMethod: ObtainMethod.SIGN_UP,
                placedIslandId: 0,
                lastRelocationTimestamp: 0,
                currentFarmingLevel: 1, // starts at level 1
                traits,
                farmingStats: randomizeFarmingStats(rarity), // although free bits don't use farming stats, we still need to randomize it just in case for future events
                bitStatsModifiers
            });

            if (bitStatus !== Status.SUCCESS) {
                return {
                    status: bitStatus,
                    message: `(handleTwitterLogin) Error from addBitToDatabase: ${bitMessage}`
                }
            }

            // creates a new barren island for the user for free as well
            const { status: islandStatus, message: islandMessage, data: islandData } = await createBarrenIsland(userObjectId);

            if (islandStatus !== Status.SUCCESS) {
                return {
                    status: islandStatus,
                    message: `(handleTwitterLogin) Error from createBarrenIsland: ${islandMessage}`
                }
            }

            // creates the wallet for the user
            const { privateKey, publicKey } = createUserWallet();

            const newUser = new UserModel({
                _id: userObjectId,
                twitterId,
                wallet: {
                    privateKey,
                    publicKey
                },
                openedTweetIdsToday: [],
                inventory: {
                    weight: 0,
                    maxWeight: 200,
                    xCookies: 0,
                    cookieCrumbs: 0,
                    resources: [],
                    items: [],
                    foods: [],
                    raftId: data.raft.raftId,
                    // add the free barren island to the `islandIds` array
                    islandIds: [islandData.island.islandId],
                    bitIds: [bitIdData?.latestBitId + 1],
                    totalBitOrbs: 0,
                    totalTerraCapsulators: 0
                },
                stats: {
                    level: 1
                }
            });

            await newUser.save();

            return {
                status: Status.SUCCESS,
                message: `(handleTwitterLogin) New user created and free Rafting Bit added to raft.`,
                data: {
                    userId: newUser._id,
                    twitterId,
                }
            }
        } else {
            // user exists, return
            return {
                status: Status.SUCCESS,
                message: `(handleTwitterLogin) User found. Logging in.`,
                data: {
                    userId: user._id,
                    twitterId
                }
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(handleTwitterLogin) ${err.message}`
        }
    }
}

/**
 * Fetches the user's inventory.
 */
export const getInventory = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getInventory) User not found.`
            }
        }

        return {
            status: Status.SUCCESS,
            message: `(getInventory) Inventory fetched.`,
            data: {
                inventory: user.inventory
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getInventory) ${err.message}`
        }
    }
}

/**
 * Fetches the user's wallet private and public keys.
 */
export const getWalletDetails = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getWalletDetails) User not found.`
            }
        }

        return {
            status: Status.SUCCESS,
            message: `(getWalletDetails) Wallet details fetched.`,
            data: {
                privateKey: user.wallet.privateKey,
                publicKey: user.wallet.publicKey
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getWalletDetails) ${err.message}`
        }
    }
}