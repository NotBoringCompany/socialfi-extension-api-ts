import mongoose from "mongoose";
import { MailAttachment, Mail, MailReceiverData, MailReceiverOptions } from "../models/mail";
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
 * MailAttachment schema. Represents closely to the `Attachment` interface in `models/mail.ts`.
 */
const MailAttachmentSchema = new mongoose.Schema<MailAttachment>({
  type: String,
  name: String,
  amount: Number
});

/**
 * MailReceiverOptions schema. Represents closely to the `MailReceiverOptions` interface in `models/mail.ts`.
 */
const MailReceiverOptionsSchema = new mongoose.Schema<MailReceiverOptions>({
  receivers: String,
  includeNewUsers: Boolean,
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
  receiverOptions: { type: MailReceiverOptionsSchema },
  subject: String,
  body: String,
  attachments: { type: [MailAttachmentSchema] },
  sentTimestamp: Number,
  expiryTimestamp: mongoose.Schema.Types.Mixed,
})

