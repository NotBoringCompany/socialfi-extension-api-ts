import { FoodType } from "./food";
import { ItemType } from "./item";

/**
 * Represents a mail sent between users.
 *
 * @property {string} _id - The unique ID of the mail.
 * @property {string} receiverId - The user ID of the receiver.
 * @property {string} subject - The subject of the mail.
 * @property {string} body - The body of the mail.
 * @property {Attachment[]} attachments - The attached data to the mail.
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
   * this receiver ids, it is represented by user id, and a bit state isRead, isClaimed, isDeleted
   * this approach is for optimization storage, for example if we have 1000 users, and we want to send mail to 1000 users,
   * we can use this approach.
   * the strategies is to use the user id as the key and statuses as the state value
   * so we just need to create one email for each user
   */
  receiverIds: ReceiverStatus[];
  /**
   * The subject of the mail.
   */
  subject: string;
  /**
   * The body of the mail.
   */
  body: string;
  /**
   * The attached data to the mail.
   */
  attachments: Attachment[];
  /**
   * The timestamp when the mail was sent.
   */
  timestamp: number;
  /**
   * the expired date of the mail
   * the expired date is for cronjob to make easier to filter and purge the mail
   */
  expiredDate: number;
  /**
   * The type of mail.
   */
  type: MailType;
}

export interface Attachment {
  name: ItemType | FoodType;
  type: 'Food' | 'Item';
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

export interface StatusEmail {
  status: boolean;
  timestamp: number;
}

export interface MailDTO {
  _id: string;
  userId: string;
  isRead: boolean;
  isReadAt: number;
  isDeleted: boolean;
  isDeletedAt: number;
  isClaimed: boolean;
  isClaimedAt: number;
  subject: string;
  body: string;
  attachments: Attachment[];
  timestamp: number;
  expiredDate: number;
  type: MailType;
}