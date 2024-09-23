import mongoose from "mongoose";
import { Mail, ReceiverStatus } from "../models/mail";
import { generateObjectId } from "../utils/crypto";

/**
 * Mongoose schema for Mail model.
 */

const StatusEmailSchema = new mongoose.Schema({
  status: { type: Boolean, default: false },
  timestamp: Number,
});

const ReceiverStatusSchema = new mongoose.Schema<ReceiverStatus>({
  /**
   * The ID of the receiver.
   */
  _id: {
    type: String,
    required: true
  },
  /**
   * Whether the mail has been read by the receiver.
   */
  isRead: {
    type: StatusEmailSchema
  },
  /**
   * Whether the mail has been claimed by the receiver.
   */
  isClaimed: {
    type: StatusEmailSchema
  },
  /**
   * Whether the mail has been deleted by the receiver.
   */
  isDeleted: {
    type: StatusEmailSchema
  }
})

const ItemsSchema = new mongoose.Schema({
  name: String,
  quantity: Number
})

export const MailSchema = new mongoose.Schema<Mail>({
  _id: {
    type: String,
    default: generateObjectId()
  },
  /**
   * The user ID of the receiver.
   * This is an array of objects containing the receiver's ID and other metadata.
   * for more info please check Mail Model 
   * @file"../models/mail"
   */
  receiverIds: { type: [ReceiverStatusSchema], required: true },
  /**
   * The subject of the mail.
   */
  subject: String,
  /**
   * The items attached to the mail.
   */
  items: { type: [ItemsSchema] },
  /**
   * The body of the mail.
   */
  body: String,
  /**
   * The timestamp when the mail was sent.
   */
  timestamp: Number,
  /**
   * Whether the mail has expired.
   * when the mail has expired, it will be deleted from the database
   */
  expiredDate: Number,
  /**
   * The type of mail.
   * This is a string that defines the purpose of the mail.
   * e.g. "Updates", "Rewards", "Notices", "Maintenance"
   */
  type: String
})

