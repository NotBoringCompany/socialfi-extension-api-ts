import { ItemType } from "./item";

/**
 * Represents a mail sent between users.
 *
 * @property {string} _id - The unique ID of the mail.
 * @property {string} receiverId - The user ID of the receiver.
 * @property {string} subject - The subject of the mail.
 * @property {string} body - The body of the mail.
 * @property {Items[]} items - The items attached to the mail.
 * @property {boolean} isRead - Whether the mail has been read by the receiver.
 * @property {Date} timestamp - The timestamp when the mail was sent.
 * @property {MailType} type - The type of mail.
 */
export interface Mail {
  /**
   * The unique ID of the mail.
   */
  _id: string;
  /**
   * The user ID of the receiver.
   */
  receiverIds: ReceiverStatus;
  /**
   * The subject of the mail.
   */
  subject: string;
  /**
   * The body of the mail.
   */
  body: string;
  /**
   * The items attached to the mail.
   */
  items: Items[];
  /**
   * The timestamp when the mail was sent.
   */
  timestamp: Date;
  /**
   * The type of mail.
   */
  type: MailType;
}

export interface Items {
  name: ItemType;
  quantity: number;
}

export enum MailType {
  /**
   * Maintenance mail.
   */
  MAINTENANCE = "Maintenance",
  /**
   * Update mail.
   */
  UPDATES = "Updates",
  /**
   * Reward mail.
   */
  REWARDS = 'Rewards',
  /**
   * Notice mail.
   */
  NOTICES = 'Notices',
}

export interface ReceiverStatus {
  /**
   * The unique ID of the receiver.
   * it should user _id
   * @type {string}
   */
  _id: string;
  /**
   * Whether the mail has been read.
   */
  isRead: StatusEmail;
  /**
   * Whether the mail has been claimed.
   */
  isClaimed: StatusEmail;
  /**
   * Whether the mail has been deleted.
   */
  isDeleted: StatusEmail;
}

export interface StatusEmail  {
  status: boolean;
  timestamp: Date;
}