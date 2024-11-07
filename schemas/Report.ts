import mongoose from 'mongoose';
import { generateObjectId } from '../utils/crypto';
import { Report } from '../models/report';

/**
 * Report schema. Represents closely to the `Report` interface in `models/report.ts`.
 */
export const ReportSchema = new mongoose.Schema<Report & Document>({
    _id: {
        type: String,
        default: generateObjectId(),
    },
    reportedBy: { type: String, ref: 'Users', required: true, index: true },
    reportedOn: { type: String, ref: 'Users', required: true, index: true },
    categories: { type: [String], required: true },
    reason: { type: String, required: true },
    status: { type: String, required: true },
    createdTimestamp: { type: Number, default: () => Date.now() },
});
