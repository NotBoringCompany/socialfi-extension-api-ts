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
  _id: string;
  receiverId: string;
  subject: string;
  body: string;
  items: Items[];
  isRead: boolean;
  timestamp: Date;
  type: MailType;
}

export interface Items {
  name: ItemType;
  quantity: number;
}
/**
 * Represents the type of mail.
 */
/**
 * Represents the type of mail.
 *
 * @enum {string}
 */
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

