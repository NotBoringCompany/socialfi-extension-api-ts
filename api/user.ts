import { ReturnValue, Status } from '../utils/retVal';
import { createUserWallet } from '../utils/wallet';
import { createRaft } from './raft';
import { decryptPrivateKey, encryptPrivateKey, generateHashSalt, generateObjectId, generateReferralCode, generateWonderbitsDataHash } from '../utils/crypto';
import { addBitToDatabase, getLatestBitId, randomizeFarmingStats } from './bit';
import { RANDOMIZE_GENDER, getBitStatsModifiersFromTraits, randomizeBitTraits, randomizeBitType } from '../utils/constants/bit';
import { ObtainMethod } from '../models/obtainMethod';
import { IslandModel, LeaderboardModel, SquadLeaderboardModel, SquadModel, StarterCodeModel, UserModel, WeeklyMVPClaimableRewardsModel } from '../utils/constants/db';
import { addIslandToDatabase, getLatestIslandId, randomizeBaseResourceCap } from './island';
import { POIName } from '../models/poi';
import { ExtendedResource, SimplifiedResource } from '../models/resource';
import { resources } from '../utils/constants/resource';
import { BeginnerRewardData, BeginnerRewardType, DailyLoginRewardData, DailyLoginRewardType, ExtendedXCookieData, PlayerEnergy, UserWallet, XCookieSource, User } from '../models/user';
import {
    DAILY_REROLL_BONUS_MILESTONE,
    ENERGY_POTION_RECOVERY,
    GET_BEGINNER_REWARDS,
    GET_DAILY_LOGIN_REWARDS,
    GET_SEASON_0_PLAYER_LEVEL,
    GET_SEASON_0_PLAYER_LEVEL_REWARDS,
    GET_SEASON_0_REFERRAL_REWARDS,
    MAX_BEGINNER_REWARD_DAY,
    MAX_ENERGY_CAP,
    MAX_ENERGY_POTION_CAP,
    MAX_INVENTORY_WEIGHT,
    WEEKLY_MVP_REWARDS,
} from '../utils/constants/user';
import { ReferralData, ReferralReward, ReferredUserData } from '../models/invite';
import { BitOrbType, Item, TerraCapsulatorType } from '../models/item';
import { BitRarity, BitTrait } from '../models/bit';
import { IslandStatsModifiers, IslandType } from '../models/island';
import { Modifier } from '../models/modifier';
import { LeaderboardPointsSource, LeaderboardUserData } from '../models/leaderboard';
import { FoodType } from '../models/food';
import { BoosterItem } from '../models/booster';
import { BASE_CARESS_PER_TAPPING, BASE_ENERGY_PER_TAPPING, ISLAND_TAPPING_REQUIREMENT, randomizeIslandTraits } from '../utils/constants/island';
import { Signature, recoverMessageAddress } from 'viem';
import { joinReferrerSquad, requestToJoinSquad } from './squad';
import { ExtendedDiscordProfile, ExtendedProfile } from '../utils/types';
import { WeeklyMVPRewardType } from '../models/weeklyMVPReward';
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { getUserCurrentPoints } from './leaderboard';
import { DEPLOYER_WALLET, WONDERBITS_CONTRACT, XPROTOCOL_TESTNET_PROVIDER } from '../utils/constants/web3';
import { parseTelegramData, TelegramAuthData, validateTelegramData } from '../utils/telegram';
import { sendKICKUponRegistration, updatePointsInContract } from './web3';
import { ethers } from 'ethers';
import { sendMailsToNewUser } from './mail';

dotenv.config();

/**
 * Initializes 0 diamonds for each user in the database.
 */
export const initializeDiamonds = async (): Promise<void> => {
    try {
        // bulk set `diamonds` to 0 for all users in `inventory.diamonds`
        await UserModel.updateMany({}, { $set: { 'inventory.diamonds': 0 } });

        console.log(`(initializeDiamonds) Successfully initialized diamonds for all users.`);
    } catch (err: any) {
        console.log(`(initializeDiamonds) ${err.message}`);
    }
}

/**
 * Returns the user's data.
 */
export const getUserData = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getUserData) User not found.`,
            };
        }

        return {
            status: Status.SUCCESS,
            message: `(getUserData) User data fetched.`,
            data: {
                user
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getUserData) ${err.message}`,
        };
    }
};

/**
 * Twitter login logic. Creates a new user or simply log them in if they already exist.
 *
 * If users sign up, they are required to input an invite code (either from a starter code or a referral code).
 * Otherwise, they can't sign up.
 *
 * Also callable from admin for external account creations (e.g. from Wonderchamps for the current structure format (will be refactored)).
 * If so, `adminKey` is required.
 */
