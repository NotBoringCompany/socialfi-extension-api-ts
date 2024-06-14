import { ReturnValue, Status } from '../utils/retVal';
import { generateObjectId } from '../utils/crypto';
import { KOLCollabModel } from '../utils/constants/db';
import { KOLCollab, Participant } from '../models/collab';

/**
 * Adds a KOL collab to the database.
 */
export const addKOLCollab = async (data: Partial<KOLCollab>): Promise<ReturnValue> => {
    try {
        const newCollab = new KOLCollabModel({
            _id: generateObjectId(),
            ...data,
        });

        await newCollab.save();

        return {
            status: Status.SUCCESS,
            message: `(addKOLCollab) KOL collab added.`,
            data: {
                collab: newCollab,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(addKOLCollab) ${err.message}`,
        };
    }
};

/**
 * Fetches all KOL collabs from the database.
 */
export const getKOLCollabs = async (): Promise<ReturnValue> => {
    try {
        const collabs = await KOLCollabModel.find().lean();

        if (collabs.length === 0 || !collabs) {
            return {
                status: Status.ERROR,
                message: `(getKOLCollabs) No KOL collabs found.`,
            };
        }

        return {
            status: Status.SUCCESS,
            message: `(getKOLCollabs) KOL collabs fetched.`,
            data: {
                collabs,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getKOLCollabs) ${err.message}`,
        };
    }
};

/**
 * Deletes a KOL collab from the database.
 */
export const deleteKOLCollab = async (id: string): Promise<ReturnValue> => {
    try {
        const collab = await KOLCollabModel.findOne({ _id: id }).lean();

        if (!collab) {
            return {
                status: Status.ERROR,
                message: `(deleteKOLCollab) KOL collab not found. Collab ID: ${id}`,
            };
        }

        await KOLCollabModel.deleteOne({ _id: id });

        return {
            status: Status.SUCCESS,
            message: `(deleteKOLCollab) KOL collab deleted.`,
            data: {
                id,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(deleteKOLCollab) ${err.message}`,
        };
    }
};

/**
 * Fetches a KOL collab by ID from the database.
 */
export const getKOLCollabById = async (id: string): Promise<ReturnValue> => {
    try {
        const collab = await KOLCollabModel.findOne({ _id: id }).lean();

        if (!collab) {
            return {
                status: Status.ERROR,
                message: `(getKOLCollabById) KOL collab not found. Collab ID: ${id}`,
            };
        }

        return {
            status: Status.SUCCESS,
            message: `(getKOLCollabById) KOL collab fetched.`,
            data: {
                collab,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(getKOLCollabById) ${err.message}`,
        };
    }
};

/**
 * Updates a KOL collab in the database.
 */
export const updateKOLCollab = async (id: string, data: Partial<KOLCollab>): Promise<ReturnValue> => {
    try {
        const updatedCollab = await KOLCollabModel.findByIdAndUpdate(id, { $set: data }, { new: true });

        if (!updatedCollab) {
            return {
                status: Status.ERROR,
                message: `(updateKOLCollab) KOL collab not found. Collab ID: ${id}`,
            };
        }

        return {
            status: Status.SUCCESS,
            message: `(updateKOLCollab) KOL collab updated.`,
            data: {
                collab: updatedCollab,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(updateKOLCollab) ${err.message}`,
        };
    }
};

/**
 * Adds a participant to a KOL collab.
 */
export const addKOLParticipant = async (collabId: string, participant: Partial<Participant>): Promise<ReturnValue> => {
    try {
        const collab = await KOLCollabModel.findById(collabId);

        if (!collab) {
            return {
                status: Status.ERROR,
                message: `(addKOLParticipant) KOL collab not found. Collab ID: ${collabId}`,
            };
        }

        collab.participants.push({
            ...participant,
            _id: generateObjectId(),
        });
        await collab.save();

        return {
            status: Status.SUCCESS,
            message: `(addKOLParticipant) Participant added to KOL collab.`,
            data: {
                collab,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(addKOLParticipant) ${err.message}`,
        };
    }
};

/**
 * Removes a participant from a KOL collab.
 */
export const removeKOLParticipant = async (collabId: string, participantId: string): Promise<ReturnValue> => {
    try {
        const collab = await KOLCollabModel.findById(collabId);

        if (!collab) {
            return {
                status: Status.ERROR,
                message: `(removeKOLParticipant) KOL collab not found. Collab ID: ${collabId}`,
            };
        }

        collab.participants.id(participantId).deleteOne();
        await collab.save();

        return {
            status: Status.SUCCESS,
            message: `(removeKOLParticipant) Participant removed from KOL collab.`,
            data: {
                collab,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(removeKOLParticipant) ${err.message}`,
        };
    }
};

/**
 * Updates a participant in a KOL collab.
 */
export const updateKOLParticipant = async (collabId: string, participantId: string, updatedParticipant: Partial<Participant>): Promise<ReturnValue> => {
    try {
        const collab = await KOLCollabModel.findById(collabId);

        if (!collab) {
            return {
                status: Status.ERROR,
                message: `(updateKOLParticipant) KOL collab not found. Collab ID: ${collabId}`,
            };
        }

        const participant = collab.participants.id(participantId);

        if (!participant) {
            return {
                status: Status.ERROR,
                message: `(updateKOLParticipant) Participant not found. Participant ID: ${participantId}`,
            };
        }

        Object.assign(participant, updatedParticipant);
        await collab.save();

        return {
            status: Status.SUCCESS,
            message: `(updateKOLParticipant) Participant updated in KOL collab.`,
            data: {
                collab,
            },
        };
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(updateKOLParticipant) ${err.message}`,
        };
    }
};
