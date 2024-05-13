import mongoose from 'mongoose';
import { generateObjectId } from '../utils/crypto';

/**
 * Setting schema. Represents closely to the `Setting` interface in `models/setting.ts`.
 */
export const SettingSchema = new mongoose.Schema({
    _id: {
        type: String,
        default: generateObjectId(),
    },
    key: String,
    name: String,
    description: String,
    value: { type: mongoose.SchemaTypes.Mixed },
});