export const handleTwitterLogin = async (twitterId: string, adminCall: boolean, profile?: ExtendedProfile | null, adminKey?: string): Promise<ReturnValue> => {
    try {
        let loginType: 'Register' | 'Login';
        // if adminCall, check if the admin key is valid.
        if (adminCall) {
            if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
                return {
                    status: Status.UNAUTHORIZED,
                    message: `(handleTwitterLogin) Unauthorized admin call.`,
                };
            }
        }

        const preregisteredUser = await UserModel.findOne({ $and: [{ twitterUsername: profile.username }, { twitterId: null }] }).lean();
        if (preregisteredUser) return handlePreRegister(twitterId, profile);

        const user = await UserModel.findOne({ twitterId }).lean();

        // if user doesn't exist, create a new user
        if (!user) {
            // generates a new object id for the user
            const userObjectId = generateObjectId();
            loginType = 'Register';

            // creates a new raft for the user with the generated user object id
            const { status, message, data } = await createRaft(userObjectId);

            if (status !== Status.SUCCESS) {
                return {
                    status,
                    message: `(handleTwitterLogin) Error from createRaft: ${message}`,
                };
            }

            // get the latest bit ID from the database
            const { status: bitIdStatus, message: bitIdMessage, data: bitIdData } = await getLatestBitId();

            if (bitIdStatus !== Status.SUCCESS) {
                return {
                    status: bitIdStatus,
                    message: `(handleTwitterLogin) Error from getLatestBitId: ${bitIdMessage}`,
                };
            }

            const rarity = BitRarity.COMMON;
            const bitType = randomizeBitType();

            const traits = randomizeBitTraits(rarity);

            const bitStatsModifiers = getBitStatsModifiersFromTraits(traits.map((trait) => trait.trait));

            // add a premium common bit to the user's inventory (users get 1 for free when they sign up)
            const {
                status: bitStatus,
                message: bitMessage,
                data: bitData,
            } = await addBitToDatabase({
                bitId: bitIdData?.latestBitId + 1,
                bitType,
                bitNameData: {
                    name: bitType,
                    lastChanged: 0,
                },
                rarity,
                gender: RANDOMIZE_GENDER(),
                premium: true,
                owner: userObjectId,
                purchaseDate: Math.floor(Date.now() / 1000),
                obtainMethod: ObtainMethod.SIGN_UP,
                placedIslandId: 0,
                lastRelocationTimestamp: 0,
                currentFarmingLevel: 1, // starts at level 1
                traits,
                farmingStats: {
                    ...randomizeFarmingStats(rarity),
                    currentEnergy: 50, // set energy to half for tutorial purposes
                },
                bitStatsModifiers,
            });

            if (bitStatus !== Status.SUCCESS) {
                return {
                    status: bitStatus,
                    message: `(handleTwitterLogin) Error from addBitToDatabase: ${bitMessage}`,
                };
            }

            const islandStatsModifiers: IslandStatsModifiers = {
                resourceCapModifiers: [],
                gatheringRateModifiers: [],
                earningRateModifiers: [],
            };

            // check the bit's traits
            // if it has influential, antagonistic, famous or mannerless, then:
            // if influential, add 1% to earning and gathering rate modifiers of the island
            // if antagonistic, reduce 1% to earning and gathering rate modifiers of the island
            // if famous, add 0.5% to earning and gathering rate modifiers of the island
            // if mannerless, reduce 0.5% to earning and gathering rate modifiers of the island
            if (traits.some((trait) => trait.trait === BitTrait.INFLUENTIAL)) {
                // add 1% to earning and gathering rate modifiers of the island
                const gatheringRateModifier: Modifier = {
                    origin: `Bit ID ${bitData.bit.bitId}'s Trait: Influential`,
                    value: 1.01,
                };

                const earningRateModifier: Modifier = {
                    origin: `Bit ID ${bitData.bit.bitId}'s Trait: Influential`,
                    value: 1.01,
                };

                islandStatsModifiers.gatheringRateModifiers.push(gatheringRateModifier);
                islandStatsModifiers.earningRateModifiers.push(earningRateModifier);
            }

            // if the bit has antagonistic trait
            if (traits.some((trait) => trait.trait === BitTrait.ANTAGONISTIC)) {
                // reduce 1% to earning and gathering rate modifiers of the island
                const gatheringRateModifier: Modifier = {
                    origin: `Bit ID ${bitData.bit.bitId}'s Trait: Antagonistic`,
                    value: 0.99,
                };

                const earningRateModifier: Modifier = {
                    origin: `Bit ID ${bitData.bit.bitId}'s Trait: Antagonistic`,
                    value: 0.99,
                };

                islandStatsModifiers.gatheringRateModifiers.push(gatheringRateModifier);
                islandStatsModifiers.earningRateModifiers.push(earningRateModifier);
            }

            // if the bit has famous trait
            if (traits.some((trait) => trait.trait === BitTrait.FAMOUS)) {
                // add 0.5% to earning and gathering rate modifiers of the island
                const gatheringRateModifier: Modifier = {
                    origin: `Bit ID ${bitData.bit.bitId}'s Trait: Famous`,
                    value: 1.005,
                };

                const earningRateModifier: Modifier = {
                    origin: `Bit ID ${bitData.bit.bitId}'s Trait: Famous`,
                    value: 1.005,
                };

                islandStatsModifiers.gatheringRateModifiers.push(gatheringRateModifier);
                islandStatsModifiers.earningRateModifiers.push(earningRateModifier);
            }

            // if the bit has mannerless trait
            if (traits.some((trait) => trait.trait === BitTrait.MANNERLESS)) {
                // reduce 0.5% to earning and gathering rate modifiers of the island
                const gatheringRateModifier: Modifier = {
                    origin: `Bit ID ${bitData.bit.bitId}'s Trait: Mannerless`,
                    value: 0.995,
                };

                const earningRateModifier: Modifier = {
                    origin: `Bit ID ${bitData.bit.bitId}'s Trait: Mannerless`,
                    value: 0.995,
                };

                islandStatsModifiers.gatheringRateModifiers.push(gatheringRateModifier);
                islandStatsModifiers.earningRateModifiers.push(earningRateModifier);
            }

            // creates a free primal island for the user
            const { status: islandIdStatus, message: islandIdMessage, data: islandIdData } = await getLatestIslandId();

            if (islandIdStatus !== Status.SUCCESS) {
                return {
                    status: islandIdStatus,
                    message: `(handleTwitterLogin) Error from getLatestIslandId: ${islandIdMessage}`,
                };
            }

            const {
                status: islandStatus,
                message: islandMessage,
                data: islandData,
            } = await addIslandToDatabase({
                islandId: islandIdData?.latestIslandId + 1,
                type: IslandType.PRIMAL_ISLES,
                owner: userObjectId,
                purchaseDate: Math.floor(Date.now() / 1000),
                obtainMethod: ObtainMethod.SIGN_UP,
                currentLevel: 1,
                currentTax: 0,
                placedBitIds: [],
                traits: randomizeIslandTraits(),
                islandResourceStats: {
                    baseResourceCap: randomizeBaseResourceCap(IslandType.PRIMAL_ISLES),
                    resourcesGathered: [],
                    dailyBonusResourcesGathered: 0,
                    claimableResources: [],
                    gatheringStart: 0,
                    gatheringEnd: 0,
                    lastClaimed: 0,
                    gatheringProgress: 0,
                    lastUpdatedGatheringProgress: Math.floor(Date.now() / 1000),
                },
                islandEarningStats: {
                    totalXCookiesSpent: 0,
                    totalXCookiesEarnable: 0,
                    totalXCookiesEarned: 0,
                    claimableXCookies: 0,
                    totalCookieCrumbsSpent: 0,
                    totalCookieCrumbsEarnable: 0,
                    totalCookieCrumbsEarned: 0,
                    claimableCookieCrumbs: 0,
                    earningStart: 0,
                    crumbsEarningStart: 0,
                    earningEnd: 0,
                    crumbsEarningEnd: 0,
                    lastClaimed: 0,
                },
                islandStatsModifiers,
                islandTappingData: ISLAND_TAPPING_REQUIREMENT(1, 1),
            });

            if (islandStatus !== Status.SUCCESS) {
                return {
                    status: islandStatus,
                    message: `(handleTwitterLogin) Error from createBarrenIsland: ${islandMessage}`,
                };
            }

            // creates the wallet for the user
            const { encryptedPrivateKey, address } = createUserWallet();

            // initialize PlayerEnergy fot user
            const newEnergy: PlayerEnergy = {
                currentEnergy: MAX_ENERGY_CAP,
                maxEnergy: MAX_ENERGY_CAP,
                dailyEnergyPotion: MAX_ENERGY_POTION_CAP,
            }

            const newUser = new UserModel({
                _id: userObjectId,
                twitterId,
                twitterProfilePicture: profile?.photos[0]?.value ?? '',
                twitterUsername: profile?.username ?? null,
                twitterDisplayName: profile?.displayName ?? null,
                createdTimestamp: Math.floor(Date.now() / 1000),
                // invite code data will be null until users input their invite code.
                inviteCodeData: {
                    usedStarterCode: null,
                    usedReferralCode: null,
                    referrerId: null,
                },
                referralData: {
                    referralCode: generateReferralCode(),
                    referredUsersData: [],
                    claimableReferralRewards: {
                        xCookies: 0,
                        leaderboardPoints: 0,
                    },
                },
                wallet: {
                    encryptedPrivateKey,
                    address,
                },
                secondaryWallets: [],
                openedTweetIdsToday: [],
                inventory: {
                    weight: 0,
                    maxWeight: MAX_INVENTORY_WEIGHT,
                    xCookieData: {
                        currentXCookies: 0,
                        extendedXCookieData: [],
                    },
                    cookieCrumbs: 0,
                    resources: [],
                    items: [
                        {
                            type: BoosterItem['GATHERING_PROGRESS_BOOSTER_1000'],
                            amount: 1,
                        },
                    ],
                    foods: [
                        {
                            type: FoodType['BURGER'],
                            amount: 1,
                        },
                    ],
                    raftId: data.raft.raftId,
                    islandIds: [islandData.island.islandId],
                    bitIds: [bitIdData?.latestBitId + 1],
                },
                inGameData: {
                    level: 1,
                    energy: newEnergy,
                    mastery: {
                        tapping: {
                            level: 1,
                            totalExp: 0,
                            rerollCount: 6,
                        },
                        // empty crafting for now (so it can be more flexible)
                        crafting: {},
                        // empty berry factory for now (so it can be more flexible)
                        berryFactory: {},
                    },
                    completedTutorialIds: [],
                    beginnerRewardData: {
                        lastClaimedTimestamp: 0,
                        isClaimable: true,
                        daysClaimed: [],
                        daysMissed: [],
                    },
                    dailyLoginRewardData: {
                        lastClaimedTimestamp: 0,
                        isDailyClaimable: true,
                        consecutiveDaysClaimed: 0,
                    },
                    squadId: null,
                    lastLeftSquad: 0,
                    location: POIName.HOME,
                    travellingTo: null,
                    destinationArrival: 0,
                },
            });

            await newUser.save();

            // give the user some KICK tokens
            const { status: kickStatus, message: kickMessage } = await sendKICKUponRegistration(address);

            // send any necessary mails to the new user (mails with `includeNewUsers` set to true)
            await sendMailsToNewUser(twitterId);

            return {
                status: Status.SUCCESS,
                message: `(handleTwitterLogin) New user created.`,
                data: {
                    userId: newUser._id,
                    twitterId,
                    loginType: loginType,
                    // checks if KICK is sent successfully to the user; if not, no need to throw an error.
                    sendKICKStatus: kickStatus,
                    sendKICKMessage: kickMessage,
                },
            };
        } else {
            loginType = 'Login';
            // update user's Twitter profile information if available
            if (!!profile) {
                await UserModel.updateOne(
                    { twitterId },
                    {
                        $set: {
                            twitterProfilePicture: profile.photos[0].value ?? '',
                            twitterDisplayName: profile.displayName,
                            twitterUsername: profile.username,
                        },
                    }
                );
            }

            // user exists, return
            return {
                status: Status.SUCCESS,
                message: `(handleTwitterLogin) User found. Logging in.`,
                data: {
                    userId: user._id,
                    twitterId,
                    loginType: loginType
                },
            };
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(handleTwitterLogin) ${err.message}`,
        };
    }
};

/**
 * Fetches the user's inventory.
 */
export const getInventory = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getInventory) User not found.`,
            };
        }

        return {
            status: Status.SUCCESS,
            message: `(getInventory) Inventory fetched.`,
            data: {
                inventory: user.inventory,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getInventory) ${err.message}`,
        };
    }
};

/**
 * Fetches the user's wallet private and public keys.
 */
export const getWalletDetails = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            console.log(`nah`);
            return {
                status: Status.ERROR,
                message: `(getWalletDetails) User not found.`,
            };
        }

        return {
            status: Status.SUCCESS,
            message: `(getWalletDetails) Wallet details fetched.`,
            data: {
                address: user.wallet.address,
                privateKey: decryptPrivateKey(user.wallet.encryptedPrivateKey),
            },
        };
    } catch (err: any) {
        console.log(`error here: ${err}`);
        return {
            status: Status.ERROR,
            message: `(getWalletDetails) ${err.message}`,
        };
    }
};

/**
 * Gets the user's in-game data.
 */
export const getInGameData = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getInGameData) User not found.`,
            };
        }

        return {
            status: Status.SUCCESS,
            message: `(getInGameData) In-game data fetched.`,
            data: {
                inGameData: user.inGameData,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getInGameData) ${err.message}`,
        };
    }
};

/**
 * Generates a message when users want to link a secondary wallet to their account.
 *
 * The message will follow this format:
 * `Please sign the following message to link this wallet as a secondary wallet to your account.
 *
 * Wallet address: <walletAddress>
 *
 * Timestamp: <timestamp>
 *
 * Hash salt: <hashSalt>`
 *
 * The message will then be sent to the frontend for the user to sign with their secondary wallet.
 */
export const generateSignatureMessage = (walletAddress: string): string => {
    const timestamp = Math.floor(Date.now() / 1000);
    const hashSalt = generateHashSalt();

    const message = `
    Please sign the following message to link this wallet as a secondary wallet to your account.
    Wallet address: ${walletAddress}
    Timestamp: ${timestamp}
    Hash salt: ${hashSalt}
    `;

    return message;
};

/**
 * Generates a message when users want to unlink a secondary wallet from their account.
 *
 * The message will follow this format:
 *
 * `Please sign the following message to unlink this wallet from your account.
 *
 * Wallet address: <walletAddress>
 *
 * Timestamp: <timestamp>
 *
 * Hash salt: <hashSalt>`
 *
 * The message will then be sent to the frontend for the user to sign with their secondary wallet.
 */
export const generateUnlinkSignatureMessage = (walletAddress: string): string => {
    const timestamp = Math.floor(Date.now() / 1000);
    const hashSalt = generateHashSalt();

    const message = `
    Please sign the following message to unlink this wallet from your account.
    Wallet address: ${walletAddress}
    Timestamp: ${timestamp}
    Hash salt: ${hashSalt}
    `;

    return message;
};

/**
 * Links a secondary wallet to the user's account if signature check is valid.
 */
export const linkSecondaryWallet = async (
    twitterId: string,
    walletAddress: string,
    signatureMessage: string,
    signature: Uint8Array | `0x${string}` | Signature
): Promise<ReturnValue> => {
    try {
        const recoveredAddress = await recoverMessageAddress({
            message: signatureMessage,
            signature,
        });

        console.log('wallet address: ', walletAddress);
        console.log('recovered address: ', recoveredAddress);

        if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
            return {
                status: Status.BAD_REQUEST,
                message: `(linkSecondaryWallet) Invalid signature.`,
            };
        }

        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(linkSecondaryWallet) User not found.`,
            };
        }

        // check if the wallet is already linked in the user's `secondaryWallets` OR other users' `secondaryWallet` or `wallet`
        const users = await UserModel.find().lean();

        // loop through each user. check if any of their `wallet` (main wallet) or `secondaryWallets` contain the wallet address the user is trying to link.
        const walletAlreadyLinkedToOtherUser = users.some((otherUser) => {
            if (otherUser.wallet?.address.toLowerCase() === walletAddress.toLowerCase()) {
                return true;
            }

            if (otherUser.secondaryWallets && otherUser.secondaryWallets.length > 0) {
                return otherUser.secondaryWallets.some((wallet) => wallet.address.toLowerCase() === walletAddress.toLowerCase());
            }

            return false;
        });

        // check if the wallet is already linked in the own user's `secondaryWallets`
        // each secondaryWallet instance in `secondaryWallets` contain the `address`.
        // check if the `address` is the same as the `walletAddress`
        const walletAlreadyLinkedToSelf = user.secondaryWallets?.some((wallet) => wallet.address.toLowerCase() === walletAddress.toLowerCase()); 

        if (walletAlreadyLinkedToOtherUser) {
            return {
                status: Status.BAD_REQUEST,
                message: `(linkSecondaryWallet) Wallet is already linked to another user.`,
            };
        }

        if (walletAlreadyLinkedToSelf) {
            return {
                status: Status.BAD_REQUEST,
                message: `(linkSecondaryWallet) Wallet is already linked to own account.`,
            };
        }

        // add the secondary wallet to the user's account
        await UserModel.updateOne(
            { twitterId },
            {
                $push: {
                    secondaryWallets: {
                        signatureMessage,
                        signature,
                        address: walletAddress,
                    },
                },
            }
        );

        return {
            status: Status.SUCCESS,
            message: `(linkSecondaryWallet) Secondary wallet linked.`,
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(linkSecondaryWallet) ${err.message}`,
        };
    }
};

/**
 * Unlinks a secondary wallet from a user's account. Requires a signature to ensure that the user is the one unlinking the wallet.
 */
export const unlinkSecondaryWallet = async (
    twitterId: string,
    walletAddress: string,
    signatureMessage: string,
    signature: Uint8Array | `0x${string}` | Signature
): Promise<ReturnValue> => {
    try {
        const recoveredAddress = await recoverMessageAddress({
            message: signatureMessage,
            signature,
        });

        if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
            return {
                status: Status.BAD_REQUEST,
                message: `(unlinkSecondaryWallet) Invalid signature.`,
            };
        }

        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(unlinkSecondaryWallet) User not found.`,
            };
        }

        // check if the wallet is already linked in the user's `secondaryWallets`
        // each secondaryWallet instance in `secondaryWallets` contain the `address`.
        // check if the `address` is the same as the `walletAddress`
        const isWalletAlreadyLinked = user.secondaryWallets?.some((wallet) => wallet.address.toLowerCase() === walletAddress.toLowerCase());

        if (!isWalletAlreadyLinked) {
            return {
                status: Status.BAD_REQUEST,
                message: `(unlinkSecondaryWallet) Wallet is not linked.`,
            };
        }

        // remove the secondary wallet from the user's account
        await UserModel.updateOne(
            { twitterId },
            {
                $pull: {
                    secondaryWallets: {
                        address: walletAddress,
                    },
                },
            }
        );

        return {
            status: Status.SUCCESS,
            message: `(unlinkSecondaryWallet) Secondary wallet unlinked.`,
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(unlinkSecondaryWallet) ${err.message}`,
        };
    }
};

/**
 * Gets a user's main and secondary wallets linked to their account.
 */
export const getWallets = async (twitterId: string, userId?: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ $or: [{ twitterId }, { _id: userId }] }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getWallets) User not found.`,
            };
        }

        const walletAddresses: string[] = [];

        // add the main wallet's public key
        walletAddresses.push(user.wallet?.address ?? '');

        // loop through `secondaryWallets` assuming length is not 0 and add each public key
        if (user.secondaryWallets && user.secondaryWallets.length > 0) {
            for (const secondaryWallet of user.secondaryWallets) {
                walletAddresses.push(secondaryWallet.address);
            }
        }

        return {
            status: Status.SUCCESS,
            message: `(getWallets) Wallets fetched.`,
            data: {
                walletAddresses,
            },
        };
    } catch (err: any) {
        console.log('error here', err);
        return {
            status: Status.ERROR,
            message: `(getWallets) ${err.message}`,
        };
    }
};

/**
 * Gets the main wallet of the user.
 */
export const getMainWallet = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getMainWallet) User not found.`,
            };
        }

        return {
            status: Status.SUCCESS,
            message: `(getMainWallet) Main wallet fetched.`,
            data: {
                wallet: user.wallet,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getMainWallet) ${err.message}`,
        };
    }
}

