import { BitOrbType } from '../models/item';
import { WonderpassLevelData } from '../models/wonderpass';
import { UserModel, UserWonderpassDataModel, WonderpassModel } from '../utils/constants/db';
import { generateObjectId } from '../utils/crypto';
import { ReturnValue, Status } from '../utils/retVal';

/**
 * Adds a Wonderpass to the database.
 */
export const addWonderpass = async (
    name: string,
    startTimestamp: number,
    endTimestamp: number,
    levelData: WonderpassLevelData[]
): Promise<void> => {
    try {
        // NOTE: Only 1 active Wonderpass can exist (either fully or partially) between `start` and `end`.
        // if the times overlap with an existing wonderpass, return an error
        const existingWonderpass = await WonderpassModel.findOne({
            // find a wonderpass where:
            // 1. the start time is before or equal to the new wonderpass's end time
            // 2. the end time is after or equal to the new wonderpass's start time
            start: { $lte: endTimestamp },
            end: { $gte: startTimestamp }
        }).lean();

        if (existingWonderpass) {
            throw new Error(`(addWonderpass) A Wonderpass already exists between ${startTimestamp} and ${endTimestamp}`);
        }

        // add the new wonderpass
        await WonderpassModel.create({
            _id: generateObjectId(),
            name,
            start: startTimestamp,
            end: endTimestamp,
            levelData
        });

        console.log(`(addWonderpass) Added Wonderpass: ${name}`);
    } catch (err: any) {
        throw new Error(`(addWonderpass) ${err.message}`);
    }
}

/**
 * Helper function to progress the current Wonderpass' XP (and potentially level) for the user.
 * 
 * Called via various functions that give Wonderpass XP to the user.
 */
export const progressWonderpass = async (
    twitterId: string,
    xpObtained: number
): Promise<ReturnValue> => {
    try {
        const [ user, wonderpass ] = await Promise.all([
            UserModel.findOne({ twitterId }).lean(),
            WonderpassModel.findOne({
                start: { $lte: Math.floor(Date.now() / 1000) },
                end: { $gte: Math.floor(Date.now() / 1000) }
            }).lean()
        ])

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(progressWonderpass) User not found.`
            }
        }

        if (!wonderpass) {
            return {
                status: Status.ERROR,
                message: `(progressWonderpass) Wonderpass not found.`
            }
        }

        // get the user's wonderpass data
        const userWonderpassData = await UserWonderpassDataModel.findOne({ wonderpassId: wonderpass._id }).lean();

        // if the data doesn't exist, we will create it.
        // NOTE: if the user purchases the wonderpass, they will already have the data initialized, so it's safe to say that
        // if the data doesn't exist, the user is on the free version.
        if (!userWonderpassData) {
            // check which level the user is at based on `xpObtained` by checking the wonderpass' level data
            const level = wonderpass.levelData.find(data => data.xpRequired <= xpObtained)?.level ?? 1;

            // based on the level, check if that level has claimable rewards.
            // if yes, add the level to the array. if not, skip it.
            const claimableFreeLevels = wonderpass.levelData.map(data => {
                if (data.level <= level && data.freeRewards.length > 0) {
                    return data.level;
                }
            }).filter(Boolean);

            // create the user wonderpass data
            await UserWonderpassDataModel.create({
                _id: generateObjectId(),
                userId: user._id,
                wonderpassId: wonderpass._id,
                level,
                xp: xpObtained,
                premium: false,
                claimableFreeLevels: claimableFreeLevels,
                claimedFreeLevels: [],
                claimablePremiumLevels: [],
                claimedPremiumLevels: []
            });

            return {
                status: Status.SUCCESS,
                message: `(progressWonderpass) Created user wonderpass data.`
            }
        }

        // if the user's wonderpass data exists, we will update it.
        // calculate the new XP and level
        const newXP = userWonderpassData.xp + xpObtained;
        const newLevel = wonderpass.levelData.find(data => data.xpRequired <= newXP)?.level ?? 1;

        // check if the user has leveled up
        if (newLevel > userWonderpassData.level) {
            // we get an array of levels that the user has progressed through
            const newLevels = Array.from({ length: newLevel - userWonderpassData.level }, (_, i) => userWonderpassData.level + i + 1);
            
            // based on the level, check if that level has claimable rewards.
            // if yes, add the level to the array. if not, skip it.
            const newClaimableFreeLevels = wonderpass.levelData.map(data => {
                if (newLevels.includes(data.level) && data.freeRewards.length > 0) {
                    return data.level;
                }
            }).filter(Boolean);

            // if the user has the premium version, we will also check for claimable premium rewards.
            const newClaimablePremiumLevels = userWonderpassData.premium && wonderpass.levelData.map(data => {
                if (newLevels.includes(data.level) && data.premiumRewards.length > 0) {
                    return data.level;
                }
            }) || [];

            // update the user wonderpass data
            await UserWonderpassDataModel.updateOne({ _id: userWonderpassData._id }, {
                level: newLevel,
                xp: newXP,
                // append the new levels to the existing arrays
                claimableFreeLevels: [...userWonderpassData.claimableFreeLevels, ...newClaimableFreeLevels],
                claimablePremiumLevels: [...userWonderpassData.claimablePremiumLevels, ...newClaimablePremiumLevels]
            });

            return {
                status: Status.SUCCESS,
                message: `(progressWonderpass) Updated user wonderpass data. Levelled up.`
            }
        } else {
            // if the user hasn't leveled up, we will only update the XP.
            await UserWonderpassDataModel.updateOne({ _id: userWonderpassData._id }, {
                xp: newXP
            });

            return {
                status: Status.SUCCESS,
                message: `(progressWonderpass) Updated user wonderpass data.`
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(progressWonderpass) ${err.message}`
        }
    }
}