import { SquadCreationMethod, SquadRole } from '../models/squad';
import { SquadModel, UserModel } from '../utils/constants/db';
import { CREATE_SQUAD_COST, INITIAL_MAX_MEMBERS, MAX_MEMBERS_LIMIT, NEXT_MAX_MEMBERS, SQUAD_MAX_MEMBERS_UPGRADE_COST } from '../utils/constants/squad';
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

        // check if the user linked a starter code.
        // starter codes allow users to create a squad for free ONCE.
        const hasStarterCodeLinked = user.inviteCodeData.usedStarterCode !== null;
        let hasCreatedFreeSquad: boolean = false;
        let creationMethod: SquadCreationMethod;

        // if `hasStarterCodeLinked` is true, check if the user has already created a squad with the starter code.
        if (hasStarterCodeLinked) {
            // find at least one squad where `formedBy` is the user's ID and `creationMethod` is `FREE_STARTER_CODE`.
            const freeSquad = await SquadModel.findOne({
                formedBy: user._id,
                creationMethod: SquadCreationMethod.FREE_STARTER_CODE
            });

            if (freeSquad) {
                hasCreatedFreeSquad = true;
            }
        }

        creationMethod = hasStarterCodeLinked && !hasCreatedFreeSquad ? SquadCreationMethod.FREE_STARTER_CODE : SquadCreationMethod.X_COOKIES;

        // check the cost in xCookies to create a squad.
        const cost = creationMethod === SquadCreationMethod.FREE_STARTER_CODE ? 0 : CREATE_SQUAD_COST;

        // check if the user has enough xCookies to create a squad. ONLY if the creation method is `xCookies`.
        if (cost > 0 && user.inGameData.xCookieData.currentXCookies < cost) {
            return {
                status: Status.ERROR,
                message: `(createSquad) User does not have enough xCookies to create a squad.`
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
            formedTimestamp: Math.floor(Date.now() / 1000),
            formedBy: user._id,
            creationMethod,
            squadPointsData: {
                /// TO DO!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
            }
        });

        await squad.save();

        // update the user's squad ID. if the cost is above 0, deduct the cost from the user's xCookies, else no need to do anything else.
        await UserModel.updateOne({ _id: user._id }, {
            'inGameData.squadId': squad._id,
            $inc: {
                // if cost is 0, then this essentially does nothing.
                'inGameData.xCookieData.currentXCookies': -cost
            }
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

/**
 * Leaves the current squad.
 */
export const leaveSquad = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(leaveSquad) User not found.`
            }
        }

        // check if the user is in a squad.
        if (user.inGameData.squadId === null) {
            return {
                status: Status.ERROR,
                message: `(leaveSquad) User is not in a squad.`
            }
        }

        // check if the user is a squad leader.
        const squad = await SquadModel.findOne({ _id: user.inGameData.squadId });

        if (!squad) {
            return {
                status: Status.ERROR,
                message: `(leaveSquad) Squad not found.`
            }
        }

        // if the user is a squad leader, do the following:
        // 1. check if the user is the only member in the squad. if so, disband the squad.
        // 2. if there are other members, check if there is at least 1 other leader in the squad. if not, promote the member with the longest tenure to leader.
        if (squad.members.find(member => member.userId === user._id)?.role === SquadRole.LEADER) {
            if (squad.members.length === 1) {
                // disband the squad by removing the member from the squad (leaving the squad memberless)
                await SquadModel.updateOne({ _id: squad._id }, {
                    $pull: {
                        members: {
                            userId: user._id
                        }
                    }
                })

                // update the user's squad ID.
                await UserModel.updateOne({ _id: user._id }, {
                    'inGameData.squadId': null
                });

                return {
                    status: Status.SUCCESS,
                    message: `(leaveSquad) Disbanded squad successfully.`
                }
            } else {
                const otherLeaders = squad.members.filter(member => member.role === SquadRole.LEADER);

                if (otherLeaders.length === 0) {
                    const memberWithLongestTenure = squad.members.reduce((prev, current) => {
                        return (prev.joinedTimestamp < current.joinedTimestamp) ? prev : current;
                    });

                    // promote the member with the longest tenure to leader.
                    // remove the user-to-leave from the squad.
                    const memberWithLongestTenureIndex = squad.members.findIndex(member => member.userId === memberWithLongestTenure.userId);

                    await SquadModel.updateOne({ _id: squad._id }, {
                        $set: {
                            [`members.${memberWithLongestTenureIndex}.role`]: SquadRole.LEADER,
                            [`members.${memberWithLongestTenureIndex}.roleUpdatedTimestamp`]: Math.floor(Date.now() / 1000)
                        },
                        $pull: {
                            members: {
                                userId: user._id
                            }
                        }
                    });

                    // update the user's squad ID.
                    await UserModel.updateOne({ _id: user._id }, {
                        'inGameData.squadId': null
                    });

                    return {
                        status: Status.SUCCESS,
                        message: `(leaveSquad) Left squad. Promoted member ${memberWithLongestTenure._id} to leader successfully.`
                    }
                }
            }
        } else {
            // if the user is not a squad leader, just remove them from the squad.
            // we don't need to check if they're the last member in the squad, as they would've been a leader at that point
            // and the `if` block above would've handled that.
            await SquadModel.updateOne({ _id: squad._id }, {
                $pull: {
                    members: {
                        userId: user._id
                    }
                }
            });

            // update the user's squad ID.
            await UserModel.updateOne({ _id: user._id }, {
                'inGameData.squadId': null
            });

            return {
                status: Status.SUCCESS,
                message: `(leaveSquad) Left squad successfully.`
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(leaveSquad) ${err.message}`
        }
    }
}