/**
 * (User) Manually removes a specific amount of resources that the user owns.
 */
export const removeResources = async (twitterId: string, resourcesToRemove: SimplifiedResource[]): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        const userUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {},
        };

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(removeResources) User not found.`,
            };
        }

        const userResources = user.inventory.resources as ExtendedResource[];

        if (userResources.length === 0) {
            return {
                status: Status.BAD_REQUEST,
                message: `(removeResources) User has no resources.`,
            };
        }

        // cumulative inventory weight to reduce after removing resources
        let weightToReduce: number = 0;

        // for each resource specified in `resources` (which is the resources the user wants to remove)
        // check if the user has enough of that resource
        for (const resource of resourcesToRemove) {
            const userResource = userResources.find((r) => r.type === resource.type);

            if (!userResource) {
                return {
                    status: Status.BAD_REQUEST,
                    message: `(removeResources) User does not have enough of this resource to remove: ${resource.type}.`,
                };
            }

            if (userResource.amount < resource.amount) {
                return {
                    status: Status.BAD_REQUEST,
                    message: `(removeResources) User does not have enough of this resource to remove: ${resource.type}.`,
                };
            }

            // get the index of the resource in the user's inventory
            const resourceIndex = userResources.findIndex((r) => r.type === resource.type);

            // if the amount to remove is the same as the amount the user has, remove the resource entirely
            // otherwise, reduce the amount of the resource
            if (userResource.amount === resource.amount) {
                userUpdateOperations.$pull['inventory.resources'] = {
                    type: resource.type,
                };
            } else {
                userUpdateOperations.$inc[`inventory.resources.${resourceIndex}.amount`] = -resource.amount;
            }

            // calculate the total weight to reduce by looping through `resources` and getting the weight of each resource
            const { weight } = resources.find((r) => r.type === resource.type);

            const totalWeight = weight * resource.amount;

            weightToReduce += totalWeight;
        }

        // reduce the user's inventory weight
        userUpdateOperations.$inc['inventory.weight'] = -weightToReduce;

        await UserModel.updateOne({ twitterId }, userUpdateOperations);

        return {
            status: Status.SUCCESS,
            message: `(removeResources) Resources removed.`,
            data: {
                resourcesToRemove,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(removeResources) ${err.message}`,
        };
    }
};

/**
 * (User) Claims the daily rewards.
 *
 * As daily rewards can contain leaderboard points, optionally specify the leaderboard name to add the points to.
 * If no leaderboard name is specified, the points will be added to the newest leaderboard.
 */
export const claimDailyRewards = async (twitterId: string, leaderboardName: string | null): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        const userUpdateOperations = {
            $set: {},
            $inc: {},
            $push: {},
            $pull: {},
        };

        const leaderboardUpdateOperations = {
            $set: {},
            $inc: {},
            $push: {},
            $pull: {},
        };

        const squadUpdateOperations = {
            $set: {},
            $inc: {},
            $push: {},
            $pull: {},
        };

        const squadLeaderboardUpdateOperations = {
            $set: {},
            $inc: {},
            $push: {},
            $pull: {},
        };

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(claimDailyRewards) User not found.`,
            };
        }

        // get the user's squad ID
        const squadId: string | null = user.inGameData.squadId;

        const leaderboard =
            leaderboardName === null
                ? await LeaderboardModel.findOne().sort({ startTimestamp: -1 })
                : await LeaderboardModel.findOne({ name: leaderboardName });

        if (!leaderboard) {
            return {
                status: Status.ERROR,
                message: `(claimDailyRewards) Leaderboard not found.`,
            };
        }

        // get the user's daily login reward data
        const dailyLoginRewardData = user.inGameData.dailyLoginRewardData as DailyLoginRewardData;

        // we don't have to check if it's a new day since a scheduler will change `isDailyClaimable` to true every day at 00:00 UTC.
        // so, we just check if `isDailyClaimable` is true. if not, return an error
        if (!dailyLoginRewardData.isDailyClaimable) {
            return {
                status: Status.BAD_REQUEST,
                message: `(claimDailyRewards) Daily rewards already claimed today.`,
            };
        }

        // get the user's consecutive days claimed
        const consecutiveDaysClaimed = dailyLoginRewardData.consecutiveDaysClaimed;

        // get the daily login rewards based on the consecutive days claimed
        const dailyLoginRewards = GET_DAILY_LOGIN_REWARDS(consecutiveDaysClaimed);

        // 1. add the rewards to the user's inventory
        // 2. increment the user's `consecutiveDaysClaimed` by 1
        // 3. set `isDailyClaimable` to false
        // 4. set `lastClaimedTimestamp` to the current timestamp
        for (const reward of dailyLoginRewards) {
            if (reward.type === DailyLoginRewardType.X_COOKIES) {
                userUpdateOperations.$inc['inventory.xCookieData.currentXCookies'] = reward.amount;

                // check if the user's `xCookieData.extendedXCookieData` contains a source called DAILY_LOGIN_REWARDS.
                // if yes, we increment the amount, if not, we create a new entry for the source
                const dailyLoginRewardsIndex = (user.inventory?.xCookieData.extendedXCookieData as ExtendedXCookieData[]).findIndex(
                    (data) => data.source === XCookieSource.DAILY_LOGIN_REWARDS
                );

                if (dailyLoginRewardsIndex !== -1) {
                    userUpdateOperations.$inc[`inventory.xCookieData.extendedXCookieData.${dailyLoginRewardsIndex}.xCookies`] = reward.amount;
                } else {
                    userUpdateOperations.$push['inventory.xCookieData.extendedXCookieData'] = {
                        xCookies: reward.amount,
                        source: XCookieSource.DAILY_LOGIN_REWARDS,
                    };
                }
            } else if (reward.type === DailyLoginRewardType.LEADERBOARD_POINTS) {
                // add the points to the leaderboard
                // get the index of the user in the leaderboard's `userData` array
                const userIndex = leaderboard.userData.findIndex((userData) => userData.userId === user._id);

                // if the user is not found in the leaderboard, add them
                if (userIndex === -1) {
                    let additionalPoints = 0;
                    // check if the points rewarded will level the user up
                    const currentLevel = user.inGameData.level;
                    // we don't add the user's existing leaderboard points because the user doesn't exist yet
                    const newLevel = GET_SEASON_0_PLAYER_LEVEL(reward.amount);

                    if (newLevel > currentLevel) {
                        // if the user levels up, set the user's level to the new level
                        userUpdateOperations.$set['inGameData.level'] = newLevel;
                        // get the additional points for the new level
                        additionalPoints = GET_SEASON_0_PLAYER_LEVEL_REWARDS(newLevel);
                    }

                    leaderboardUpdateOperations.$push['userData'] = {
                        userId: user._id,
                        username: user.twitterUsername,
                        twitterProfilePicture: user.twitterProfilePicture,
                        pointsData: [
                            {
                                points: reward.amount,
                                source: LeaderboardPointsSource.DAILY_LOGIN_REWARDS,
                            },
                            {
                                points: additionalPoints,
                                source: LeaderboardPointsSource.LEVELLING_UP,
                            },
                        ],
                    };

                    // if user is in a squad, add to squad's `totalSquadPoints`
                    if (squadId) {
                        // get the squad
                        const squad = await SquadModel.findOne({ _id: squadId }).lean();

                        if (!squad) {
                            return {
                                status: Status.ERROR,
                                message: `(claimDailyRewards) Squad not found.`,
                            };
                        }

                        squadUpdateOperations.$inc['totalSquadPoints'] = reward.amount;

                        // get the latest week of the squad leaderboard
                        const latestSquadLeaderboard = await SquadLeaderboardModel.findOne().sort({ week: -1 });

                        if (!latestSquadLeaderboard) {
                            return {
                                status: Status.ERROR,
                                message: `(claimDailyRewards) Latest squad leaderboard not found.`,
                            };
                        }

                        // check if the squad exists in the leaderboard's `pointsData`. if not, we create a new instance.
                        const squadIndex = latestSquadLeaderboard.pointsData.findIndex((data) => data.squadId === squadId);

                        if (squadIndex === -1) {
                            squadLeaderboardUpdateOperations.$push[`pointsData`] = {
                                squadId,
                                squadName: squad.name,
                                memberPoints: [
                                    {
                                        userId: user._id,
                                        username: user.twitterUsername,
                                        points: reward.amount,
                                    },
                                ],
                            };
                        } else {
                            // otherwise, we increment the users points in the squad leaderboard.
                            const userIndex = latestSquadLeaderboard.pointsData[squadIndex].memberPoints.findIndex((data) => data.userId === user._id);

                            // if user is not found, we create a new instance.
                            if (userIndex === -1) {
                                squadLeaderboardUpdateOperations.$push[`pointsData.${squadIndex}.memberPoints`] = {
                                    userId: user._id,
                                    username: user.twitterUsername,
                                    points: reward.amount,
                                };
                            } else {
                                // otherwise, we increment the points
                                squadLeaderboardUpdateOperations.$inc[`pointsData.${squadIndex}.memberPoints.${userIndex}.points`] = reward.amount;
                            }
                        }
                    }
                } else {
                    let additionalPoints = 0;

                    // check if the points rewarded will level the user up
                    const currentLevel = user.inGameData.level;

                    // get the user's total leaderboard points
                    // this is done by summing up all the points from the `pointsData` array, BUT EXCLUDING SOURCES FROM:
                    // 1. LeaderboardPointsSource.LEVELLING_UP
                    const totalLeaderboardPoints = leaderboard.userData[userIndex].pointsData.reduce((acc, pointsData) => {
                        if (pointsData.source !== LeaderboardPointsSource.LEVELLING_UP) {
                            return acc + pointsData.points;
                        }

                        return acc;
                    }, 0);

                    const newLevel = GET_SEASON_0_PLAYER_LEVEL(totalLeaderboardPoints + reward.amount);

                    if (newLevel > currentLevel) {
                        userUpdateOperations.$set['inGameData.level'] = newLevel;
                        additionalPoints = GET_SEASON_0_PLAYER_LEVEL_REWARDS(newLevel);
                    }

                    // get the source index for `LeaderboardPointsSource.DAILY_LOGIN_REWARDS` and increment that
                    // if the source doesn't exist, push a new entry
                    const pointsData = leaderboard.userData[userIndex].pointsData;

                    const sourceIndex = pointsData.findIndex((pointsData) => pointsData.source === LeaderboardPointsSource.DAILY_LOGIN_REWARDS);

                    if (sourceIndex === -1) {
                        leaderboardUpdateOperations.$push[`userData.${userIndex}.pointsData`] = {
                            points: reward.amount,
                            source: LeaderboardPointsSource.DAILY_LOGIN_REWARDS,
                        };
                    } else {
                        leaderboardUpdateOperations.$inc[`userData.${userIndex}.pointsData.${sourceIndex}.points`] = reward.amount;
                    }

                    // if the additionalPoints is > 0, increment the source for `LeaderboardPointsSource.LEVELLING_UP`
                    if (additionalPoints > 0) {
                        const levellingUpSourceIndex = pointsData.findIndex((pointsData) => pointsData.source === LeaderboardPointsSource.LEVELLING_UP);

                        if (levellingUpSourceIndex === -1) {
                            leaderboardUpdateOperations.$push[`userData.${userIndex}.pointsData`] = {
                                points: additionalPoints,
                                source: LeaderboardPointsSource.LEVELLING_UP,
                            };
                        } else {
                            leaderboardUpdateOperations.$inc[`userData.${userIndex}.pointsData.${levellingUpSourceIndex}.points`] = additionalPoints;
                        }
                    }

                    // if user is in a squad, add to squad's `totalSquadPoints`
                    if (squadId) {
                        // get the squad
                        const squad = await SquadModel.findOne({ _id: squadId }).lean();

                        if (!squad) {
                            return {
                                status: Status.ERROR,
                                message: `(claimDailyRewards) Squad not found.`,
                            };
                        }

                        squadUpdateOperations.$inc['totalSquadPoints'] = reward.amount;

                        // get the latest week of the squad leaderboard
                        const latestSquadLeaderboard = await SquadLeaderboardModel.findOne().sort({ week: -1 });

                        if (!latestSquadLeaderboard) {
                            return {
                                status: Status.ERROR,
                                message: `(claimDailyRewards) Latest squad leaderboard not found.`,
                            };
                        }

                        // check if the squad exists in the leaderboard's `pointsData`. if not, we create a new instance.
                        const squadIndex = latestSquadLeaderboard.pointsData.findIndex((data) => data.squadId === squadId);

                        if (squadIndex === -1) {
                            squadLeaderboardUpdateOperations.$push[`pointsData`] = {
                                squadId,
                                squadName: squad.name,
                                memberPoints: [
                                    {
                                        userId: user._id,
                                        username: user.twitterUsername,
                                        points: reward.amount,
                                    },
                                ],
                            };
                        } else {
                            // otherwise, we increment the users points in the squad leaderboard.
                            const userIndex = latestSquadLeaderboard.pointsData[squadIndex].memberPoints.findIndex((data) => data.userId === user._id);

                            // if user is not found, we create a new instance.
                            if (userIndex === -1) {
                                squadLeaderboardUpdateOperations.$push[`pointsData.${squadIndex}.memberPoints`] = {
                                    userId: user._id,
                                    username: user.twitterUsername,
                                    points: reward.amount,
                                };
                            } else {
                                // otherwise, we increment the points
                                squadLeaderboardUpdateOperations.$inc[`pointsData.${squadIndex}.memberPoints.${userIndex}.points`] = reward.amount;
                            }
                        }
                    }
                }
                // if the reward is not xCookies or leaderboard points, return an error (for now)
            } else {
                return {
                    status: Status.ERROR,
                    message: `(claimDailyRewards) Invalid reward type.`,
                };
            }
        }

        // increment the user's `consecutiveDaysClaimed` by 1
        userUpdateOperations.$inc['inGameData.dailyLoginRewardData.consecutiveDaysClaimed'] = 1;

        // set `isDailyClaimable` to false
        userUpdateOperations.$set['inGameData.dailyLoginRewardData.isDailyClaimable'] = false;

        // set `lastClaimedTimestamp` to the current timestamp
        userUpdateOperations.$set['inGameData.dailyLoginRewardData.lastClaimedTimestamp'] = Math.floor(Date.now() / 1000);

        // execute the update operations
        // divide the operations into $set and $inc on one and $push and $pull on the other
        await UserModel.updateOne(
            { twitterId },
            {
                $set: userUpdateOperations.$set,
                $inc: userUpdateOperations.$inc,
            }
        );

        await UserModel.updateOne(
            { twitterId },
            {
                $push: userUpdateOperations.$push,
                $pull: userUpdateOperations.$pull,
            }
        );

        await LeaderboardModel.updateOne(
            { _id: leaderboard._id },
            {
                $set: leaderboardUpdateOperations.$set,
                $inc: leaderboardUpdateOperations.$inc,
            }
        );

        await LeaderboardModel.updateOne(
            { _id: leaderboard._id },
            {
                $push: leaderboardUpdateOperations.$push,
                $pull: leaderboardUpdateOperations.$pull,
            }
        );

        // if user is in a squad, update the squad's total points
        if (squadId) {
            await SquadModel.updateOne({ _id: squadId }, squadUpdateOperations);

            // get the latest week of the squad leaderboard and update it with the points
            const latestSquadLeaderboard = await SquadLeaderboardModel.findOne().sort({ week: -1 });

            if (!latestSquadLeaderboard) {
                return {
                    status: Status.ERROR,
                    message: `(claimDailyRewards) Latest squad leaderboard not found.`,
                };
            }

            await SquadLeaderboardModel.updateOne({ _id: latestSquadLeaderboard._id }, squadLeaderboardUpdateOperations).catch((err) => {
                console.error(`Error from squad leaderboard model: ${err.message}`);
            });
        }

        // check if the user update operations included a level up
        const setUserLevel = userUpdateOperations.$set['inGameData.level'];

        // if the user just reached level 3 or 4, give 5 xCookies to the referrer
        if (setUserLevel && (setUserLevel === 3 || setUserLevel === 4)) {
            const referrerId: string | null = user.inviteCodeData.referrerId;

            if (referrerId) {
                // add the rewards to the referrer's `referralData.claimableReferralRewards.xCookies`.
                const referrer = await UserModel.findOne({ _id: referrerId }).lean();

                // only continue if the referrer exists
                if (referrer) {
                    await UserModel.updateOne({ _id: referrerId }, {
                        $inc: {
                            'referralData.claimableReferralRewards.xCookies': 5
                        }
                    })
                }
            }
        }

        // if it included a level, check if it's set to 5.
        // if it is, check if the user has a referrer.
        // the referrer will then have this user's `hasReachedLevel4` set to true.
        // NOTE: naming is `hasReachedLevel4`, but users are required to be level 5 anyway. this is temporary.
        if (setUserLevel && setUserLevel === 5) {
            // check if the user has a referrer
            const referrerId: string | null = user.inviteCodeData.referrerId;

            if (referrerId) {
                // update the referrer's referred users data where applicable
                const { status, message } = await updateReferredUsersData(referrerId, user._id);

                if (status === Status.ERROR) {
                    return {
                        status,
                        message: `(claimDailyRewards) Err from updateReferredUsersData: ${message}`,
                    };
                }
            }
        }

        // update the user's points in the wonderbits contract
        updatePointsInContract(twitterId);

        return {
            status: Status.SUCCESS,
            message: `(claimDailyRewards) Daily rewards claimed.`,
            data: {
                consecutiveDaysClaimed,
                dailyLoginRewards,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(claimDailyRewards) ${err.message}`,
        };
    }
};

