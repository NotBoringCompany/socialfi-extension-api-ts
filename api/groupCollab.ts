import { ReturnValue, Status } from '../utils/retVal';
import { generateObjectId } from '../utils/crypto';
import { GroupCollabModel } from '../utils/constants/db';
import { Group, GroupCollab, Participant } from '../models/collab';

/**
 * Adds a Group collab to the database.
 */
export const addGroupCollab = async (data: Partial<GroupCollab>): Promise<ReturnValue> => {
    try {
        const newCollab = new GroupCollabModel({
            _id: generateObjectId(),
            ...data,
        });

        await newCollab.save();

        return {
            status: Status.SUCCESS,
            message: `(addGroupCollab) Group collab added.`,
            data: {
                collab: newCollab,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(addGroupCollab) ${err.message}`,
        };
    }
};

/**
 * Fetches all Group collabs from the database.
 */
export const getGroupCollabs = async (): Promise<ReturnValue> => {
    try {
        const collabs = await GroupCollabModel.find().lean();

        if (collabs.length === 0 || !collabs) {
            return {
                status: Status.ERROR,
                message: `(getGroupCollabs) No Group collabs found.`,
            };
        }

        return {
            status: Status.SUCCESS,
            message: `(getGroupCollabs) Group collabs fetched.`,
            data: {
                collabs,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getGroupCollabs) ${err.message}`,
        };
    }
};

/**
 * Deletes a Group collab from the database.
 */
export const deleteGroupCollab = async (id: string): Promise<ReturnValue> => {
    try {
        const collab = await GroupCollabModel.findOne({ _id: id }).lean();

        if (!collab) {
            return {
                status: Status.ERROR,
                message: `(deleteGroupCollab) Group collab not found. Collab ID: ${id}`,
            };
        }

        await GroupCollabModel.deleteOne({ _id: id });

        return {
            status: Status.SUCCESS,
            message: `(deleteGroupCollab) Group collab deleted.`,
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(deleteGroupCollab) ${err.message}`,
        };
    }
};

/**
 * Adds a Group to a specific GroupCollab.
 */
export const addGroup = async (collabId: string, group: Group): Promise<ReturnValue> => {
    try {
        const collab = await GroupCollabModel.findById(collabId);

        if (!collab) {
            return {
                status: Status.ERROR,
                message: `(addGroup) GroupCollab not found. Collab ID: ${collabId}`,
            };
        }

        if (collab.maxGroups !== null && collab.groups.length >= collab.maxGroups) {
            return {
                status: Status.ERROR,
                message: `(addGroup) Maximum number of groups reached for this tier.`,
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
 * Adds a Participant to a specific Group within a GroupCollab.
 */
export const addGroupParticipant = async (collabId: string, groupId: string, participant: Participant): Promise<ReturnValue> => {
    try {
        const collab = await GroupCollabModel.findById(collabId);

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

        if (collab.maxMembers !== null && group.participants.length >= collab.maxMembers) {
            return {
                status: Status.ERROR,
                message: `(addGroupParticipant) Maximum number of participants reached for this group.`,
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
 * Removes a Group from a specific GroupCollab.
 */
export const removeGroup = async (collabId: string, groupId: string): Promise<ReturnValue> => {
    try {
        const collab = await GroupCollabModel.findById(collabId);

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
 * Removes a Participant from a specific Group within a GroupCollab.
 */
export const removeGroupParticipant = async (collabId: string, groupId: string, participantId: string): Promise<ReturnValue> => {
    try {
        const collab = await GroupCollabModel.findById(collabId);

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
