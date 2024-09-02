import { KOSExplicitOwnership } from '../models/kos';
import { Leaderboard, LeaderboardPointsSource } from '../models/leaderboard';
import { PendingSquadMember, SquadCreationMethod, SquadMember, SquadRank, SquadRole } from '../models/squad';
import { UserSecondaryWallet, UserWallet } from '../models/user';
import { LeaderboardModel, SquadLeaderboardModel, SquadModel, UserModel } from '../utils/constants/db';
import { CREATE_SQUAD_COST, INITIAL_MAX_MEMBERS, MAX_CO_LEADERS_LIMIT, MAX_MEMBERS_INCREASE_UPON_UPGRADE, MAX_MEMBERS_LIMIT, RENAME_SQUAD_COOLDOWN, RENAME_SQUAD_COST, SQUAD_LEAVE_COOLDOWN, UPGRADE_SQUAD_MAX_MEMBERS_COST } from '../utils/constants/squad';
import { generateObjectId } from '../utils/crypto';
import { ReturnValue, Status } from '../utils/retVal';
import { explicitOwnershipsOfKOS, getOwnedKeyIDs } from './kos';

/**
 * Adds a co-leader into the squad. Only callable by a squad leader.
 */
export const addCoLeader = async (leaderTwitterId: string, newCoLeaderTwitterId: string, newCoLeaderUserId: string = ''): Promise<ReturnValue> => {
    try {
        const [leader, newCoLeader] = await Promise.all([
            UserModel.findOne({ twitterId: leaderTwitterId }).lean(),
            UserModel.findOne({ $or: [{ twitterId: newCoLeaderTwitterId }, { _id: newCoLeaderUserId }] }).lean()
        ]);

        if (!leader) {
            return {
                status: Status.ERROR,
                message: `(addCoLeader) Leader not found.`
            }
        }

        if (!newCoLeader) {
            return {
                status: Status.ERROR,
                message: `(addCoLeader) New co-leader not found.`
            }
        }

        // check if the leader is in a squad.
        if (leader.inGameData.squadId === null) {
            return {
                status: Status.ERROR,
                message: `(addCoLeader) Leader is not in a squad.`
            }
        }

        // check if the leader is a squad leader.
        const squad = await SquadModel.findOne({ _id: leader.inGameData.squadId });

        if (!squad) {
            return {
                status: Status.ERROR,
                message: `(addCoLeader) Squad not found.`
            }
        }

        if (squad.members.find(member => member.userId === leader._id)?.role !== SquadRole.LEADER) {
            return {
                status: Status.ERROR,
                message: `(addCoLeader) User is not a squad leader for the given squad.`
            }
        }

        // check if the new leader is in the squad.
        if (!squad.members.find(member => member.userId === newCoLeader._id)) {
            return {
                status: Status.ERROR,
                message: `(addCoLeader) New co-leader is not in the squad.`
            }
        }

        // check if the new leader is already a co-leader (or a leader) in the current squad.
        if (
            squad.members.find(member => member.userId === newCoLeader._id)?.role === SquadRole.LEADER ||
            squad.members.find(member => member.userId === newCoLeader._id)?.role === SquadRole.CO_LEADER
        ) {
            return {
                status: Status.ERROR,
                message: `(addCoLeader) New co-leader is already a leader/co-leader in the squad.`
            }
        }

        // check if there are already the max amount of leaders allowed in the squad.
        const coLeaderCount = squad.members.filter(member => member.role === SquadRole.CO_LEADER).length;

        if (coLeaderCount >= MAX_CO_LEADERS_LIMIT) {
            return {
                status: Status.ERROR,
                message: `(addCoLeader) Squad has reached the max leaders limit.`
            }
        }

        // update the role of the new leader.
        const newLeaderIndex = squad.members.findIndex(member => member.userId === newCoLeader._id);

        await SquadModel.updateOne({ _id: squad._id }, {
            $set: {
                [`members.${newLeaderIndex}.role`]: SquadRole.CO_LEADER,
                [`members.${newLeaderIndex}.roleUpdatedTimestamp`]: Math.floor(Date.now() / 1000)
            }
        });

        return {
            status: Status.SUCCESS,
            message: `(addCoLeader) Added new leader successfully.`,
            data: {
                squadId: squad._id,
                newCoLeaderId: newCoLeader._id
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(addCoLeader) ${err.message}`
        }
    }
}

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
        if (!user.inGameData.squadId) {
            return {
                status: Status.ERROR,
                message: `(joinReferrerSquad) User is already in a squad.`
            }
        }

        // check if the referrer has a squad. if not, return an error.
        if (!referrer.inGameData.squadId) {
            return {
                status: Status.ERROR,
                message: `(joinReferrerSquad) Referrer does not have a squad.`
            }
        }

        // check if the referrer's squad is full. if so, return an error.
        const squad = await SquadModel.findOne({ _id: referrer.inGameData.squadId ?? '' });

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
                    username: user.twitterUsername,
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
 * Requests to join a squad given its ID or name.
 */
export const requestToJoinSquad = async (twitterId: string, squadId?: string, squadName?: string): Promise<ReturnValue> => {
    try {
        if (!squadId && !squadName) {
            return {
                status: Status.ERROR,
                message: `(requestToJoinSquad) Invalid squad ID or name.`
            }
        }

        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(requestToJoinSquad) User not found.`
            }
        }

        // check if the user is already in a squad.
        if (user.inGameData.squadId !== null) {
            return {
                status: Status.ERROR,
                message: `(requestToJoinSquad) User is already in a squad.`
            }
        }

        // check if the user is still under the squad leave cooldown.
        const currentTimestamp = Math.floor(Date.now() / 1000);

        if (user.inGameData.lastLeftSquad + SQUAD_LEAVE_COOLDOWN > currentTimestamp) {
            return {
                status: Status.ERROR,
                message: `(requestToJoinSquad) User is still under the squad leave cooldown.`
            }
        }

        // check if the squad exists.
        const squad = await SquadModel.findOne({ $or: [{ _id: squadId }, { name: squadName }] });

        if (!squad) {
            return {
                status: Status.ERROR,
                message: `(requestToJoinSquad) Squad not found.`
            }
        }

        // check if the squad is full.
        if (squad.members.length >= squad.maxMembers) {
            return {
                status: Status.ERROR,
                message: `(requestToJoinSquad) Squad is already full.`
            }
        }

        // check if the user has already requested to join the squad.
        if (squad.pendingMembers.find(member => member.userId === user._id)) {
            return {
                status: Status.ERROR,
                message: `(requestToJoinSquad) User has already requested to join the squad.`
            }
        }

        // add the user to the pending members list.
        await SquadModel.updateOne({ _id: squad._id }, {
            $push: {
                pendingMembers: {
                    userId: user._id,
                    username: user.twitterUsername,
                    requestedTimestamp: Math.floor(Date.now() / 1000)
                }
            }
        });

        return {
            status: Status.SUCCESS,
            message: `(requestToJoinSquad) Requested to join squad successfully.`,
            data: {
                squadId: squad._id
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(requestToJoinSquad) ${err.message}`
        }
    }
}

/**
 * Accepts a pending squad member into the squad. Only callable by a squad leader.
 */
export const acceptPendingSquadMember = async (leaderTwitterId: string, memberTwitterId: string = '', memberUserId: string = ''): Promise<ReturnValue> => {
    try {
        const [leader, member] = await Promise.all([
            UserModel.findOne({ twitterId: leaderTwitterId }).lean(),
            UserModel.findOne({ $or: [{ twitterId: memberTwitterId }, { _id: memberUserId }] }).lean()
        ]);

        if (!leader) {
            return {
                status: Status.ERROR,
                message: `(acceptPendingSquadMember) Leader not found.`
            }
        }

        if (!member) {
            return {
                status: Status.ERROR,
                message: `(acceptPendingSquadMember) Member not found.`
            }
        }

        // check if the leader is in a squad.
        if (leader.inGameData.squadId === null) {
            return {
                status: Status.ERROR,
                message: `(acceptPendingSquadMember) Leader is not in a squad.`
            }
        }

        // check if the leader is a squad leader.
        const squad = await SquadModel.findOne({ _id: leader.inGameData.squadId });

        if (!squad) {
            return {
                status: Status.ERROR,
                message: `(acceptPendingSquadMember) Squad not found.`
            }
        }

        if (
            squad.members.find(member => member.userId === leader._id)?.role !== SquadRole.LEADER &&
            squad.members.find(member => member.userId === leader._id)?.role !== SquadRole.CO_LEADER
        ) {
            return {
                status: Status.ERROR,
                message: `(acceptPendingSquadMember) User is not a squad leader for the given squad.`
            }
        }

        // check if the member is in the pending members list.
        if (!squad.pendingMembers.find(pendingMember => pendingMember.userId === member._id)) {
            return {
                status: Status.ERROR,
                message: `(acceptPendingSquadMember) Member is not in the pending members list.`
            }
        }

        // check if the member is already in a different squad.
        if (member.inGameData.squadId !== null) {
            // if they are already in a different squad, remove them from this squad's pending members list.
            await SquadModel.updateOne({ _id: squad._id }, {
                $pull: {
                    pendingMembers: {
                        userId: member._id
                    }
                }
            });

            return {
                status: Status.ERROR,
                message: `(acceptPendingSquadMember) Member is already in a different squad.`
            }
        }

        // check if the member is already in the squad.
        if (squad.members.find(squadMember => squadMember.userId === member._id)) {
            return {
                status: Status.ERROR,
                message: `(acceptPendingSquadMember) Member is already in the squad.`
            }
        }

        // check if the squad is full.
        if (squad.members.length >= squad.maxMembers) {
            return {
                status: Status.ERROR,
                message: `(acceptPendingSquadMember) Squad is already full.`
            }
        }

        // add the member to the squad.
        await SquadModel.updateOne({ _id: squad._id }, {
            $push: {
                members: {
                    userId: member._id,
                    username: member.twitterUsername,
                    role: SquadRole.MEMBER,
                    joinedTimestamp: Math.floor(Date.now() / 1000),
                    roleUpdatedTimestamp: Math.floor(Date.now() / 1000)
                }
            },
            $pull: {
                pendingMembers: {
                    userId: member._id
                }
            }
        });

        // update the member's squad ID.
        await UserModel.updateOne({ _id: member._id }, {
            'inGameData.squadId': squad._id
        });

        return {
            status: Status.SUCCESS,
            message: `(acceptPendingSquadMember) Accepted pending squad member successfully.`,
            data: {
                memberTwitterId,
                memberUserId,
                currentMembers: squad.members.length,
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(acceptPendingSquadMember) ${err.message}`
        }
    }
}

/**
 * Declines a pending squad member from joining the squad. Only callable by a squad leader.
 */
export const declinePendingSquadMember = async (leaderTwitterId: string, memberTwitterId: string = '', memberUserId: string = ''): Promise<ReturnValue> => {
    try {
        const [leader, member] = await Promise.all([
            UserModel.findOne({ twitterId: leaderTwitterId }).lean(),
            UserModel.findOne({ $or: [{ twitterId: memberTwitterId }, { _id: memberUserId }] }).lean()
        ]);

        if (!leader) {
            return {
                status: Status.ERROR,
                message: `(declinePendingSquadMember) Leader not found.`
            }
        }

        if (!member) {
            return {
                status: Status.ERROR,
                message: `(declinePendingSquadMember) Member not found.`
            }
        }

        // check if the leader is in a squad.
        if (leader.inGameData.squadId === null) {
            return {
                status: Status.ERROR,
                message: `(declinePendingSquadMember) Leader is not in a squad.`
            }
        }

        // check if the leader is a squad leader.
        const squad = await SquadModel.findOne({ _id: leader.inGameData.squadId });

        if (!squad) {
            return {
                status: Status.ERROR,
                message: `(declinePendingSquadMember) Squad not found.`
            }
        }

        if (
            squad.members.find(member => member.userId === leader._id)?.role !== SquadRole.LEADER &&
            squad.members.find(member => member.userId === leader._id)?.role !== SquadRole.CO_LEADER
        ) {
            return {
                status: Status.ERROR,
                message: `(declinePendingSquadMember) User is not a squad leader or co-leader for the given squad.`
            }
        }

        // check if the member is in the pending members list.
        if (!squad.pendingMembers.find(pendingMember => pendingMember.userId === member._id)) {
            return {
                status: Status.ERROR,
                message: `(declinePendingSquadMember) Member is not in the pending members list.`
            }
        }

        // remove the member from the pending members list.
        await SquadModel.updateOne({ _id: squad._id }, {
            $pull: {
                pendingMembers: {
                    userId: member._id
                }
            }
        });

        return {
            status: Status.SUCCESS,
            message: `(declinePendingSquadMember) Declined pending squad member successfully.`
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(declinePendingSquadMember) ${err.message}`
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

        if (
            squad.members.find(member => member.userId === user._id)?.role !== SquadRole.LEADER &&
            squad.members.find(member => member.userId === user._id)?.role !== SquadRole.CO_LEADER
        ) {
            return {
                status: Status.ERROR,
                message: `(renameSquad) User is not a squad leader or co-leader for the given squad.`
            }
        }

        // check the last name change timestamp.
        const currentTimestamp = Math.floor(Date.now() / 1000);

        if (squad.lastNameChangeTimestamp + RENAME_SQUAD_COOLDOWN > currentTimestamp) {
            return {
                status: Status.ERROR,
                message: `(renameSquad) Cannot rename squad name for another ${currentTimestamp - (squad.lastNameChangeTimestamp + RENAME_SQUAD_COOLDOWN)} seconds.`
            }
        }

        // calculate the cost in xCookies to rename the squad. if it's the first time, it's free.
        const cost = squad.nameChangeCount === 0 ? 0 : RENAME_SQUAD_COST;

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

        // update the squad name and increment the name change count and last name change timestamp.
        await SquadModel.updateOne({ _id: squad._id }, {
            name: newSquadName,
            $inc: {
                nameChangeCount: 1
            },
            lastNameChangeTimestamp: currentTimestamp
        });

        // rename the squad name on the leaderboard
        await SquadLeaderboardModel.updateMany(
            { 'pointsData.squadId': squad._id },
            { $set: { 'pointsData.$[elem].squadName': newSquadName } },
            { arrayFilters: [{ 'elem.squadId': squad._id }] }
        );

        // deduct the cost from the user's xCookies and update `totalXCookiesSpent` and `weeklyXCookiesSpent`
        await UserModel.updateOne({ _id: user._id }, {
            $inc: {
                'inventory.xCookieData.currentXCookies': -cost,
                'inventory.xCookieData.totalXCookiesSpent': cost,
                'inventory.xCookieData.weeklyXCookiesSpent': cost
            }
        });

        return {
            status: Status.SUCCESS,
            message: `(renameSquad) Renamed squad successfully.`,
            data: {
                squadId: squad._id,
                squadName: newSquadName,
                totalPaid: cost,
                paymentChoice: 'xCookies',
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
 * Checks the creation method and cost to create a squad.
 */
export const checkSquadCreationMethodAndCost = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(checkSquadCreationCost) User not found.`
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

        return {
            status: Status.SUCCESS,
            message: `(checkSquadCreationCost) Checked squad creation cost successfully.`,
            data: {
                creationMethod,
                cost
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(checkSquadCreationCost) ${err.message}`
        }
    }
}

/**
 * Creates a squad.
 * 
 * Note that the leaving cooldown doesn't apply when creating a squad.
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

        // check if the user is still under the squad leave cooldown.
        const currentTimestamp = Math.floor(Date.now() / 1000);

        if (user.inGameData.lastLeftSquad + SQUAD_LEAVE_COOLDOWN > currentTimestamp) {
            return {
                status: Status.ERROR,
                message: `(requestToJoinSquad) User is still under the squad leave cooldown.`
            }
        }

        // check if the squad name already exists.
        const existingSquad = await SquadModel.findOne({ name: squadName });

        if (existingSquad) {
            return {
                status: Status.ERROR,
                message: `(createSquad) Squad name already exists.`
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

        // get the cost for creating a squad.
        const { status, message, data } = await checkSquadCreationMethodAndCost(twitterId);

        if (status !== Status.SUCCESS) {
            return {
                status,
                message: `(createSquad) Error from checkSquadCreationMethodAndCost: ${message}`
            }
        }

        const creationMethod: SquadCreationMethod = data?.creationMethod;
        const cost: number = data?.cost;

        // check if the user has enough xCookies to create a squad. ONLY if the creation method is `xCookies`.
        if (cost > 0 && user.inventory.xCookieData.currentXCookies < cost) {
            return {
                status: Status.ERROR,
                message: `(createSquad) User does not have enough xCookies to create a squad.`
            }
        }

        // create the squad.
        const squad = new SquadModel({
            _id: generateObjectId(),
            name: squadName,
            nameChangeCount: 0,
            lastNameChangeTimestamp: Math.floor(Date.now() / 1000),
            members: [{
                userId: user._id,
                username: user.twitterUsername,
                role: SquadRole.LEADER,
                joinedTimestamp: Math.floor(Date.now() / 1000),
                roleUpdatedTimestamp: Math.floor(Date.now() / 1000)
            }],
            pendingMembers: [],
            // all new squads have a max of 10 members.
            maxMembers: INITIAL_MAX_MEMBERS,
            formedTimestamp: Math.floor(Date.now() / 1000),
            formedBy: user._id,
            creationMethod,
            totalSquadPoints: 0,
            squadRankingData: []
        });

        await squad.save();

        // update the user's squad ID. if the cost is above 0, deduct the cost from the user's xCookies, else no need to do anything else.
        await UserModel.updateOne({ _id: user._id }, {
            'inGameData.squadId': squad._id,
            $inc: {
                // if cost is 0, then this essentially does nothing.
                // also increment `totalXCookiesSpent` and `weeklyXCookiesSpent`.
                'inventory.xCookieData.currentXCookies': -cost,
                'inventory.xCookieData.totalXCookiesSpent': cost,
                'inventory.xCookieData.weeklyXCookiesSpent': cost
            }
        });

        return {
            status: Status.SUCCESS,
            message: `(createSquad) Created squad successfully.`,
            data: {
                squadId: squad._id,
                squadName,
                totalPaid: cost,
                paymentChoice: 'xCookies',
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
        // 2. if there are other members in the squad and there are also other leaders, then just leave as is.
        // 3. if there are other members in the squad and the user is the only leader, check the following:
        // 4a. if there are co-leaders, select the co-leader with the longest tenure to be the new leader.
        // 4b. if there are no co-leaders, assign the member with the longest tenure to be the new leader.
        if (squad.members.find(member => member.userId === user._id)?.role === SquadRole.LEADER) {
            if (squad.members.length === 1) {
                // disband the squad by removing the member from the squad (leaving the squad memberless)
                await SquadModel.updateOne({ _id: squad._id }, {
                    $pull: {
                        members: {
                            userId: user._id,
                        }
                    }
                })

                // update the user's squad ID and `lastLeftSquad` timestamp.
                await UserModel.updateOne({ _id: user._id }, {
                    'inGameData.squadId': null,
                    'inGameData.lastLeftSquad': Math.floor(Date.now() / 1000)

                });

                return {
                    status: Status.SUCCESS,
                    message: `(leaveSquad) Disbanded squad successfully.`,
                    data: {
                        currentMembers: 0,
                    }
                }
            } else {
                // check if there are other leaders in the squad.
                // if there are, just remove the user from the squad.
                // if there aren't, promote the member with the longest tenure to leader.
                // `leaderCount` should NOT include the user.
                const leaderCount = squad.members.filter(member => member.role === SquadRole.LEADER && member.userId !== user._id).length;

                if (leaderCount === 0) {
                    // if no other leaders, firstly:
                    // check if there are co-leaders. if there are, find the co-leader with the longest tenure.
                    // we will promote this member to leader.
                    // if there are no co-leaders, promote the member with the longest tenure to leader.
                    // if the member with the longest tenure is the leader (i.e. the user), then promote the next member with the longest tenure.
                    const coLeaders = squad.members.filter(member => member.userId !== user._id && member.role === SquadRole.CO_LEADER);
                    const members = squad.members.filter(member => member.userId !== user._id);

                    let memberWithLongestTenure = coLeaders.length > 0 ?
                        coLeaders.reduce((prev, current) => (prev.joinedTimestamp < current.joinedTimestamp ? prev : current)) :
                        members.reduce((prev, current) => (prev.joinedTimestamp < current.joinedTimestamp ? prev : current));

                    // promote the co-leader/member found in `memberWithLongestTenure` to leader.
                    // remove the user-to-leave from the squad.
                    const memberWithLongestTenureIndex = squad.members.findIndex(member => member.userId === memberWithLongestTenure.userId);

                    console.log('member with longest tenure index: ', memberWithLongestTenureIndex);

                    // separate `$set` and `$pull` operators to prevent conflicts.
                    await SquadModel.updateOne({ _id: squad._id }, {
                        $set: {
                            [`members.${memberWithLongestTenureIndex}.role`]: SquadRole.LEADER,
                            [`members.${memberWithLongestTenureIndex}.roleUpdatedTimestamp`]: Math.floor(Date.now() / 1000)
                        },
                    }).then(data => console.log('data from updating here: ', data)).catch(err => console.log('error from updating here: ', err));

                    await SquadModel.updateOne({ _id: squad._id }, {
                        $pull: {
                            members: {
                                userId: user._id
                            }
                        }
                    });

                    // update the user's squad ID and `lastLeftSquad` timestamp.
                    await UserModel.updateOne({ _id: user._id }, {
                        'inGameData.squadId': null,
                        'inGameData.lastLeftSquad': Math.floor(Date.now() / 1000)

                    });

                    return {
                        status: Status.SUCCESS,
                        message: `(leaveSquad) Left squad. Promoted member ${memberWithLongestTenure._id} to leader successfully.`
                    }
                } else {
                    // if there are other leaders in the squad, just remove the user from the squad.
                    await SquadModel.updateOne({ _id: squad._id }, {
                        $pull: {
                            members: {
                                userId: user._id
                            }
                        }
                    });

                    // update the user's squad ID and `lastLeftSquad` timestamp.
                    await UserModel.updateOne({ _id: user._id }, {
                        'inGameData.squadId': null,
                        'inGameData.lastLeftSquad': Math.floor(Date.now() / 1000)

                    });

                    return {
                        status: Status.SUCCESS,
                        message: `(leaveSquad) Left squad successfully.`,
                        data: {
                            currentMembers: squad.members.length,
                        }
                    }
                }
            }
        } else {
            console.log('member is not leader, meaning they are not the last person');
            // if the user is not a squad leader, just remove them from the squad.
            // we don't need to check if they're the last member in the squad, as they would've been a leader at that point
            // and the `if` block above would've handled that.
            await SquadModel.updateOne({ _id: squad._id }, {
                $pull: {
                    members: {
                        userId: user._id
                    }
                }
            }).catch((err) => console.log('error from updating here: ', err));

            // update the user's squad ID and `lastLeftSquad` timestamp.
            await UserModel.updateOne({ _id: user._id }, {
                'inGameData.squadId': null,
                'inGameData.lastLeftSquad': Math.floor(Date.now() / 1000)

            })

            console.log(`User ${user._id} left the squad ${squad._id}`)

            return {
                status: Status.SUCCESS,
                message: `(leaveSquad) Left squad successfully.`,
                data: {
                    currentMembers: squad.members.length,
                }
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
 * Upgrades the max members limit for a squad. Only callable by a squad leader OR co-leader.
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

        if (
            squad.members.find(member => member.userId === user._id)?.role !== SquadRole.LEADER &&
            squad.members.find(member => member.userId === user._id)?.role !== SquadRole.CO_LEADER
        ) {
            return {
                status: Status.ERROR,
                message: `(upgradeSquadLimit) User is not a squad leader or co-leader for the given squad.`
            }
        }

        // check if the squad has reached the max limit.
        if (squad.maxMembers >= MAX_MEMBERS_LIMIT) {
            return {
                status: Status.ERROR,
                message: `(upgradeSquadLimit) Squad has already reached the max members limit.`
            }
        }

        // check the cost in xCookies to upgrade the squad limit.
        const cost = UPGRADE_SQUAD_MAX_MEMBERS_COST(squad.maxMembers);

        // check if the user has enough xCookies to upgrade the squad limit.
        if (user.inventory.xCookieData.currentXCookies < cost) {
            return {
                status: Status.ERROR,
                message: `(upgradeSquadLimit) User does not have enough xCookies to upgrade the squad limit.`
            }
        }

        // upgrade the squad limit.
        await SquadModel.updateOne({ _id: squad._id }, {
            maxMembers: squad.maxMembers + MAX_MEMBERS_INCREASE_UPON_UPGRADE
        });

        // deduct the cost from the user's xCookies. also increment `totalXCookiesSpent` and `weeklyXCookiesSpent`.
        await UserModel.updateOne({ _id: user._id }, {
            $inc: {
                'inventory.xCookieData.currentXCookies': -cost,
                'inventory.xCookieData.totalXCookiesSpent': cost,
                'inventory.xCookieData.weeklyXCookiesSpent': cost
            }
        });

        return {
            status: Status.SUCCESS,
            message: `(upgradeSquadLimit) Upgraded squad limit successfully.`,
            data: {
                squadId: squad._id,
                newMaxMembers: squad.maxMembers + MAX_MEMBERS_INCREASE_UPON_UPGRADE
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(upgradeSquadLimit) ${err.message}`
        }
    }
}

/**
 * Delegates the leader role to another member in the squad. Only callable by a squad leader.
 */
export const delegateLeadership = async (currentLeaderTwitterId: string, newLeaderTwitterId: string = '', newLeaderUserId: string = ''): Promise<ReturnValue> => {
    try {
        const [currentLeader, newLeader] = await Promise.all([
            UserModel.findOne({ twitterId: currentLeaderTwitterId }).lean(),
            UserModel.findOne({ $or: [{ twitterId: newLeaderTwitterId }, { _id: newLeaderUserId }] }).lean()
        ]);

        if (!currentLeader) {
            return {
                status: Status.ERROR,
                message: `(delegateLeadership) Current leader not found.`
            }
        }

        if (!newLeader) {
            return {
                status: Status.ERROR,
                message: `(delegateLeadership) New leader not found.`
            }
        }

        // check if the current leader is in a squad.
        if (currentLeader.inGameData.squadId === null) {
            return {
                status: Status.ERROR,
                message: `(delegateLeadership) Current leader is not in a squad.`
            }
        }

        // check if the new leader is in the same squad as the current leader.
        if (newLeader.inGameData.squadId !== currentLeader.inGameData.squadId) {
            return {
                status: Status.ERROR,
                message: `(delegateLeadership) New leader is not in the same squad as the current leader.`
            }
        }

        // check if the current leader is a squad leader.
        const squad = await SquadModel.findOne({ _id: currentLeader.inGameData.squadId });

        if (!squad) {
            return {
                status: Status.ERROR,
                message: `(delegateLeadership) Squad not found.`
            }
        }

        if (squad.members.find(member => member.userId === currentLeader._id)?.role !== SquadRole.LEADER) {
            return {
                status: Status.ERROR,
                message: `(delegateLeadership) Current leader is not a squad leader for the given squad.`
            }
        }

        // check if the new leader is a member of the squad.
        if (!squad.members.find(member => member.userId === newLeader._id)) {
            return {
                status: Status.ERROR,
                message: `(delegateLeadership) New leader is not a member of the squad.`
            }
        }

        // update the roles of the current and new leaders.
        const currentLeaderIndex = squad.members.findIndex(member => member.userId === currentLeader._id);
        const newLeaderIndex = squad.members.findIndex(member => member.userId === newLeader._id);

        await SquadModel.updateOne({ _id: squad._id }, {
            $set: {
                [`members.${currentLeaderIndex}.role`]: SquadRole.MEMBER,
                [`members.${currentLeaderIndex}.roleUpdatedTimestamp`]: Math.floor(Date.now() / 1000),
                [`members.${newLeaderIndex}.role`]: SquadRole.LEADER,
                [`members.${newLeaderIndex}.roleUpdatedTimestamp`]: Math.floor(Date.now() / 1000)
            }
        });

        return {
            status: Status.SUCCESS,
            message: `(delegateLeadership) Delegated leadership successfully.`,
            data: {
                squadId: squad._id,
                currentLeaderId: currentLeader._id,
                newLeaderId: newLeader._id
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(delegateLeadership) ${err.message}`
        }
    }
}

/**
 * Kicks a member from the squad.
 * 
 * Leaders can kick co-leaders and members.
 * Co-leaders can only kick members.
 */
export const kickMember = async (leaderTwitterId: string, memberTwitterId: string = '', memberUserId: string = ''): Promise<ReturnValue> => {
    try {
        const [leader, member] = await Promise.all([
            UserModel.findOne({ twitterId: leaderTwitterId }).lean(),
            UserModel.findOne({ $or: [{ twitterId: memberTwitterId }, { _id: memberUserId }] }).lean()
        ]);

        if (!leader) {
            return {
                status: Status.ERROR,
                message: `(kickMember) Leader not found.`
            }
        }

        if (!member) {
            return {
                status: Status.ERROR,
                message: `(kickMember) Member not found.`
            }
        }

        // check if the leader is in a squad.
        if (leader.inGameData.squadId === null) {
            return {
                status: Status.ERROR,
                message: `(kickMember) Leader is not in a squad.`
            }
        }

        // check if the leader is a squad leader.
        const squad = await SquadModel.findOne({ _id: leader.inGameData.squadId });

        if (!squad) {
            return {
                status: Status.ERROR,
                message: `(kickMember) Squad not found.`
            }
        }

        // must be either leader or co-leader
        if (
            squad.members.find(member => member.userId === leader._id)?.role !== SquadRole.LEADER &&
            squad.members.find(member => member.userId === leader._id)?.role !== SquadRole.CO_LEADER
        ) {
            return {
                status: Status.ERROR,
                message: `(kickMember) User is not a squad leader or co-leader for the given squad.`
            }
        }

        // check if the member is in the squad.
        if (!squad.members.find(squadMember => squadMember.userId === member._id)) {
            return {
                status: Status.ERROR,
                message: `(kickMember) Member is not in the squad.`
            }
        }

        // check if the leader is trying to kick themself.
        if (leader._id === member._id) {
            return {
                status: Status.ERROR,
                message: `(kickMember) Cannot kick self.`
            }
        }

        // if user is a co-leader, they can only kick members. if they try to kick the leader or another co-leader, return an error.
        if (squad.members.find(m => m.userId === leader._id)?.role === SquadRole.CO_LEADER) {
            if (
                squad.members.find(m => m.userId === member._id)?.role === SquadRole.LEADER ||
                squad.members.find(m => m.userId === member._id)?.role === SquadRole.CO_LEADER
            ) {
                return {
                    status: Status.ERROR,
                    message: `(kickMember) Co-leaders cannot kick leaders or other co-leaders.`
                }
            }
        }

        // remove the member from the squad.
        await SquadModel.updateOne({ _id: squad._id }, {
            $pull: {
                members: {
                    userId: member._id
                }
            }
        });

        // update the member's squad ID.
        await UserModel.updateOne({ _id: member._id }, {
            'inGameData.squadId': null
        });

        return {
            status: Status.SUCCESS,
            message: `(kickMember) Kicked member successfully.`,
            data: {
                memberTwitterId,
                memberUserId,
                currentMember: squad.members.length - 1,
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(kickMember) ${err.message}`
        }
    }
}

/**
 * Gets the data of a squad given its ID.
 */
export const getSquadData = async (squadId?: string): Promise<ReturnValue> => {
    try {
        const squad = await SquadModel.findOne({ _id: squadId }).lean();

        if (!squad) {
            return {
                status: Status.ERROR,
                message: `(getSquadData) Squad not found.`
            }
        }

        return {
            status: Status.SUCCESS,
            message: `(getSquadData) Got squad data successfully.`,
            data: {
                squad
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getSquadData) ${err.message}`
        }
    }
}

/**
 * Gets the total amount of KOS (Key Of Salvation) owned by the members of the user's squad and also the individual KOS count of each member.
 * 
 * Returns 0 if the user is not in a squad.
 */
export const squadKOSData = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const [users, {status: explicitOwnershipsStatus, data: explicitOwnershipsData}] = await Promise.all([
            UserModel.find().lean(),
            // create an array for ID 1 to 5000 (since that's all the IDs for the keys)
            explicitOwnershipsOfKOS(Array.from({ length: 5000 }, (_, i) => i + 1))
        ])

        if (!users || users.length === 0) {
            return {
                status: Status.ERROR,
                message: `(squadKOSCount) Users not found.`
            }
        }

        // get the user's data
        const user = users.find(user => user.twitterId === twitterId);

        if (!user) {
            console.error(`(squadKOSCount) User not found. twid: ${twitterId}`);

            // Temporary solution for 'User not found' issue even though user twitterId exist in mongodb
            return {
                status: Status.SUCCESS,
                message: `(squadKOSCount) User not found. ${twitterId}`,
                data: {
                    totalSquadKOSCount: 0,
                    individualKOSCounts: []
                }
            }
        }

        // check if the user is in a squad.
        if (user.inGameData.squadId === null) {
            return {
                status: Status.SUCCESS,
                message: `(squadKOSCount) User is not in a squad.`,
                data: {
                    totalSquadKOSCount: 0,
                    individualKOSCounts: []
                }
            }
        }

        // get the explicit ownerships of KOS data from `explicitOwnershipsOfKOS`.
        const { keyOwnerships } = explicitOwnershipsData;

        // get the squad data.
        const squad = await SquadModel.findOne({ _id: user.inGameData.squadId }).lean();

        if (!squad) {
            return {
                status: Status.ERROR,
                message: `(squadKOSCount) Squad not found.`
            }
        }

        // loop through each user and fetch their wallets (main + secondary)
        // then, check if they own any KOS.
        // if they do, increment the total KOS count and add the user's KOS count to the individual KOS counts.
        let totalSquadKOSCount = 0;
        const individualKOSCounts = [];

        for (const member of squad.members) {
            const memberData = users.find(userData => userData._id === member.userId);

            if (!memberData) {
                continue;
            }

            const mainWallet = memberData.wallet as UserWallet;
            const secondaryWallets = memberData.secondaryWallets as UserSecondaryWallet[];

            const walletAddresses = [mainWallet.address.toLowerCase(), ...secondaryWallets?.map(wallet => wallet.address.toLowerCase())?.filter(address => address !== null)];

            let memberKOSCount = 0;

            for (const keyOwnership of keyOwnerships) {
                if (walletAddresses.includes(keyOwnership.owner.toLowerCase())) {
                    memberKOSCount++;
                }
            }

            totalSquadKOSCount += memberKOSCount;

            individualKOSCounts.push({
                userId: member.userId,
                username: member.username,
                kosCount: memberKOSCount
            });
        }

        return {
            status: Status.SUCCESS,
            message: `(squadKOSCount) Got squad KOS count successfully.`,
            data: {
                totalSquadKOSCount,
                individualKOSCounts
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(squadKOSCount) ${err.message}`
        }
    }
}

/**
 * Gets the latest weekly ranking of the user's squad.
 */
export const getLatestSquadWeeklyRanking = async (squadId: string): Promise<ReturnValue> => {
    try {
        const squad = await SquadModel.findOne({ _id: squadId }).lean();

        if (!squad) {
            return {
                status: Status.ERROR,
                message: `(getLatestSquadWeeklyRanking) Squad not found.`
            }
        }

        // get the latest weekly ranking by finding the latest ranking data (i.e. the data with the highest `week` number)
        const latestRankingData = squad.squadRankingData && squad.squadRankingData.length !== 0 ? squad.squadRankingData.reduce((prev, current) => (prev.week > current.week) ? prev : current) : { rank: SquadRank.UNRANKED }

        return {
            status: Status.SUCCESS,
            message: `(getLatestSquadWeeklyRanking) Got latest squad weekly ranking successfully.`,
            data: {
                latestRank: latestRankingData.rank ?? SquadRank.UNRANKED,
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getLatestSquadWeeklyRanking) ${err.message}`
        }
    }
}

/**
 * Fetches a squad's member data. Includes all current and pending members of the squad.
 */
export const getSquadMemberData = async (squadId: string): Promise<ReturnValue> => {
    try {
        const squad = await SquadModel.findOne({ _id: squadId }).lean();

        if (!squad) {
            return {
                status: Status.ERROR,
                message: `(getSquadMemberData) Squad not found.`
            }
        }

        const [leaderboards, ownershipResponse] = await Promise.all([
            // fetch all leaderboards
            LeaderboardModel.find().lean(),
            // fetch all explicit ownerships of KOS.
            // ID from 1 to 5000
            explicitOwnershipsOfKOS(Array.from({ length: 5000 }, (_, i) => i + 1))
        ]);

        const explicitOwnerships = ownershipResponse.data?.keyOwnerships ?? [];

        // Check if ownership fetch was successful
        if (ownershipResponse.status !== Status.SUCCESS) {
            return {
                status: ownershipResponse.status,
                message: `(getPendingSquadMemberData) Error from explicitOwnershipsOfKOS: ${ownershipResponse.message}`
            };
        }

        // get the latest leaderboard
        const latestLeaderboard = leaderboards[leaderboards.length - 1];

        // preprocess leaderboard data to get the total points of each user.
        const leaderboardPointsMap = new Map(latestLeaderboard.userData.map(user => {
            const totalPoints = user.pointsData?.filter(pointsData => pointsData.source !== LeaderboardPointsSource.LEVELLING_UP).reduce((prev, current) => prev + current.points, 0) ?? 0;
            return [user.userId, { totalPoints, rank: 0 }];
        }));

        // sort the latest leaderboard based on points to determine ranking.
        const sortedLeaderboardUserData = Array.from(leaderboardPointsMap.entries()).sort((a, b) => b[1].totalPoints - a[1].totalPoints);

        // assign ranking to each user.
        sortedLeaderboardUserData.forEach((entry, index) => {
            leaderboardPointsMap.get(entry[0]).rank = index + 1;
        });

        // map all user IDs of the squad members and pending members.
        const userIds = [...squad.members, ...squad.pendingMembers].map(member => member.userId);
        const userData = await UserModel.find({ _id: { $in: userIds } }).lean();

        const getUserData = (userId: string) => {
            return userData.find(user => user._id === userId);
        }

        const getMemberData = (member: any, isPending: boolean) => {
            const memberData = getUserData(member.userId);

            if (!memberData) {
                console.log(`(getSquadMemberData) Member data not found for user ID: ${member.userId}`);
                return null;
            }

            const inGameLevel = memberData.inGameData?.level ?? 1;
            const leaderboardData = leaderboardPointsMap.get(member.userId) || { totalPoints: 0, rank: 0 };
            const walletAddresses = [memberData.wallet?.address, ...(memberData.secondaryWallets?.map(wallet => wallet.address) || [])].filter(Boolean).map(address => address.toLowerCase());

            const kosCount = explicitOwnerships.filter((ownership: KOSExplicitOwnership) => walletAddresses.includes(ownership.owner.toLowerCase())).length;

            const baseData = {
                userId: member.userId,
                username: memberData.twitterUsername,
                profilePicture: memberData.twitterProfilePicture,
                inGameLevel,
                totalPoints: leaderboardData.totalPoints,
                currentSeasonRank: leaderboardData.rank,
                kosCount
            };

            return isPending ? baseData : { ...baseData, role: member.role };
        }

        const currentMemberData = (squad.members as SquadMember[]).map(member => getMemberData(member, false)).filter(Boolean);
        const pendingMemberData = (squad.pendingMembers as PendingSquadMember[]).map(member => getMemberData(member, true)).filter(Boolean);

        return {
            status: Status.SUCCESS,
            message: `(getSquadMemberData) Got squad member data successfully.`,
            data: {
                currentMembers: currentMemberData,
                pendingMembers: pendingMemberData
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getSquadMemberData) ${err.message}`
        }
    }
}