/**
 * Updates all users' daily login reward data.
 * This includes:
 *
 * 1. resetting `isDailyClaimable` to true every day at 00:00 UTC.
 * 2. resetting `consecutiveDaysClaimed` to 0 if the user doesn't claim the reward for the day.
 */
export const updateDailyLoginRewardsData = async (): Promise<void> => {
    try {
        // fetch all users
        const users = await UserModel.find({ twitterId: { $ne: null, $exists: true } }).lean();

        // users who have `isDailyClaimable` = false means they already claimed their rewards.
        // in this case, set `isDailyClaimable` back to true.
        // users who have `isDailyClaimable` = true means they haven't claimed their daily rewards.
        // in this case, reset `consecutiveDaysClaimed` to 0.
        const userUpdateOperations: Array<{
            userId: string;
            updateOperations: {
                $pull: {};
                $inc: {};
                $set: {};
                $push: {};
            };
        }> = [];

        for (const user of users) {
            const dailyLoginRewardData = user.inGameData.dailyLoginRewardData as DailyLoginRewardData;

            if (!dailyLoginRewardData.isDailyClaimable) {
                userUpdateOperations.push({
                    userId: user._id,
                    updateOperations: {
                        $set: {
                            'inGameData.dailyLoginRewardData.isDailyClaimable': true,
                        },
                        $inc: {},
                        $pull: {},
                        $push: {},
                    },
                });
            } else {
                userUpdateOperations.push({
                    userId: user._id,
                    updateOperations: {
                        $set: {
                            'inGameData.dailyLoginRewardData.consecutiveDaysClaimed': 0,
                        },
                        $inc: {},
                        $pull: {},
                        $push: {},
                    },
                });
            }
        }

        // execute the update operations
        const userUpdatePromises = userUpdateOperations.map(async (op) => {
            return UserModel.updateOne({ _id: op.userId }, op.updateOperations);
        });

        await Promise.all(userUpdatePromises);

        console.log('Daily login rewards data updated.');
    } catch (err: any) {
        console.error('Error in updateDailyLoginRewardsData:', err.message);
    }
};

/**
 * Links either a starter or a referral code to play the game (i.e. invite code).
 *
 * The current version only allows users to input EITHER, not both.
 */
