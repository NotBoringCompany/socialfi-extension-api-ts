import { ReturnValue, Status } from '../utils/retVal';
import { generateObjectId } from '../utils/crypto';
import { CollabModel, UserModel } from '../utils/constants/db';
import { Collab, CollabReward, CollabRewardType, Group, Participant } from '../models/collab';
import { readSheetObject } from '../utils/sheet';
import { Item } from '../models/item';
import { ExtendedXCookieData, XCookieSource } from '../models/user';

/**
 * Adds a collab to the database.
 */
export const addCollab = async (data: Partial<Collab>): Promise<ReturnValue> => {
    try {
        const newCollab = new CollabModel({
            _id: generateObjectId(),
            ...data,
        });

        await newCollab.save();

        return {
            status: Status.SUCCESS,
            message: `(addCollab) collab added.`,
            data: {
                collab: newCollab,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(addCollab) ${err.message}`,
        };
    }
};

/**
 * Fetches all collabs from the database.
 */
export const getCollabs = async (type: 'kol' | 'group'): Promise<ReturnValue> => {
    try {
        const collabs = await CollabModel.find({ type }).lean();

        if (collabs.length === 0 || !collabs) {
            return {
                status: Status.ERROR,
                message: `(getCollabs) No ${type} collabs found.`,
            };
        }

        return {
            status: Status.SUCCESS,
            message: `(getCollabs) ${type} collabs fetched.`,
            data: {
                collabs,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getCollabs) ${err.message}`,
        };
    }
};

/**
 * Deletes a collab from the database.
 */
export const deleteCollab = async (id: string): Promise<ReturnValue> => {
    try {
        const collab = await CollabModel.findOne({ _id: id }).lean();

        if (!collab) {
            return {
                status: Status.ERROR,
                message: `(deleteCollab) collab not found. Collab ID: ${id}`,
            };
        }

        await CollabModel.deleteOne({ _id: id });

        return {
            status: Status.SUCCESS,
            message: `(deleteCollab) collab deleted.`,
            data: {
                id,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(deleteCollab) ${err.message}`,
        };
    }
};

/**
 * Fetches a collab by ID from the database.
 */
export const getCollabById = async (id: string): Promise<ReturnValue> => {
    try {
        const collab = await CollabModel.findOne({ _id: id }).lean();

        if (!collab) {
            return {
                status: Status.ERROR,
                message: `(getCollabById) collab not found. Collab ID: ${id}`,
            };
        }

        return {
            status: Status.SUCCESS,
            message: `(getCollabById) collab fetched.`,
            data: {
                collab,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getCollabById) ${err.message}`,
        };
    }
};

/**
 * Updates a collab in the database.
 */
export const updateCollab = async (id: string, data: Partial<Collab>): Promise<ReturnValue> => {
    try {
        const updatedCollab = await CollabModel.findByIdAndUpdate(id, { $set: data }, { new: true }).lean();

        if (!updatedCollab) {
            return {
                status: Status.ERROR,
                message: `(updateCollab) collab not found. Collab ID: ${id}`,
            };
        }

        return {
            status: Status.SUCCESS,
            message: `(updateCollab) collab updated.`,
            data: {
                collab: updatedCollab,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(updateCollab) ${err.message}`,
        };
    }
};

/**
 * Adds a participant to a collab.
 */
export const addParticipant = async (collabId: string, participant: Partial<Participant>): Promise<ReturnValue> => {
    try {
        const collab = await CollabModel.findById(collabId);

        if (!collab) {
            return {
                status: Status.ERROR,
                message: `(addParticipant) collab not found. Collab ID: ${collabId}`,
            };
        }

        collab.participants.push({
            ...participant,
            _id: generateObjectId(),
        });
        await collab.save();

        return {
            status: Status.SUCCESS,
            message: `(addParticipant) Participant added to collab.`,
            data: {
                collab,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(addParticipant) ${err.message}`,
        };
    }
};

/**
 * Removes a participant from a collab.
 */
export const removeParticipant = async (collabId: string, participantId: string): Promise<ReturnValue> => {
    try {
        const collab = await CollabModel.findById(collabId);

        if (!collab) {
            return {
                status: Status.ERROR,
                message: `(removeParticipant) collab not found. Collab ID: ${collabId}`,
            };
        }

        collab.participants.id(participantId).deleteOne();
        await collab.save();

        return {
            status: Status.SUCCESS,
            message: `(removeParticipant) Participant removed from collab.`,
            data: {
                collab,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(removeParticipant) ${err.message}`,
        };
    }
};

/**
 * Updates a participant in a collab.
 */
export const updateParticipant = async (collabId: string, participantId: string, updatedParticipant: Partial<Participant>): Promise<ReturnValue> => {
    try {
        const collab = await CollabModel.findById(collabId);

        if (!collab) {
            return {
                status: Status.ERROR,
                message: `(updateParticipant) collab not found. Collab ID: ${collabId}`,
            };
        }

        const participant = collab.participants.id(participantId);

        if (!participant) {
            return {
                status: Status.ERROR,
                message: `(updateParticipant) Participant not found. Participant ID: ${participantId}`,
            };
        }

        Object.assign(participant, updatedParticipant);
        await collab.save();

        return {
            status: Status.SUCCESS,
            message: `(updateParticipant) Participant updated in collab.`,
            data: {
                collab,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(updateParticipant) ${err.message}`,
        };
    }
};

/**
 * Adds a Group to a specific GroupCollab.
 */
export const addGroup = async (collabId: string, group: Group): Promise<ReturnValue> => {
    try {
        const collab = await CollabModel.findById(collabId);

        if (!collab) {
            return {
                status: Status.ERROR,
                message: `(addGroup) GroupCollab not found. Collab ID: ${collabId}`,
            };
        }

        collab.groups.push(group);
        await collab.save();

        return {
            status: Status.SUCCESS,
            message: `(addGroup) Group added to GroupCollab.`,
            data: {
                collab,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(addGroup) ${err.message}`,
        };
    }
};

/**
 * Removes a Group from a specific GroupCollab.
 */
export const removeGroup = async (collabId: string, groupId: string): Promise<ReturnValue> => {
    try {
        const collab = await CollabModel.findById(collabId);

        if (!collab) {
            return {
                status: Status.ERROR,
                message: `(removeGroup) GroupCollab not found. Collab ID: ${collabId}`,
            };
        }

        const group = collab.groups.id(groupId);

        if (!group) {
            return {
                status: Status.ERROR,
                message: `(removeGroup) Group not found. Group ID: ${groupId}`,
            };
        }

        group.deleteOne();
        await collab.save();

        return {
            status: Status.SUCCESS,
            message: `(removeGroup) Group removed from GroupCollab.`,
            data: {
                collab,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(removeGroup) ${err.message}`,
        };
    }
};

/**
 * Adds a Participant to a specific Group within a GroupCollab.
 */
export const addGroupParticipant = async (collabId: string, groupId: string, participant: Participant): Promise<ReturnValue> => {
    try {
        const collab = await CollabModel.findById(collabId);

        if (!collab) {
            return {
                status: Status.ERROR,
                message: `(addGroupParticipant) GroupCollab not found. Collab ID: ${collabId}`,
            };
        }

        const group = collab.groups.id(groupId);

        if (!group) {
            return {
                status: Status.ERROR,
                message: `(addGroupParticipant) Group not found. Group ID: ${groupId}`,
            };
        }

        group.participants.push(participant);
        await collab.save();

        return {
            status: Status.SUCCESS,
            message: `(addGroupParticipant) Participant added to group in GroupCollab.`,
            data: {
                collab,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(addGroupParticipant) ${err.message}`,
        };
    }
};

/**
 * Removes a Participant from a specific Group within a GroupCollab.
 */
export const removeGroupParticipant = async (collabId: string, groupId: string, participantId: string): Promise<ReturnValue> => {
    try {
        const collab = await CollabModel.findById(collabId);

        if (!collab) {
            return {
                status: Status.ERROR,
                message: `(removeGroupParticipant) GroupCollab not found. Collab ID: ${collabId}`,
            };
        }

        const group = collab.groups.id(groupId);

        if (!group) {
            return {
                status: Status.ERROR,
                message: `(removeGroupParticipant) Group not found. Group ID: ${groupId}`,
            };
        }

        const participant = group.participants.id(participantId);

        if (!participant) {
            return {
                status: Status.ERROR,
                message: `(removeGroupParticipant) Participant not found. Participant ID: ${participantId}`,
            };
        }

        participant.deleteOne();
        await collab.save();

        return {
            status: Status.SUCCESS,
            message: `(removeGroupParticipant) Participant removed from group in GroupCollab.`,
            data: {
                collab,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(removeGroupParticipant) ${err.message}`,
        };
    }
};

/**
 * Import participants using Google Sheet
 */
export const importParticipants = async (spreadsheetId: string, range: string): Promise<ReturnValue> => {
    try {
        const data = (await readSheetObject(spreadsheetId, range)) as Array<{
            Tier: string | null;
            Name: string | null;
            'Twitter ID': string | null;
            'Discord ID': string | null;
            'Invite Code': string | null;
            Approved: string | 'TRUE' | 'FALSE' | null;
        }>;

        // check if the data is empty
        if (data.length == 0) {
            return {
                status: Status.ERROR,
                message: `(importParticipants) Sheet empty`,
            };
        }

        const collabs = await CollabModel.find({ tier: { $in: [...new Set(data.map(({ Tier }) => Tier))] } });

        for (const collab of collabs) {
            const participants = data
                .filter((item) => item.Tier === collab.tier)
                .map((item) => {
                    const participant = collab.participants.find(({ twitterUsername }) => twitterUsername === item['Twitter ID']);

                    return {
                        _id: participant?._id ?? generateObjectId(),
                        name: participant?.name ?? item.Name,
                        approved: item.Approved === 'TRUE',
                        claimable: participant?.claimable ?? true,
                        code: participant?.code ?? item['Invite Code'],
                        discordId: participant?.discordId ?? item['Discord ID'],
                        role: 'Leader',
                        twitterUsername: participant?.twitterUsername ?? item['Twitter ID'],
                    } as Participant;
                });

            await collab.updateOne({
                $set: {
                    participants,
                },
            });
        }

        const registeredUser = await UserModel.find({ twitterUsername: data.map((item) => item['Twitter ID']) }).lean();
        const unregisteredUser = data.filter((item) => !registeredUser.find((user) => user.twitterUsername === item['Twitter ID']));

        // handle pre-register user
        await UserModel.create(
            unregisteredUser.map((user) => ({
                _id: generateObjectId(),
                twitterId: null,
                twitterUsername: user['Twitter ID'],
                inviteCodeData: {
                    usedStarterCode: user['Invite Code'],
                    usedReferralCode: null,
                    referrerId: null,
                },
            }))
        );

        return {
            status: Status.SUCCESS,
            message: `(importParticipants) Participants imported in the collab`,
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(importParticipants) ${err.message}`,
        };
    }
};

/**
 * Import group participants using Google Sheet
 */
export const importGroupParticipants = async (spreadsheetId: string, range: string): Promise<ReturnValue> => {
    try {
        const data = (await readSheetObject(spreadsheetId, range)) as Array<{
            Name: string | null;
            Role: string | null;
            'Group Name': string | null;
            'Twitter ID': string | null;
            'Discord ID': string | null;
            'Invite Code': string | null;
            Approved: string | 'TRUE' | 'FALSE' | null;
        }>;

        // check if the data is empty
        if (data.length == 0) {
            return {
                status: Status.ERROR,
                message: `(importGroupParticipants) Sheet empty`,
            };
        }

        const collabs = await CollabModel.find({
            'groups.name': { $in: [...new Set(data.map((item) => item['Group Name']))] },
        });

        for (const collab of collabs) {
            const groups = collab.groups.map((group) => {
                const participants = data
                    .filter((item) => group['name'] === item['Group Name'])
                    .map((item) => {
                        const participant = group.participants.find(({ twitterUsername }) => twitterUsername === item['Twitter ID']);

                        return {
                            _id: participant?._id ?? generateObjectId(),
                            name: participant?.name ?? item.Name,
                            approved: item.Approved === 'TRUE',
                            claimable: participant?.claimable ?? true,
                            code: participant?.code ?? item['Invite Code'],
                            discordId: participant?.discordId ?? item['Discord ID'],
                            role: participant?.role ?? item['Role'],
                            twitterUsername: participant?.twitterUsername ?? item['Twitter ID'],
                        } as Participant;
                    });

                return {
                    ...group.toObject(),
                    participants,
                };
            });

            await collab.updateOne({
                $set: { groups },
            });
        }

        const registeredUser = await UserModel.find({ twitterUsername: data.map((item) => item['Twitter ID']) }).lean();
        const unregisteredUser = data.filter((item) => !registeredUser.find((user) => user.twitterUsername === item['Twitter ID']));

        // handle pre-register user
        await UserModel.create(
            unregisteredUser.map((user) => ({
                _id: generateObjectId(),
                twitterId: null,
                twitterUsername: user['Twitter ID'],
                inviteCodeData: {
                    usedStarterCode: user['Invite Code'],
                    usedReferralCode: null,
                    referrerId: null,
                },
            }))
        );

        return {
            status: Status.SUCCESS,
            message: `(importGroupParticipants) Group Participants imported in the collab`,
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(importGroupParticipants) ${err.message}`,
        };
    }
};

export const getCollabRewards = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();
        if (!user) {
            return {
                status: Status.ERROR,
                message: `(claimCollabRewards) User not found.`,
            };
        }

        const collab = await CollabModel.findOne({
            $or: [{ 'participants.twitterUsername': user.twitterUsername }, { 'groups.participants.twitterUsername': user.twitterUsername }],
        }).lean();

        if (!collab) {
            return {
                status: Status.ERROR,
                message: `(getCollabReward) You don't registered to any collab program`,
            };
        }

        let isLeader = false;
        let rewards: any | null = null;
        let isClaimable = false;
        let isApproved = false;

        // Check if the user is the Leader in KOL collab
        if (collab.type === 'kol' && collab.participants) {
            const participant = collab.participants.find((p) => p.twitterUsername === user.twitterUsername);
            if (participant) {
                isApproved = participant.approved;
                isClaimable = participant.approved && participant.claimable;

                if (participant.role === 'Leader') {
                    isLeader = true;
                    rewards = collab.leaderRewards;
                } else {
                    rewards = collab.memberRewards;
                }
            }
        }

        // Check if the user is the Leader or Member in Group collab
        if (collab.type === 'group' && collab.groups) {
            for (const group of collab.groups) {
                const participant = group.participants.find((p) => p.twitterUsername === user.twitterUsername);
                if (participant) {
                    isApproved = participant.approved;
                    isClaimable = participant.approved && participant.claimable;

                    if (participant.role === 'Leader') {
                        isLeader = true;
                        rewards = collab.leaderRewards;
                    } else {
                        rewards = collab.memberRewards;
                    }
                    break;
                }
            }
        }

        if (!rewards) {
            return {
                status: Status.ERROR,
                message: `(getCollabReward) Could not determine your role in the collab program`,
            };
        }

        return {
            status: Status.SUCCESS,
            message: `(getCollabReward) Collab reward fetched`,
            data: {
                rewards,
                isClaimable,
                isApproved,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getCollabReward) ${err.message}`,
        };
    }
};

export const claimCollabRewards = async (twitterId: string): Promise<ReturnValue> => {
    try {
        const user = await UserModel.findOne({ twitterId }).lean();
        if (!user) {
            return {
                status: Status.ERROR,
                message: `(claimCollabRewards) User not found.`,
            };
        }

        const { data, status, message } = await getCollabRewards(user.twitterUsername);
        if (status !== Status.SUCCESS) {
            return {
                status,
                message: `(claimCollabRewards) Error for getCollabRewards: ${message}`,
            };
        }

        if (!data.isApproved) {
            return {
                status,
                message: `(claimCollabRewards) You're not fulfilled the requirement`,
            };
        }

        if (!data.isClaimable) {
            return {
                status,
                message: `(claimCollabRewards) You already claim the reward`,
            };
        }

        const collab = await CollabModel.findOne({
            $or: [{ 'participants.twitterUsername': user.twitterUsername }, { 'groups.participants.twitterUsername': user.twitterUsername }],
        });

        if (!collab) {
            return {
                status: Status.ERROR,
                message: `(claimCollabRewards) You don't registered to any collab program`,
            };
        }

        let participantUpdated = false;

        if (collab.type === 'kol' && collab.participants) {
            const participant = collab.participants.find((p) => p.twitterUsername === user.twitterUsername);
            if (participant && participant.claimable) {
                participant.claimable = false;
                participantUpdated = true;
            }
        }

        if (collab.type === 'group' && collab.groups) {
            for (const group of collab.groups) {
                const participant = group.participants.find((p: Participant) => p.twitterUsername === user.twitterUsername);
                if (participant && participant.claimable) {
                    participant.claimable = false;
                    participantUpdated = true;
                    break;
                }
            }
        }

        if (!participantUpdated) {
            return {
                status: Status.ERROR,
                message: `(claimCollabRewards) Participant not found or already claimed the reward`,
            };
        }

        await collab.save();

        const userUpdateOperations = {
            $pull: {},
            $inc: {},
            $set: {},
            $push: {},
        };

        for (const reward of data.rewards as CollabReward[]) {
            switch (reward.type) {
                case CollabRewardType.BIT_ORB_I:
                case CollabRewardType.BIT_ORB_II:
                case CollabRewardType.BIT_ORB_III:
                case CollabRewardType.TERRA_CAPSULATOR_I:
                case CollabRewardType.TERRA_CAPSULATOR_II:
                    // add the item to the user's inventory
                    const existingItemIndex = (user.inventory?.items as Item[]).findIndex((i) => i.type === (reward.type as any));

                    if (existingItemIndex !== -1) {
                        userUpdateOperations.$inc[`inventory.items.${existingItemIndex}.amount`] = reward.amount;
                    } else {
                        if (!userUpdateOperations.$push['inventory.items']) {
                            userUpdateOperations.$push['inventory.items'] = {
                                $each: [],
                            };
                        }

                        userUpdateOperations.$push['inventory.items'].$each.push({
                            type: reward.type,
                            amount: reward.amount,
                            totalAmountConsumed: 0,
                            weeklyAmountConsumed: 0,
                        });
                    }
                    break;
                case CollabRewardType.X_BIT_BERRY:
                    userUpdateOperations.$inc['inventory.xCookieData.currentXCookies'] = reward.amount;

                    // check if the user's `xCookieData.extendedXCookieData` contains a source called QUEST_REWARDS.
                    // if yes, we increment the amount, if not, we create a new entry for the source
                    const questRewardsIndex = (user.inventory?.xCookieData.extendedXCookieData as ExtendedXCookieData[]).findIndex(
                        (data) => data.source === XCookieSource.COLLAB_REWARDS
                    );

                    if (questRewardsIndex !== -1) {
                        userUpdateOperations.$inc[`inventory.xCookieData.extendedXCookieData.${questRewardsIndex}.xCookies`] = reward.amount;
                    } else {
                        userUpdateOperations.$push['inventory.xCookieData.extendedXCookieData'] = {
                            xCookies: reward.amount,
                            source: XCookieSource.COLLAB_REWARDS,
                        };
                    }
                    break;
            }
        }

        await UserModel.updateOne({ twitterId }, { $inc: userUpdateOperations.$inc });
        await UserModel.updateOne({ twitterId }, { $push: userUpdateOperations.$push });

        return {
            status: Status.SUCCESS,
            message: `(claimCollabRewards) Collab awarded`,
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(claimCollabRewards) ${err.message}`,
        };
    }
};
