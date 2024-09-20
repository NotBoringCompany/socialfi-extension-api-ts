import mongoose from "mongoose";
import { Mail } from "../models/mail";
import { generateObjectId } from "../utils/crypto";

/**
 * Mongoose schema for Mail model.
 */
export const MailSchema = new mongoose.Schema<Mail>({
  _id: {
    type: String,
    default: generateObjectId()
  },
  /**
   * The user ID of the receiver.
   */
  receiverId: String,
  /**
   * The subject of the mail.
   */
  subject: String,
  /**
   * The items attached to the mail.
   */
  items: [String],
  /**
   * The body of the mail.
   */
  body: String,
  /**
   * Whether the mail has been read by the receiver.
   */
  isRead: {
    type: Boolean,
    default: false
  },
  /**
   * The timestamp when the mail was sent.
   */
  timestamp: Date,
  /**
   * The type of mail.
   * This is a string that defines the purpose of the mail.
   * e.g. "gift","system"
   */
  type: String
})