export const linkInviteCode = async (twitterId: string, code: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(linkInviteCode) User not found.`,
            };
        }

        // Check if the user has already used a referral code
        if (user.inviteCodeData.usedStarterCode || user.inviteCodeData.usedStarterCode) {
            return {
                status: Status.ERROR,
                message: `(linkInviteCode) User already used a referral code.`,
            };
        }

        // check if the code is a starter code or a referral code
        const starterCode = await StarterCodeModel.findOne({ code: code.toUpperCase() }).lean();

        // find the referrer from which the referrerCode stems from inside a user's `referralData` instance
        const referrer = await UserModel.findOne({ 'referralData.referralCode': code.toUpperCase() }).lean();

        console.log('referrer database ID: ', referrer);

        if (!starterCode && !referrer) {
            return {
                status: Status.BAD_REQUEST,
                message: `(linkInviteCode) Invalid code.`,
            };
        }

        // if the code is a starter code
        if (starterCode) {
            // check if the user already has a starter code.
            // if they do, return an error.
            if (user.inviteCodeData.usedStarterCode) {
                return {
                    status: Status.BAD_REQUEST,
                    message: `(linkInviteCode) User already used a starter code.`,
                };
            }

            // check if the starter code is already used by more than its allowed uses.
            // if it is, return an error.
            if (starterCode.usedBy.length >= starterCode.maxUses) {
                return {
                    status: Status.BAD_REQUEST,
                    message: `(linkInviteCode) Starter code has already reached its limit.`,
                };
            }

            // update the user's starter code data and the starter code's `usedBy` array
            await Promise.all([
                await UserModel.updateOne(
                    { twitterId },
                    {
                        $set: {
                            'inviteCodeData.usedStarterCode': code.toUpperCase(),
                        },
                    }
                ),
                await StarterCodeModel.updateOne(
                    { code: code.toUpperCase() },
                    {
                        $push: {
                            usedBy: user._id,
                        },
                    }
                ),
            ]);
            return {
                status: Status.SUCCESS,
                message: `(linkInviteCode) Starter code linked.`,
                data: {
                    codeType: starterCode ? 'Starter' : 'Referrer',
                    starterCode,
                    referrerId: referrer._id,
                    referrerTwId: referrer.twitterId,
                }
            };
        } else if (referrer) {
            // check if the user already has a referral code.
            // if they do, return an error.
            if (user.inviteCodeData.usedReferralCode) {
                return {
                    status: Status.BAD_REQUEST,
                    message: `(linkInviteCode) User already used a referral code.`,
                };
            }

            // check if the referral code belongs to the user. if it does, return an error.
            if (referrer.twitterId === user.twitterId) {
                return {
                    status: Status.BAD_REQUEST,
                    message: `(linkInviteCode) Referral code belongs to the user.`,
                };
            }

            // update the user's referral code data
            await UserModel.updateOne(
                { twitterId },
                {
                    $set: {
                        'inviteCodeData.usedReferralCode': code.toUpperCase(),
                        'inviteCodeData.referrerId': referrer._id,
                    },
                }
            );

            // also update the referrer's data to include the referred user's data in the `referredUsersData` array
            await UserModel.updateOne(
                { _id: referrer._id },
                {
                    $push: {
                        'referralData.referredUsersData': {
                            userId: user._id,
                            username: user.twitterUsername,
                            referredTimestamp: Math.floor(Date.now() / 1000),
                            hasReachedLevel4: false,
                        },
                    },
                }
            );

            // attempt to join the referrer's squad if they have one.
            const { status, message, data } = await joinReferrerSquad(user.twitterId, referrer.twitterId);

            if (status === Status.ERROR) {
                // if the error is that:
                // 1. the user is already in a squad
                // 2. the referrer is not in a squad
                // 3. the referrer's squad is already full
                // we 'ignore' the error and just return a success but show this message.
                if (
                    message.includes(`User is already in a squad`) ||
                    message.includes(`Referrer's squad is already full`) ||
                    message.includes(`Referrer does not have a squad`)
                ) {
                    return {
                        status: Status.SUCCESS,
                        message: `(linkInviteCode) Referral code linked. Extra error message from joinReferrerSquad: ${message}`,
                        data: {
                            codeType: starterCode ? 'Starter' : 'Referrer',
                            starterCode,
                            referrerId: referrer._id,
                            referrerTwId: referrer.twitterId,
                        }
                    };
                }
            }

            return {
                status: Status.SUCCESS,
                message: `(linkInviteCode) Referral code linked. Extra success message from joinReferrerSquad: ${message}`,
                data: {
                    codeType: starterCode ? 'Starter' : 'Referrer',
                    starterCode,
                    referrerId: referrer._id,
                    referrerTwId: referrer.twitterId,
                    squadId: data.squadId,
                },
            };
        } else {
            return {
                status: Status.ERROR,
                message: `(linkInviteCode) Code not found.`,
            };
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(linkInviteCode) ${err.message}`,
        };
    }
};

/**
 * Checks if the user has a starter or referral code (i.e. invite code) linked.
 *
 * One must exist to be allowed to play the game.
 */
export const checkInviteCodeLinked = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(checkInviteCodeLinked) User not found.`,
            };
        }

        if (!user.inviteCodeData.usedStarterCode && !user.inviteCodeData.usedReferralCode) {
            return {
                status: Status.SUCCESS,
                message: `(checkInviteCodeLinked) No starter or referral code linked.`,
                data: {
                    hasInviteCodeLinked: false,
                },
            };
        }

        return {
            status: Status.SUCCESS,
            message: `(checkInviteCodeLinked) User has an invite code.`,
            data: {
                hasInviteCodeLinked: true,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(checkInviteCodeLinked) ${err.message}`,
        };
    }
};

/**
 * Fetches the user's beginner rewards data.
 */
export const getBeginnerRewardsData = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(getBeginnerRewardsData) User not found.`,
            };
        }

        const beginnerRewardData = user.inGameData.beginnerRewardData as BeginnerRewardData;

        return {
            status: Status.SUCCESS,
            message: `(getBeginnerRewardsData) Beginner rewards data fetched.`,
            data: {
                beginnerRewardData,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getBeginnerRewardsData) ${err.message}`,
        };
    }
};
/**
 * Claims the beginner rewards for the user for a particular day.
 */
export const claimBeginnerRewards = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        const userUpdateOperations = {
            $set: {},
            $inc: {},
            $push: {},
            $pull: {},
        };

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(claimBeginnerRewards) User not found.`,
            };
        }

        // get the user's beginner reward data
        const beginnerRewardData = user.inGameData.beginnerRewardData as BeginnerRewardData;

        // check for beginner reward eligiblity
        const isEligible = beginnerRewardData.daysClaimed.length + beginnerRewardData.daysMissed.length < MAX_BEGINNER_REWARD_DAY;

        if (!isEligible) {
            return {
                status: Status.BAD_REQUEST,
                message: `(claimBeginnerRewards) User is not eligible for beginner rewards.`,
            };
        }

        // get the latest day from both arrays
        // e.g: if daysClaimed is [1, 3, 4] and daysMissed is [2, 5], then get 5
        const latestClaimedDay = beginnerRewardData.daysClaimed.length > 0 ? Math.max(...beginnerRewardData.daysClaimed) : 0;
        const latestMissedDay = beginnerRewardData.daysMissed.length > 0 ? Math.max(...beginnerRewardData.daysMissed) : 0;

        // get the next day to claim
        const nextDayToClaim = Math.max(latestClaimedDay, latestMissedDay) + 1;

        // if the user has already claimed the rewards for the day, return an error
        if (!beginnerRewardData.isClaimable) {
            return {
                status: Status.BAD_REQUEST,
                message: `(claimBeginnerRewards) Rewards already claimed for the day.`,
            };
        }

        // get the beginner rewards for the day
        const rewards = GET_BEGINNER_REWARDS(nextDayToClaim);

        // initialize $each on the user's inventory items
        if (!userUpdateOperations.$push['inventory.items']) {
            userUpdateOperations.$push['inventory.items'] = {
                $each: [],
            };
        }

        // 1. add the rewards to the user's inventory
        // 2. set `isClaimable` to false
        // 3. set `lastClaimedTimestamp` to now
        // 4. add the day to `daysClaimed`
        for (const reward of rewards) {
            if (reward.type === BeginnerRewardType.X_COOKIES) {
                userUpdateOperations.$inc['inventory.xCookieData.currentXCookies'] = reward.amount;

                // check if the user's `xCookieData.extendedXCookieData` contains a source called BEGINNER_REWARDS.
                // if yes, we increment the amount, if not, we create a new entry for the source
                const beginnerRewardsIndex = (user.inventory?.xCookieData.extendedXCookieData as ExtendedXCookieData[]).findIndex(
                    (data) => data.source === XCookieSource.BEGINNER_REWARDS
                );

                if (beginnerRewardsIndex !== -1) {
                    userUpdateOperations.$inc[`inventory.xCookieData.extendedXCookieData.${beginnerRewardsIndex}.xCookies`] = reward.amount;
                } else {
                    userUpdateOperations.$push['inventory.xCookieData.extendedXCookieData'] = {
                        xCookies: reward.amount,
                        source: XCookieSource.BEGINNER_REWARDS,
                    };
                }
            }

            if (reward.type === BeginnerRewardType.BIT_ORB_I) {
                // check if the user already has Bit Orb (I) in their inventory
                const bitOrbIIndex = (user.inventory.items as Item[]).findIndex((i) => i.type === BitOrbType.BIT_ORB_I);

                // if the user already has Bit Orb (I), increment the amount
                // otherwise, add Bit Orb (I) to the user's inventory
                if (bitOrbIIndex !== -1) {
                    userUpdateOperations.$inc[`inventory.items.${bitOrbIIndex}.amount`] = reward.amount;
                } else {
                    userUpdateOperations.$push['inventory.items'].$each.push({
                        type: BitOrbType.BIT_ORB_I,
                        amount: reward.amount,
                        totalAmountConsumed: 0,
                        weeklyAmountConsumed: 0,
                    });
                }
            }

            if (reward.type === BeginnerRewardType.TERRA_CAPSULATOR_I) {
                // check if the user already has Terra Capsulator (I) in their inventory
                const terraCapsulatorIIndex = (user.inventory.items as Item[]).findIndex((i) => i.type === TerraCapsulatorType.TERRA_CAPSULATOR_I);

                // if the user already has Terra Capsulator (I), increment the amount
                // otherwise, add Terra Capsulator (I) to the user's inventory
                if (terraCapsulatorIIndex !== -1) {
                    userUpdateOperations.$inc[`inventory.items.${terraCapsulatorIIndex}.amount`] = reward.amount;
                } else {
                    userUpdateOperations.$push['inventory.items'].$each.push({
                        type: TerraCapsulatorType.TERRA_CAPSULATOR_I,
                        amount: reward.amount,
                        totalAmountConsumed: 0,
                        weeklyAmountConsumed: 0,
                    });
                }
            }
        }

        userUpdateOperations.$set['inGameData.beginnerRewardData.isClaimable'] = false;
        userUpdateOperations.$set['inGameData.beginnerRewardData.lastClaimedTimestamp'] = Math.floor(Date.now() / 1000);
        userUpdateOperations.$push['inGameData.beginnerRewardData.daysClaimed'] = nextDayToClaim;

        // execute the update operations ($set and $inc on one, $push and $pull on the other to prevent conflict)
        await UserModel.updateOne(
            { twitterId },
            {
                $set: userUpdateOperations.$set,
                $inc: userUpdateOperations.$inc,
            }
        );

        await UserModel.updateOne(
            { twitterId },
            {
                $push: userUpdateOperations.$push,
                $pull: userUpdateOperations.$pull,
            }
        );

        return {
            status: Status.SUCCESS,
            message: `(claimBeginnerRewards) Beginner rewards claimed for day ${nextDayToClaim}.`,
            data: {
                claimedDay: nextDayToClaim,
                rewards,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(claimBeginnerRewards) ${err.message}`,
        };
    }
};

// export const checkBeginnerRewardsData = async (): Promise<void> => {
//     try {
//         await mongoose.connect(process.env.MONGODB_URI);

//         const users = await UserModel.find().lean();

//         // find users who have undefined `beginnerRewardData` or `beginnerRewardData` as null
//         const usersToUpdate = users.filter((user) => {
//             if (user?.inGameData?.beginnerRewardData === undefined) {
//                 console.log('user with undefined beginner reward data: ', user._id);
//                 return true;
//             }
//         });

//         console.log('users to update length: ', usersToUpdate.length);
//     } catch (err: any) {
//         console.error('Error in checkBeginnerRewardsData:', err.message);
//     }
// }

/**
 * Updates all users' beginner reward data daily. Called by a scheduler every 00:00 UTC.
 *
 * This includes:
 * 1. only updating users whose `daysMissed` + `daysClaimed` < MAX_BEGINNER_REWARD_DAY.
 * 2. resetting `isClaimable` to true every day at 00:00 UTC.
 * 3. add the current day to the user's `daysMissed` if they don't claim the rewards for the day (i.e. `isClaimable` is still true).
 */
export const updateBeginnerRewardsData = async (): Promise<void> => {
    try {
        const users = await UserModel.find({ twitterId: { $ne: null, $exists: true } }).lean();

        // filter out users who are not eligible for beginner rewards
        const eligibleUsers = users.filter((user) => {
            const beginnerRewardData = (user.inGameData.beginnerRewardData as BeginnerRewardData) ?? undefined;
            return beginnerRewardData && beginnerRewardData.daysClaimed.length + beginnerRewardData.daysMissed.length < MAX_BEGINNER_REWARD_DAY;
        });

        const userUpdateOperations: Array<{
            userId: string;
            updateOperations: {
                $pull: {};
                $inc: {};
                $set: {};
                $push: {};
            };
        }> = [];

        for (const user of eligibleUsers) {
            const beginnerRewardData = (user.inGameData?.beginnerRewardData as BeginnerRewardData) ?? undefined;
            
            // Check if beginnerRewardData is defined or not
            if (beginnerRewardData === undefined) {
                continue;
            }

            // Check if beginnerRewardData is claimed for the first time
            if (beginnerRewardData.daysClaimed.length === 0) {
                continue;
            }

            // for users that have `isClaimable` as false, it means they claimed the rewards already.
            // simply convert `isClaimable` to true.
            if (!beginnerRewardData.isClaimable) {
                userUpdateOperations.push({
                    userId: user._id,
                    updateOperations: {
                        $set: {
                            'inGameData.beginnerRewardData.isClaimable': true,
                        },
                        $inc: {},
                        $pull: {},
                        $push: {},
                    },
                });
            } else {
                // if `isClaimable` is true, it means the user missed claiming the rewards for the day.
                // add the current day to `daysMissed`.
                const latestClaimedDay = beginnerRewardData.daysClaimed.length > 0 ? Math.max(...beginnerRewardData.daysClaimed) : 0;
                const latestMissedDay = beginnerRewardData.daysMissed.length > 0 ? Math.max(...beginnerRewardData.daysMissed) : 0;
                const latestDay = Math.max(latestClaimedDay, latestMissedDay);

                userUpdateOperations.push({
                    userId: user._id,
                    updateOperations: {
                        $push: {
                            'inGameData.beginnerRewardData.daysMissed': latestDay + 1,
                        },
                        $inc: {},
                        $set: {},
                        $pull: {},
                    },
                });
            }
        }

        // execute the update operations ($set and $inc, $push and $pull respectively)
        const userUpdatePromisesOne = userUpdateOperations.map(async (op) => {
            return UserModel.updateOne(
                { _id: op.userId },
                {
                    $set: op.updateOperations.$set,
                    $inc: op.updateOperations.$inc,
                }
            );
        });

        const userUpdatePromisesTwo = userUpdateOperations.map(async (op) => {
            return UserModel.updateOne(
                { _id: op.userId },
                {
                    $push: op.updateOperations.$push,
                    $pull: op.updateOperations.$pull,
                }
            );
        });

        await Promise.all(userUpdatePromisesOne);
        await Promise.all(userUpdatePromisesTwo);

        console.log(`(updateBeginnerRewardsData) Updated ${eligibleUsers.length} users' beginner rewards data.`);
    } catch (err: any) {
        console.error('Error in updateBeginnerRewardsData:', err.message);
    }
};

/**
 * (Season 0) Updates and sets the referred user's `hasReachedLevel4` of the referrer's `referredUsersData` to true IF not already true.
 *
 * Additionally, give the referrer their referral rewards to claim if applicable.
 */
