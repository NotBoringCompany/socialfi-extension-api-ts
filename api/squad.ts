import { SquadRole } from '../models/squad';
import { SquadModel, UserModel } from '../utils/constants/db';
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
            UserModel.findOne({ twitterId: userTwitterId }),
            UserModel.findOne({ twitterId: referrerTwitterId })
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
                    userId: user.id,
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