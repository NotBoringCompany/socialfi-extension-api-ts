import { SquadRole } from '../models/squad';
import { SquadModel, UserModel } from '../utils/constants/db';
import { INITIAL_MAX_MEMBERS } from '../utils/constants/squad';
import { ReturnValue, Status } from '../utils/retVal';

/**
 * Attempts to join the referrer's squad if possible.
 */
export const joinReferrerSquad = async (
    userTwitterId: string,
    referrerTwitterId: string
): Promise<ReturnValue> => {
    try {
        const [user, referrer] = await Promise.all([
            UserModel.findOne({ twitterId: userTwitterId }).lean(),
            UserModel.findOne({ twitterId: referrerTwitterId }).lean()
        ]);

        if (!user || !referrer) {
            return {
                status: Status.ERROR,
                message: `(joinReferrerSquad) User or referrer not found.`
            }
        }

        // since this is called directly under `linkInviteCode` when a user signs up with a referral code,
        // we don't need to extra check whether the user used a referral code or not.
        // we will just firstly check if the user already has a squad (which they shouldn't at this point, but just in case).
        if (user.inGameData.squadId !== null) {
            return {
                status: Status.ERROR,
                message: `(joinReferrerSquad) User is already in a squad.`
            }
        }

        // check if the referrer has a squad. if not, return an error.
        if (referrer.inGameData.squadId === null) {
            return {
                status: Status.ERROR,
                message: `(joinReferrerSquad) Referrer does not have a squad.`
            }
        }

        // check if the referrer's squad is full. if so, return an error.
        const squad = await SquadModel.findOne({ _id: referrer.inGameData.squadId });

        if (!squad) {
            return {
                status: Status.ERROR,
                message: `(joinReferrerSquad) Squad not found.`
            }
        }

        if (squad.members.length >= squad.maxMembers) {
            return {
                status: Status.ERROR,
                message: `(joinReferrerSquad) Referrer's squad is already full.`
            }
        }

        // add the user to the referrer's squad.
        await SquadModel.updateOne({ _id: squad._id }, {
            $push: {
                members: {
                    userId: user._id,
                    role: SquadRole.MEMBER,
                    joinedTimestamp: Math.floor(Date.now() / 1000),
                    roleUpdatedTimestamp: Math.floor(Date.now() / 1000)
                }
            }
        });

        // update the user's squad ID.
        await UserModel.updateOne({ _id: user._id }, {
            'inGameData.squadId': squad._id
        });

        return {
            status: Status.SUCCESS,
            message: `(joinReferrerSquad) Joined referrer's squad successfully.`,
            data: {
                squadId: squad._id
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(joinReferrerSquad) ${err.message}`
        }
    }
}

/**
 * Renames a squad with the new name. Only callable by a squad leader.
 */
export const renameSquad = async (twitterId: string, newSquadName: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(renameSquad) User not found.`
            }
        }

        // check if the user is a squad leader.
        const squad = await SquadModel.findOne({ _id: user.inGameData.squadId });

        if (!squad) {
            return {
                status: Status.ERROR,
                message: `(renameSquad) Squad not found.`
            }
        }

        if (squad.members.find(member => member.userId === user._id)?.role !== SquadRole.LEADER) {
            return {
                status: Status.ERROR,
                message: `(renameSquad) User is not a squad leader for the given squad.`
            }
        }

        // update the squad name.
        // rules:
        // 1. squad name can only be up to 20 characters long.
        // 2. squad name cannot be empty.
        // 3. squad name cannot be the same as the current name.
        // 4. squad name cannot contain any special characters except `_` and `.`.
        if (newSquadName.length > 20) {
            return {
                status: Status.ERROR,
                message: `(renameSquad) Squad name is too long.`
            }
        }

        if (newSquadName.trim().length === 0) {
            return {
                status: Status.ERROR,
                message: `(renameSquad) Squad name cannot be empty.`
            }
        }

        if (newSquadName === squad.name) {
            return {
                status: Status.ERROR,
                message: `(renameSquad) Squad name is the same as the current name.`
            }
        }

        if (!newSquadName.match(/^[a-zA-Z0-9_.]+$/)) {
            return {
                status: Status.ERROR,
                message: `(renameSquad) Squad name contains invalid characters.`
            }
        }

        await SquadModel.updateOne({ _id: squad._id }, {
            name: newSquadName
        });

        return {
            status: Status.SUCCESS,
            message: `(renameSquad) Renamed squad successfully.`,
            data: {
                squadId: squad._id,
                squadName: newSquadName
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(renameSquad) ${err.message}`
        }
    }
}

/**
 * Creates a squad.
 */
export const createSquad = async (twitterId: string, squadName: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(createSquad) User not found.`
            }
        }

        // check if the user is already in a squad.
        if (user.inGameData.squadId !== null) {
            return {
                status: Status.ERROR,
                message: `(createSquad) User is already in a squad.`
            }
        }

        // check if the squadName meets the following:
        // 1. squad name can only be up to 20 characters long.
        // 2. squad name cannot be empty.
        // 3. squad name cannot contain any special characters except `_` and `.`.
        if (squadName.length > 20) {
            return {
                status: Status.ERROR,
                message: `(createSquad) Squad name is too long.`
            }
        }

        if (squadName.trim().length === 0) {
            return {
                status: Status.ERROR,
                message: `(createSquad) Squad name cannot be empty.`
            }
        }

        if (!squadName.match(/^[a-zA-Z0-9_.]+$/)) {
            return {
                status: Status.ERROR,
                message: `(createSquad) Squad name contains invalid characters.`
            }
        }

        // create the squad.
        const squad = new SquadModel({
            name: squadName,
            members: [{
                userId: user._id,
                role: SquadRole.LEADER,
                joinedTimestamp: Math.floor(Date.now() / 1000),
                roleUpdatedTimestamp: Math.floor(Date.now() / 1000)
            }],
            // all new squads have a max of 10 members.
            maxMembers: INITIAL_MAX_MEMBERS,
            formedTimestamp: Math.floor(Date.now() / 1000)
        });

        await squad.save();

        // update the user's squad ID.
        await UserModel.updateOne({ _id: user._id }, {
            'inGameData.squadId': squad._id
        });

        return {
            status: Status.SUCCESS,
            message: `(createSquad) Created squad successfully.`,
            data: {
                squadId: squad._id
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(createSquad) ${err.message}`
        }
    }
}