export const updateReferredUsersData = async (referrerUserId: string, referredUserUserId: string): Promise<ReturnValue> => {
    try {
        const [referrer, referredUser] = await Promise.all([
            UserModel.findOne({ _id: referrerUserId }).lean(),
            UserModel.findOne({ _id: referredUserUserId }).lean(),
        ]);

        if (!referrer || !referredUser) {
            return {
                status: Status.ERROR,
                message: `(updateReferredUsersData) User not found.`,
            };
        }

        const referrerUpdateOperations = {
            $set: {},
            $inc: {},
            $push: {},
            $pull: {},
        };

        // check if the referrer's `referredUsersData` contains the referred user
        const referredUserIndex = (referrer.referralData.referredUsersData as ReferredUserData[]).findIndex((data) => data.userId === referredUser._id);

        if (referredUserIndex === -1) {
            return {
                status: Status.BAD_REQUEST,
                message: `(updateReferredUsersData) Referred user data not found.`,
            };
        }

        // at this point, the level of the referred user should already be set to level 5 from the parent function.
        // we double check it here just in case.
        if (referredUser.inGameData.level < 5) {
            return {
                status: Status.BAD_REQUEST,
                message: `(updateReferredUsersData) Referred user is not level 5.`,
            };
        }

        if ((referrer.referralData.referredUsersData as ReferredUserData[])[referredUserIndex].hasReachedLevel4) {
            return {
                status: Status.BAD_REQUEST,
                message: `(updateReferredUsersData) Referred user already reached level 5.`,
            }
        }

        // set `hasReachedLevel4` to true
        // NAMING IS `hasReachedLevel4`, but users ARE REQUIRED TO BE LEVEL 5. THIS IS TEMPORARY ONLY.
        referrerUpdateOperations.$set[`referralData.referredUsersData.${referredUserIndex}.hasReachedLevel4`] = true;

        // now check the amount of referred users the referrer has that reached level 5.
        // we add 1 because the set operation for the newest referred user hasn't been executed yet.
        /// NOTE: NAMING IS TEMPORARILY `hasReachedLevel4`, but users are required to be level 5. naming will be fixed later!!!!
        const totalReferredUsersReachedLevel5 =
            (referrer.referralData.referredUsersData as ReferredUserData[]).filter((data) => data.hasReachedLevel4).length + 1;

        // get the milestones for the referral rewards
        const milestones = [0, 1, 3, 5, 10, 20, 50, 100, 200, 300, 500];

        // check the nearest (rounded down milestone) for the total referred users that reached level 5.
        // e.g. if referred users who reached level 5 is 190, then milestone will be 100.
        const milestone = milestones.reduce((prev, curr) => (curr <= totalReferredUsersReachedLevel5 ? curr : prev), milestones[0]);

        let referralRewards: ReferralReward;

        // set the new milestone if it's greater than the current milestone
        if (milestone > (referrer.referralData as ReferralData).level5ReferredUsersLatestMilestone) {
            // ONLY GET referral rewards if a new milestone is reached.
            // get the referral rewards based on the total referred users that reached level 5.
            referralRewards = GET_SEASON_0_REFERRAL_REWARDS(totalReferredUsersReachedLevel5);

            // if any of the rewards aren't 0, update the referrer's `referralData.claimableReferralRewards`
            if (referralRewards.leaderboardPoints !== 0) {
                // NOTE: 250% MULTIPLIER FOR THE FIRST WEEK. THIS WILL BE CHANGED.
                referrerUpdateOperations.$inc['referralData.claimableReferralRewards.leaderboardPoints'] = referralRewards.leaderboardPoints;
            }

            if (referralRewards.xCookies !== 0) {
                // NOTE: 250% MULTIPLIER FOR THE FIRST WEEK. THIS WILL BE CHANGED.
                referrerUpdateOperations.$inc['referralData.claimableReferralRewards.xCookies'] = referralRewards.xCookies;
            }

            referrerUpdateOperations.$set['referralData.level5ReferredUsersLatestMilestone'] = milestone;
        }

        // execute the update operations
        await UserModel.updateOne({ _id: referrerUserId }, referrerUpdateOperations);

        return {
            status: Status.SUCCESS,
            message: `(updateReferredUsersData) Referred user data updated.`,
            data: {
                newReferralRewards: referralRewards,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(updateReferredUsersData) ${err.message}`,
        };
    }
};


/**
 * Connects a user to their Discord account.
 */
export const connectToDiscord = async (twitterId: string, profile: ExtendedDiscordProfile): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId });
        if (!user) {
            return {
                status: Status.UNAUTHORIZED,
                message: `(connectToDiscord) User is not registered.`,
            };
        }

        // check if the same discord account already connected
        const existedDiscord = await UserModel.findOne({ 'discordProfile.discordId': profile.id, 'twitterId': { $ne: null } });
        if (existedDiscord) {
            return {
                status: Status.BAD_REQUEST,
                message: `(connectToDiscord) User is already connected.`,
            };
        }

        // prevent user to connect to another discord account
        if (!!user.discordProfile?.discordId && user.discordProfile?.discordId !== profile.id) {
            return {
                status: Status.BAD_REQUEST,
                message: `(connectToDiscord) User is already connected.`,
            };
        }

        // merge the account if the user's already registered via BerryBot, if it's existed
        const discordUser = await UserModel.findOne({ 'discordProfile.discordId': profile.id, 'twitterId': null });
        if (discordUser) {
            // get the current xCookies amount from the BerryBot account
            const amount = discordUser.inventory.xCookieData.currentXCookies;

            const cookieDepositIndex = (user.inventory?.xCookieData.extendedXCookieData as ExtendedXCookieData[]).findIndex(
                (data) => data.source === XCookieSource.DISCORD_ENGAGEMENT
            );

            // merge user's xCookies if the Discord engagement source already exists
            if (cookieDepositIndex !== -1) {
                await user.updateOne({
                    $inc: {
                        [`inventory.xCookieData.extendedXCookieData.${cookieDepositIndex}.xCookies`]: amount,
                        'inventory.xCookieData.currentXCookies': amount,
                    },
                });
            } else {
                // add a new entry for Discord engagement xCookies if it doesn't exist
                await user.updateOne({
                    $inc: {
                        'inventory.xCookieData.currentXCookies': amount,
                    },
                    $push: {
                        'inventory.xCookieData.extendedXCookieData': {
                            xCookies: amount,
                            source: XCookieSource.DISCORD_ENGAGEMENT,
                        },
                    },
                });
            }

            // delete the existing BerryBot account to prevent duplication
            await discordUser.deleteOne();
        }

        await user.updateOne({
            $set: {
                discordProfile: {
                    discordId: profile.id,
                    name: profile?.global_name ?? profile.username,
                    username: profile.username,
                    token: profile.discordRefreshToken,
                },
            },
        });

        return {
            status: Status.SUCCESS,
            message: `(connectToDiscord) User connected to Discord successfully.`,
            data: { profile },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(connectToDiscord) ${err.message}`,
        };
    }
};

/**
 * Disconnects a user's discord account.
 */
export const disconnectFromDiscord = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId });
        if (!user) {
            return {
                status: Status.UNAUTHORIZED,
                message: `(disconnectFromDiscord) User is not registered.`,
            };
        }

        // check if user's already connected
        if (!user.discordProfile?.discordId) {
            return {
                status: Status.BAD_REQUEST,
                message: `(disconnectFromDiscord) User is not connected to Discord.`,
            };
        }

        // remove the Discord profile from the user
        user.discordProfile = undefined;
        await user.save();

        return {
            status: Status.SUCCESS,
            message: `(disconnectFromDiscord) User has disconnected from Discord successfully.`,
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(disconnectFromDiscord) ${err.message}`,
        };
    }
};

/**
 * Resets all users' `inventory.xCookieData.weeklyXCookiesSpent` to 0 every week at Sunday 23:59 UTC (called by a scheduler).
 */
export const resetWeeklyXCookiesSpent = async (): Promise<void> => {
    try {
        const users = await UserModel.find({ twitterId: { $ne: null, $exists: true } }).lean();

        const userUpdateOperations: Array<{
            userId: string;
            updateOperations: {
                $pull: {};
                $inc: {};
                $set: {};
                $push: {};
            };
        }> = [];

        for (const user of users) {
            userUpdateOperations.push({
                userId: user._id,
                updateOperations: {
                    $set: {
                        'inventory.xCookieData.weeklyXCookiesSpent': 0,
                    },
                    $inc: {},
                    $pull: {},
                    $push: {},
                },
            });
        }

        // execute the update operations
        const userUpdatePromises = userUpdateOperations.map(async (op) => {
            return UserModel.updateOne({ _id: op.userId }, op.updateOperations);
        });

        await Promise.all(userUpdatePromises);

        console.log('Weekly xCookies spent reset.');
    } catch (err: any) {
        console.error('Error in resetWeeklyXCookiesSpent:', err.message);
    }
};

/**
 * Resets all users' `weeklyAmountConsumed` for each item in `inventory.items` to 0 every week at Sunday 23:59 UTC (called by a scheduler).
 */
export const resetWeeklyItemsConsumed = async (): Promise<void> => {
    try {
        const users = await UserModel.find({ twitterId: { $ne: null, $exists: true } }).lean();

        if (users.length === 0 || !users) {
            return;
        }

        const userUpdateOperations: Array<{
            userId: string;
            $set: {};
        }> = [];

        users.map((user) => {
            const userItems = user.inventory.items as Item[];

            if (userItems.length === 0) {
                return;
            }

            for (const item of userItems) {
                if (!item.weeklyAmountConsumed || item.weeklyAmountConsumed === 0) {
                    continue;
                }

                const itemIndex = userItems.findIndex((i) => i.type === item.type);

                if (itemIndex === -1) {
                    continue;
                }

                userUpdateOperations.push({
                    userId: user._id,
                    $set: { [`inventory.items.${itemIndex}.weeklyAmountConsumed`]: 0 },
                });
            }
        });

        // execute the update operations
        const userUpdatePromises = userUpdateOperations.map(async (op) => {
            return UserModel.updateOne({ _id: op.userId }, op.$set);
        });

        await Promise.all(userUpdatePromises);

        console.log('Weekly items consumed reset.');
    } catch (err: any) {
        console.error('Error in resetWeeklyItemsConsumed:', err.message);
    }
};

export const handlePreRegister = async (twitterId: string, profile?: ExtendedProfile): Promise<ReturnValue> => {
    try {
        const loginType = 'Register';
        const user = await UserModel.findOne({ twitterUsername: profile.username });

        // creates a new raft for the user with the generated user object id
        const { status, message, data } = await createRaft(user._id);

        if (status !== Status.SUCCESS) {
            return {
                status,
                message: `(handlePreRegister) Error from createRaft: ${message}`,
            };
        }

        // get the latest bit ID from the database
        const { status: bitIdStatus, message: bitIdMessage, data: bitIdData } = await getLatestBitId();

        if (bitIdStatus !== Status.SUCCESS) {
            return {
                status: bitIdStatus,
                message: `(handlePreRegister) Error from getLatestBitId: ${bitIdMessage}`,
            };
        }

        const rarity = BitRarity.COMMON;
        const bitType = randomizeBitType();

        const traits = randomizeBitTraits(rarity);

        const bitStatsModifiers = getBitStatsModifiersFromTraits(traits.map((trait) => trait.trait));

        // add a premium common bit to the user's inventory (users get 1 for free when they sign up)
        const { status: bitStatus, message: bitMessage } = await addBitToDatabase({
            bitId: bitIdData?.latestBitId + 1,
            bitType,
            bitNameData: {
                name: bitType,
                lastChanged: 0,
            },
            rarity,
            gender: RANDOMIZE_GENDER(),
            premium: true,
            owner: user._id,
            purchaseDate: Math.floor(Date.now() / 1000),
            obtainMethod: ObtainMethod.SIGN_UP,
            placedIslandId: 0,
            lastRelocationTimestamp: 0,
            currentFarmingLevel: 1, // starts at level 1
            traits,
            farmingStats: {
                ...randomizeFarmingStats(rarity),
                currentEnergy: 50, // set energy to half for tutorial purposes
            },
            bitStatsModifiers,
        });

        if (bitStatus !== Status.SUCCESS) {
            return {
                status: bitStatus,
                message: `(handlePreRegister) Error from addBitToDatabase: ${bitMessage}`,
            };
        }

        // creates the wallet for the user
        const { encryptedPrivateKey, address } = createUserWallet();

        // initialize PlayerEnergy for new user
        const newEnergy: PlayerEnergy = {
            currentEnergy: MAX_ENERGY_CAP,
            maxEnergy: MAX_ENERGY_CAP,
            dailyEnergyPotion: MAX_ENERGY_POTION_CAP,
        };

        await user.updateOne({
            twitterId,
            twitterProfilePicture: profile.photos[0].value ?? '',
            twitterUsername: profile.username,
            twitterDisplayName: profile.displayName,
            createdTimestamp: Math.floor(Date.now() / 1000),
            inviteCodeData: {
                usedStarterCode: user.inviteCodeData.usedStarterCode,
                usedReferralCode: null,
                referrerId: null,
            },
            referralData: {
                referralCode: generateReferralCode(),
                referredUsersData: [],
                claimableReferralRewards: {
                    xCookies: 0,
                    leaderboardPoints: 0,
                },
            },
            wallet: {
                encryptedPrivateKey,
                address,
            },
            secondaryWallets: [],
            openedTweetIdsToday: [],
            inventory: {
                weight: 0,
                maxWeight: MAX_INVENTORY_WEIGHT,
                xCookieData: {
                    currentXCookies: 0,
                    extendedXCookieData: [],
                },
                cookieCrumbs: 0,
                resources: [],
                items: [
                    {
                        type: BoosterItem['GATHERING_PROGRESS_BOOSTER_1000'],
                        amount: 1,
                    },
                ],
                foods: [
                    {
                        type: FoodType['BURGER'],
                        amount: 1,
                    },
                ],
                raftId: data.raft.raftId,
                islandIds: [],
                bitIds: [bitIdData?.latestBitId + 1],
            },
            inGameData: {
                level: 1,
                energy: newEnergy,
                mastery: {
                    tapping: {
                        level: 1,
                        totalExp: 0,
                        rerollCount: 6,
                    },
                    // empty crafting for now (so it can be more flexible)
                    crafting: {},
                    // empty berry factory for now (so it can be more flexible)
                    berryFactory: {}
                },
                completedTutorialIds: [],
                beginnerRewardData: {
                    lastClaimedTimestamp: 0,
                    isClaimable: true,
                    daysClaimed: [],
                    daysMissed: [],
                },
                dailyLoginRewardData: {
                    lastClaimedTimestamp: 0,
                    isDailyClaimable: true,
                    consecutiveDaysClaimed: 0,
                },
                squadId: null,
                lastLeftSquad: 0,
                location: POIName.HOME,
                travellingTo: null,
                destinationArrival: 0,
            },
        });

        // give the user some KICK tokens
        const { status: kickStatus, message: kickMessage } = await sendKICKUponRegistration(address);

        // send any necessary mails to the new user (mails with `includeNewUsers` set to true)
        await sendMailsToNewUser(twitterId);

        return {
            status: Status.SUCCESS,
            message: `(handlePreRegister) New user created and free Rafting Bit added to raft.`,
            data: {
                userId: user._id,
                twitterId: user.twitterId,
                loginType: loginType,
                // checks if sending KICK is successful; no need to throw error if unsuccessful.
                sendKICKStatus: kickStatus,
                sendKICKMessage: kickMessage,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(handlePreRegister) ${err.message}`,
        };
    }
};