/**
 * Upgrades the max members limit for a squad. Only callable by a squad leader.
 */
export const upgradeSquadLimit = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(upgradeSquadLimit) User not found.`
            }
        }

        // check if the user is in a squad.
        if (user.inGameData.squadId === null) {
            return {
                status: Status.ERROR,
                message: `(upgradeSquadLimit) User is not in a squad.`
            }
        }

        // check if the user is a squad leader.
        const squad = await SquadModel.findOne({ _id: user.inGameData.squadId }).lean();

        if (!squad) {
            return {
                status: Status.ERROR,
                message: `(upgradeSquadLimit) Squad not found.`
            }
        }

        if (squad.members.find(member => member.userId === user._id)?.role !== SquadRole.LEADER) {
            return {
                status: Status.ERROR,
                message: `(upgradeSquadLimit) User is not a squad leader for the given squad.`
            }
        }

        // check if the squad has reached the max limit.
        if (squad.maxMembers >= MAX_MEMBERS_LIMIT) {
            return {
                status: Status.ERROR,
                message: `(upgradeSquadLimit) Squad has already reached the max members limit.`
            }
        }

        // get the next max members limit.
        const nextMaxMembers = NEXT_MAX_MEMBERS(squad.maxMembers);

        // check the cost in xCookies to upgrade the squad limit.
        const cost = SQUAD_MAX_MEMBERS_UPGRADE_COST(nextMaxMembers);

        // check if the user has enough xCookies to upgrade the squad limit.
        if (user.inGameData.xCookieData.currentXCookies < cost) {
            return {
                status: Status.ERROR,
                message: `(upgradeSquadLimit) User does not have enough xCookies to upgrade the squad limit.`
            }
        }

        // upgrade the squad limit.
        await SquadModel.updateOne({ _id: squad._id }, {
            maxMembers: nextMaxMembers
        });

        // deduct the cost from the user's xCookies.
        await UserModel.updateOne({ _id: user._id }, {
            $inc: {
                'inGameData.xCookieData.currentXCookies': -cost
            }
        });

        return {
            status: Status.SUCCESS,
            message: `(upgradeSquadLimit) Upgraded squad limit successfully.`,
            data: {
                squadId: squad._id,
                maxMembers: nextMaxMembers
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(upgradeSquadLimit) ${err.message}`
        }
    }
}