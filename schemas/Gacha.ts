import mongoose from 'mongoose';
import { generateObjectId } from '../utils/crypto';
import { UserGachaRollData } from '../models/gacha';

export const UserGachaRollDataSchema = new mongoose.Schema<UserGachaRollData>({
    _id: {
        type: String,
        default: generateObjectId()
    },
    userId: String,
    gachaRollId: String,
    totalRolls: Number,
    rollsUntilFortuneCrest: Number,
    rollsUntilFortuneSurge: Number,
    currentFortuneSurgeRoll: Number,
    rollsUntilFortuneBlessing: Number,
    rollsUntilFortunePeak: Number
});