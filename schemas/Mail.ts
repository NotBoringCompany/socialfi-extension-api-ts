import mongoose from "mongoose";
import { Attachment, Mail, MailReceiverData } from "../models/mail";
import { generateObjectId } from "../utils/crypto";

/**
 * StatusEmail schema. Represents closely to the `StatusEmail` interface in `models/mail.ts`.
 */
const StatusEmailSchema = new mongoose.Schema({
  status: { type: Boolean, default: false },
  timestamp: Number,
});

/**
 * MailReceiverData schema. Represents closely to the `MailReceiverData` interface in `models/mail.ts`.
 */
export const MailReceiverDataSchema = new mongoose.Schema<MailReceiverData>({
  userId: {
    type: String,
    required: true
  },
  readStatus: { type: StatusEmailSchema },
  claimedStatus: { type: StatusEmailSchema },
  deletedStatus: { type: StatusEmailSchema }
})

/**
 * Attachment schema. Represents closely to the `Attachment` interface in `models/mail.ts`.
 */
const AttachmentSchema = new mongoose.Schema<Attachment>({
  type: String,
  name: String,
  amount: Number
})

/**
 * Mail schema. Represents closely to the `Mail` interface in `models/mail.ts`.
 */
export const MailSchema = new mongoose.Schema<Mail>({
  _id: {
    type: String,
    default: generateObjectId()
  },
  mailType: {
    type: String,
    required: true,
    index: true
  },
  subject: String,
  body: String,
  attachments: { type: [AttachmentSchema] },
  sentTimestamp: Number,
  expiryTimestamp: Number
})