/**
 * Consumes an energy potion for a user and updates their energy and optionally islands tapping progress.
 */
export const consumeEnergyPotion = async (
    twitterId: string, 
    tappingProgress?: {islandId: number, currentCaressEnergyMeter: number}[],
): Promise<ReturnValue> => {
    try {
        const userUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {},
        };

        let bulkWriteIslandOps: any[] = [];
        let totalTappingProgressEnergyRequired: number = 0;

        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(consumeEnergyPotion) User not found.`
            }
        }
        
        // Destructure user's energy variables
        const { currentEnergy, maxEnergy, dailyEnergyPotion } = user.inGameData.energy as PlayerEnergy;
        console.log(`(consumeEnergyPotion), userId ${user._id} | username ${user.twitterUsername}`);
        console.log('(consumeEnergyPotion), tappingProgress: ', tappingProgress);

        if (dailyEnergyPotion <= 0) {
            return {
                status: Status.ERROR,
                message: `(consumeEnergyPotion) User has no Energy Potion left!`
            }
        }

        if (currentEnergy >= maxEnergy) {
            return {
                status: Status.ERROR,
                message: `(consumeEnergyPotion) User current energy already capped!`
            }
        }

        // If tappingProgress is passed, update islands' current tapping progress
        if (tappingProgress) {
            const islandIds = tappingProgress.map((progress) => progress.islandId);
            const islands = await IslandModel.find({ islandId: { $in: islandIds }, owner: user._id });
            console.log('(consumeEnergyPotion) islands: ', JSON.stringify(islands));

            // Calculate the total energy required for tapping progress
            totalTappingProgressEnergyRequired = tappingProgress.reduce((total, progress) => {
                return total + Math.ceil(progress.currentCaressEnergyMeter / BASE_CARESS_PER_TAPPING) * BASE_ENERGY_PER_TAPPING;
            }, 0);

            // Check if the current energy is enough for the tapping progress
            if (totalTappingProgressEnergyRequired > currentEnergy) {
                console.warn(`(consumeEnergyPotion) User ${user._id} doesn't have enough energy for tappingProgress: ${totalTappingProgressEnergyRequired} > ${currentEnergy}`);
            } else {
                // Prepare bulk write operations for the islands
                bulkWriteIslandOps = tappingProgress.map((progress) => {
                    const island = islands.find((island) => island.islandId === progress.islandId);

                    if (island) {
                        const { caressEnergyMeter, currentCaressEnergyMeter } = island.islandTappingData;
                        const newCurrentCaressEnergyMeter = Math.min(currentCaressEnergyMeter + progress.currentCaressEnergyMeter, caressEnergyMeter);

                        return {
                            updateOne: {
                                filter: { islandId: progress.islandId, owner: user._id },
                                update: { $set: { 'islandTappingData.currentCaressEnergyMeter': newCurrentCaressEnergyMeter } }
                            },
                        };
                    } else {
                        console.warn(`(consumeEnergyPotion) Island with ID ${progress.islandId} not found for User ID: ${user._id}, Username: ${user.twitterUsername}`);
                        return null;
                    }
                }).filter((op) => op !== null);  // Remove null operations
            }
        }

        // Calculate new current energy and new energy potion count
        const energyAfterTapping = currentEnergy >= totalTappingProgressEnergyRequired ? 
            currentEnergy - totalTappingProgressEnergyRequired : 
            currentEnergy;
        const newCurrentEnergy = Math.min(maxEnergy, energyAfterTapping + ENERGY_POTION_RECOVERY);
        const newEnergyPotionCount = Math.max(dailyEnergyPotion - 1, 0);

        // Set the new current energy and daily energy potion count in the update operations
        userUpdateOperations.$set['inGameData.energy.currentEnergy'] = newCurrentEnergy;
        userUpdateOperations.$set['inGameData.energy.dailyEnergyPotion'] = newEnergyPotionCount;

        // Update the user document in the database and islands if there are operations
        const operations: Promise<any>[] = [UserModel.updateOne({ twitterId }, userUpdateOperations)];

        if (bulkWriteIslandOps.length > 0) {
            operations.push(IslandModel.bulkWrite(bulkWriteIslandOps));
        }

        await Promise.all(operations);

        // Return success status and message
        return {
            status: Status.SUCCESS,
            message: `(consumeEnergyPotion) Energy Potion consumed successfully.`,
            data: {
                previousEnergy: energyAfterTapping,
                newEnergy: newCurrentEnergy,
                potionCount: newEnergyPotionCount,
            }
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(consumeEnergyPotion) ${err.message}`,
        };
    }
};

/** 
 * Function to update users' daily energy potion count if it's below the maximum cap
 */
export const updateUserEnergyPotion = async (): Promise<void> => {
    try {
        const users = await UserModel.find({ 'inGameData.energy.dailyEnergyPotion': { $lt: MAX_ENERGY_POTION_CAP } }).lean();
        
        if (users.length === 0 || !users) {
            console.error(`(updateUserEnergyPotion) No users found.`);
            return;
        }

        const bulkWriteOps = users.map(user => {
            // Calculate the new daily energy potion value, ensuring it does not exceed the maximum cap
            const newEnergyPotionCount = Math.min(user.inGameData.energy.dailyEnergyPotion + 1, MAX_ENERGY_POTION_CAP);

            return {
                updateOne: {
                    filter: { _id: user._id },
                    update: {
                        $set: { 'inGameData.energy.dailyEnergyPotion': newEnergyPotionCount }
                    }
                }
            };
        });

        await UserModel.bulkWrite(bulkWriteOps);
        console.log(`(updateUserEnergyPotion), added 1 Energy Potion into ${users.length} Users`);
    } catch (err: any) {
        console.error(`(updateUserEnergyPotion), Error: ${err.message}`);
    }
};

/** 
 * Function to restore all available user currentEnergy back to maximum cap
 */
export const restoreUserCurrentEnergyAndResetReroll = async (): Promise<void> => {
    try {
        // Restore user currentEnergy to the maximum cap
        const usersWithLowEnergy = await UserModel.find({ 'inGameData.energy.currentEnergy': { $lt: MAX_ENERGY_CAP } }).lean();
        const usersWithTappingMastery = await UserModel.find({ 'inGameData.mastery.tapping': { $exists: true } }).lean();

        // Check if there are users with low energy and update them
        if (usersWithLowEnergy.length > 0) {
            const bulkWriteEnergyOps = usersWithLowEnergy.map(user => ({
                updateOne: {
                    filter: { _id: user._id },
                    update: {
                        $set: { 'inGameData.energy.currentEnergy': MAX_ENERGY_CAP }
                    }
                }
            }));
            await UserModel.bulkWrite(bulkWriteEnergyOps);
            console.log(`(restoreUserCurrentEnergyAndResetReroll) Restored energy for ${usersWithLowEnergy.length} users.`);
        } else {
            console.log(`(restoreUserCurrentEnergyAndResetReroll) No users with low energy found.`);
        }

        // Check if there are users with tapping mastery data and reset reroll count
        if (usersWithTappingMastery.length > 0) {
            const bulkWriteRerollOps = usersWithTappingMastery.map(user => {
                const tappingLevel = user.inGameData.mastery.tapping.level;
                const rerollCount = DAILY_REROLL_BONUS_MILESTONE(tappingLevel);
                return {
                    updateOne: {
                        filter: { _id: user._id },
                        update: {
                            $set: { 'inGameData.mastery.tapping.rerollCount': rerollCount }
                        }
                    }
                }
            });
            await UserModel.bulkWrite(bulkWriteRerollOps);
            console.log(`(restoreUserCurrentEnergyAndResetReroll) Reset reroll count for ${usersWithTappingMastery.length} users.`);
        } else {
            console.log(`(restoreUserCurrentEnergyAndResetReroll) No users with tapping mastery data found.`);
        }
    } catch (err: any) {
        console.error(`(restoreUserCurrentEnergyAndResetReroll) Error: ${err.message}`);
    }
};
/**
 * Updated all players level using the new values
 */
export const updatePlayerLevels = async () => {
    try {
        console.log('starting to update...');
        const users = await UserModel.find();

        console.log('total users found: ', users.length);

        for (const user of users) {
            if (!user.inventory) continue;

            console.log('start updating level: ', user.twitterUsername);
            const { data } = await getUserCurrentPoints(user.twitterId);
            const newLevel = GET_SEASON_0_PLAYER_LEVEL(data.points);

            await UserModel.updateOne(
                { twitterUsername: user.twitterUsername },
                {
                    $set: {
                        'inGameData.level': newLevel,
                    },
                }
            );
            console.log('finished updating level: ', user.twitterUsername);
        }

        console.log('All user levels have been updated successfully.');
    } catch (error) {
        console.error('Error updating user levels:', error);
    }
};

/**
 * Twitter login logic. Creates a new user or simply log them in if they already exist.
 *
 */
export const handleTelegramLogin = async (telegramUser: TelegramAuthData['user']): Promise<ReturnValue> => {
    try {
        let loginType: 'Register' | 'Login';

        const user = await UserModel.findOne({ $or: [{ twitterId: telegramUser.id, method: 'telegram' }, { 'telegramProfile.telegramId': telegramUser.id }] }).lean();

        // if user doesn't exist, create a new user
        if (!user) {
            console.log(`creating new telegram user: ${telegramUser.id}`)
            // generates a new object id for the user
            const userObjectId = generateObjectId();
            loginType = 'Register';

            // creates a new raft for the user with the generated user object id
            const { status, message, data } = await createRaft(userObjectId);

            if (status !== Status.SUCCESS) {
                return {
                    status,
                    message: `(handleTelegramLogin) Error from createRaft: ${message}`,
                };
            }

            // get the latest bit ID from the database
            const { status: bitIdStatus, message: bitIdMessage, data: bitIdData } = await getLatestBitId();

            if (bitIdStatus !== Status.SUCCESS) {
                return {
                    status: bitIdStatus,
                    message: `(handleTelegramLogin) Error from getLatestBitId: ${bitIdMessage}`,
                };
            }

            const rarity = BitRarity.COMMON;
            const bitType = randomizeBitType();

            const traits = randomizeBitTraits(rarity);

            const bitStatsModifiers = getBitStatsModifiersFromTraits(traits.map((trait) => trait.trait));

            // add a premium common bit to the user's inventory (users get 1 for free when they sign up)
            const {
                status: bitStatus,
                message: bitMessage,
                data: bitData,
            } = await addBitToDatabase({
                bitId: bitIdData?.latestBitId + 1,
                bitType,
                bitNameData: {
                    name: bitType,
                    lastChanged: 0,
                },
                rarity,
                gender: RANDOMIZE_GENDER(),
                premium: true,
                owner: userObjectId,
                purchaseDate: Math.floor(Date.now() / 1000),
                obtainMethod: ObtainMethod.SIGN_UP,
                placedIslandId: 0,
                lastRelocationTimestamp: 0,
                currentFarmingLevel: 1, // starts at level 1
                traits,
                farmingStats: {
                    ...randomizeFarmingStats(rarity),
                    currentEnergy: 50, // set energy to half for tutorial purposes
                },
                bitStatsModifiers,
            });

            if (bitStatus !== Status.SUCCESS) {
                return {
                    status: bitStatus,
                    message: `(handleTelegramLogin) Error from addBitToDatabase: ${bitMessage}`,
                };
            }

            const islandStatsModifiers: IslandStatsModifiers = {
                resourceCapModifiers: [],
                gatheringRateModifiers: [],
                earningRateModifiers: [],
            };

            // check the bit's traits
            // if it has influential, antagonistic, famous or mannerless, then:
            // if influential, add 1% to earning and gathering rate modifiers of the island
            // if antagonistic, reduce 1% to earning and gathering rate modifiers of the island
            // if famous, add 0.5% to earning and gathering rate modifiers of the island
            // if mannerless, reduce 0.5% to earning and gathering rate modifiers of the island
            if (traits.some((trait) => trait.trait === BitTrait.INFLUENTIAL)) {
                // add 1% to earning and gathering rate modifiers of the island
                const gatheringRateModifier: Modifier = {
                    origin: `Bit ID ${bitData.bit.bitId}'s Trait: Influential`,
                    value: 1.01,
                };

                const earningRateModifier: Modifier = {
                    origin: `Bit ID ${bitData.bit.bitId}'s Trait: Influential`,
                    value: 1.01,
                };

                islandStatsModifiers.gatheringRateModifiers.push(gatheringRateModifier);
                islandStatsModifiers.earningRateModifiers.push(earningRateModifier);
            }

            // if the bit has antagonistic trait
            if (traits.some((trait) => trait.trait === BitTrait.ANTAGONISTIC)) {
                // reduce 1% to earning and gathering rate modifiers of the island
                const gatheringRateModifier: Modifier = {
                    origin: `Bit ID ${bitData.bit.bitId}'s Trait: Antagonistic`,
                    value: 0.99,
                };

                const earningRateModifier: Modifier = {
                    origin: `Bit ID ${bitData.bit.bitId}'s Trait: Antagonistic`,
                    value: 0.99,
                };

                islandStatsModifiers.gatheringRateModifiers.push(gatheringRateModifier);
                islandStatsModifiers.earningRateModifiers.push(earningRateModifier);
            }

            // if the bit has famous trait
            if (traits.some((trait) => trait.trait === BitTrait.FAMOUS)) {
                // add 0.5% to earning and gathering rate modifiers of the island
                const gatheringRateModifier: Modifier = {
                    origin: `Bit ID ${bitData.bit.bitId}'s Trait: Famous`,
                    value: 1.005,
                };

                const earningRateModifier: Modifier = {
                    origin: `Bit ID ${bitData.bit.bitId}'s Trait: Famous`,
                    value: 1.005,
                };

                islandStatsModifiers.gatheringRateModifiers.push(gatheringRateModifier);
                islandStatsModifiers.earningRateModifiers.push(earningRateModifier);
            }

            // if the bit has mannerless trait
            if (traits.some((trait) => trait.trait === BitTrait.MANNERLESS)) {
                // reduce 0.5% to earning and gathering rate modifiers of the island
                const gatheringRateModifier: Modifier = {
                    origin: `Bit ID ${bitData.bit.bitId}'s Trait: Mannerless`,
                    value: 0.995,
                };

                const earningRateModifier: Modifier = {
                    origin: `Bit ID ${bitData.bit.bitId}'s Trait: Mannerless`,
                    value: 0.995,
                };

                islandStatsModifiers.gatheringRateModifiers.push(gatheringRateModifier);
                islandStatsModifiers.earningRateModifiers.push(earningRateModifier);
            }

            // creates a free primal island for the user
            const { status: islandIdStatus, message: islandIdMessage, data: islandIdData } = await getLatestIslandId();

            if (islandIdStatus !== Status.SUCCESS) {
                return {
                    status: islandIdStatus,
                    message: `(handleTwitterLogin) Error from getLatestIslandId: ${islandIdMessage}`,
                };
            }

            const {
                status: islandStatus,
                message: islandMessage,
                data: islandData,
            } = await addIslandToDatabase({
                islandId: islandIdData?.latestIslandId + 1,
                type: IslandType.PRIMAL_ISLES,
                owner: userObjectId,
                purchaseDate: Math.floor(Date.now() / 1000),
                obtainMethod: ObtainMethod.SIGN_UP,
                currentLevel: 1,
                currentTax: 0,
                placedBitIds: [],
                traits: randomizeIslandTraits(),
                islandResourceStats: {
                    baseResourceCap: randomizeBaseResourceCap(IslandType.PRIMAL_ISLES),
                    resourcesGathered: [],
                    dailyBonusResourcesGathered: 0,
                    claimableResources: [],
                    gatheringStart: 0,
                    gatheringEnd: 0,
                    lastClaimed: 0,
                    gatheringProgress: 0,
                    lastUpdatedGatheringProgress: Math.floor(Date.now() / 1000),
                },
                islandEarningStats: {
                    totalXCookiesSpent: 0,
                    totalXCookiesEarnable: 0,
                    totalXCookiesEarned: 0,
                    claimableXCookies: 0,
                    totalCookieCrumbsSpent: 0,
                    totalCookieCrumbsEarnable: 0,
                    totalCookieCrumbsEarned: 0,
                    claimableCookieCrumbs: 0,
                    earningStart: 0,
                    crumbsEarningStart: 0,
                    earningEnd: 0,
                    crumbsEarningEnd: 0,
                    lastClaimed: 0,
                },
                islandStatsModifiers,
                islandTappingData: ISLAND_TAPPING_REQUIREMENT(1, 1),
            });

            if (islandStatus !== Status.SUCCESS) {
                return {
                    status: islandStatus,
                    message: `(handleTwitterLogin) Error from createBarrenIsland: ${islandMessage}`,
                };
            }

            // creates the wallet for the user
            const { encryptedPrivateKey, address } = createUserWallet();

            // initialize PlayerEnergy for new user
            const newEnergy: PlayerEnergy = {
                currentEnergy: MAX_ENERGY_CAP,
                maxEnergy: MAX_ENERGY_CAP,
                dailyEnergyPotion: MAX_ENERGY_POTION_CAP,
            };

            const newUser = new UserModel({
                _id: userObjectId,
                twitterId: telegramUser.id,
                method: 'telegram',
                twitterProfilePicture: 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png',
                twitterUsername: telegramUser.username,
                twitterDisplayName: `${telegramUser.first_name} ${telegramUser.last_name}`.trim(),
                createdTimestamp: Math.floor(Date.now() / 1000),
                // invite code data will be null until users input their invite code.
                inviteCodeData: {
                    usedStarterCode: null,
                    usedReferralCode: null,
                    referrerId: null,
                },
                referralData: {
                    referralCode: generateReferralCode(),
                    referredUsersData: [],
                    claimableReferralRewards: {
                        xCookies: 0,
                        leaderboardPoints: 0,
                    },
                },
                wallet: {
                    encryptedPrivateKey,
                    address,
                },
                secondaryWallets: [],
                openedTweetIdsToday: [],
                inventory: {
                    weight: 0,
                    maxWeight: MAX_INVENTORY_WEIGHT,
                    xCookieData: {
                        currentXCookies: 0,
                        extendedXCookieData: [],
                    },
                    cookieCrumbs: 0,
                    resources: [],
                    items: [
                        {
                            type: BoosterItem['GATHERING_PROGRESS_BOOSTER_1000'],
                            amount: 1,
                        },
                    ],
                    foods: [
                        {
                            type: FoodType['BURGER'],
                            amount: 1,
                        },
                    ],
                    raftId: data.raft.raftId,
                    islandIds: [islandData.island.islandId],
                    bitIds: [bitIdData?.latestBitId + 1],
                },
                inGameData: {
                    level: 1,
                    energy: newEnergy,
                    mastery: {
                        tapping: {
                            level: 1,
                            totalExp: 0,
                            rerollCount: 6,
                        },
                        // empty crafting for now (so it can be more flexible)
                        crafting: {},
                        // empty berry factory for now (so it can be more flexible)
                        berryFactory: {},
                    },
                    completedTutorialIds: [],
                    beginnerRewardData: {
                        lastClaimedTimestamp: 0,
                        isClaimable: true,
                        daysClaimed: [],
                        daysMissed: [],
                    },
                    dailyLoginRewardData: {
                        lastClaimedTimestamp: 0,
                        isDailyClaimable: true,
                        consecutiveDaysClaimed: 0,
                    },
                    squadId: null,
                    lastLeftSquad: 0,
                    location: POIName.HOME,
                    travellingTo: null,
                    destinationArrival: 0,
                },
            });

            await newUser.save();

            // give the user some KICK tokens
            const { status: kickStatus, message: kickMessage } = await sendKICKUponRegistration(address);

            // send any necessary mails to the new user (mails with `includeNewUsers` set to true)
            await sendMailsToNewUser(String(telegramUser.id));

            return {
                status: Status.SUCCESS,
                message: `(handleTelegramLogin) New user created.`,
                data: {
                    userId: newUser._id,
                    twitterId: telegramUser.id,
                    loginType: loginType,
                    referralCode: newUser.referralData.referralCode
                },
            };
        } else {
            loginType = 'Login';

            // user exists, return
            return {
                status: Status.SUCCESS,
                message: `(handleTelegramLogin) User found. Logging in.`,
                data: {
                    userId: user._id,
                    twitterId: user.twitterId,
                    loginType: loginType,
                    referralCode: user.referralData.referralCode
                },
            };
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(handleTelegramLogin) ${err.message}`,
        };
    }
};

export const updateLoginStreak = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(updateLoginStreak) User not found.`,
            };
        }

        const currentTimestamp = Date.now();

        let streak = user.inGameData.loginStreak ?? 0;
        const lastLoginTimestamp = user.inGameData.lastLoginTimestamp ?? 0;

        const now = new Date();
        const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
        const estTime = new Date(utcTime + (3600000 * -5)); // EST is UTC-5

        const currentDate = estTime.toDateString();
        estTime.setHours(7, 0, 0, 0); // set the time to 7 AM EST
        const resetTimestamp = estTime.getTime();

        const lastLoginDate = new Date(lastLoginTimestamp).toDateString();

        if (currentDate !== lastLoginDate && currentTimestamp >= resetTimestamp) {
            streak = 0; // Reset streak if the login is after 7 AM EST and it's a new day
        } else {
            streak += 1; // Increment streak
        }

        // Update user in database
        await UserModel.updateOne({ twitterId }, {
            $set: {
                inGameData: {
                    ...user.inGameData,
                    lastLoginTimestamp: currentTimestamp,
                    loginStreak: streak,
                }
            }
        });

        return {
            status: Status.SUCCESS,
            message: `(updateLoginStreak) Login streak updated.`,
            data: {
                inGameData: user.inGameData,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(updateLoginStreak) ${err.message}`,
        };
    }
}

/**
 * Connect existing Twitter account to Telegram
 */
export const handleTelegramConnect = async (twitterId: string, telegramUser: TelegramAuthData['user'], confirm?: boolean): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId });

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(handleTelegramConnect) User not found.`,
            };
        }

        if (user.telegramProfile) {
            return {
                status: Status.ERROR,
                message: `(handleTelegramConnect) You've already connected to Telegram.`,
            };
        }

        // prevent user that logged in using telegram to connect
        if (user.method === 'telegram') {
            return {
                status: Status.ERROR,
                message: `(handleTelegramConnect) Cannot connect the account because it was logged in via Telegram.`,
            };
        }

        // check if the telegram account already connected to another account
        const isConnected = await UserModel.findOne({ 'telegramProfile.telegramId': telegramUser.id });
        if (isConnected) {
            return {
                status: Status.ERROR,
                message: `(handleTelegramConnect) Telegram account already connected to another user.`,
            };
        }

        // check if the telegram account already registered via telegram
        const registeredTelegram = await UserModel.findOne({ twitterId: telegramUser.id, method: 'telegram' });
        if (registeredTelegram && !confirm) {
            return {
                status: Status.ERROR,
                message: `(handleTelegramConnect) Telegram account already registered.`,
                data: {
                    needConfirmation: true
                }
            };
        } else {
            // if the user's confirmed then delete the existed telegram account
            await registeredTelegram.deleteOne();
        }

        // assign telegram profile to the account
        await user.updateOne({
            telegramProfile: {
                telegramId: telegramUser.id,
                name: `${telegramUser.first_name} ${telegramUser.last_name}`.trim(),
                username: telegramUser.username || telegramUser.id,
            }
        })

        return {
            status: Status.SUCCESS,
            message: `(handleTelegramConnect) Telegram account connected successfully.`,
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(handleTelegramConnect) ${err.message}`,
        };
    }
}
