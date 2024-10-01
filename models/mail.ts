import { AssetType } from './asset';
import { FoodType } from './food';
import { ItemType } from './item';

/**
 * Represents a mail instance sent to users via the mailing system.
 */
export interface Mail {
  /**
   * The unique ID of the mail.
   */
  _id: string;
  /**
   * The type of mail.
   */
  mailType: MailType;
  /**
   * the options with regards to receivers.
   * 
   * a mail can be sent only to specific users, or to all users.
   * then, a mail can also be given to new users or only existing users.
   * 
   * for example, if a mail can be given to only existing users, new users who register after a mail instance was sent will NOT receive the mail.
   */
  receiverOptions: MailReceiverOptions;
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
  attachments: MailAttachment[];
  /**
   * The timestamp when the mail was sent.
   */
  sentTimestamp: number;
  /**
   * when the mail expires. this is used for purging old mails from the database.
   * 
   * if the expiry timestamp is set to `never`, then the mail will never expire.
   */
  expiryTimestamp: number | 'never';
}

/**
 * Represents the options for the mail receiver.
 */
export interface MailReceiverOptions {
  /** 
   * if this mail is meant to all users or only to specific users. 
   * 
   * NOTE: the user IDs will NOT be stored within the mail, but can be queried by checking the `MailReceiverData` collection and querying the mail ID.
   * this is purely to track whether the mail is meant for all users or only specific users.
   */
  receivers: 'all' | 'specific';
  /**
   * if this mail is meant for new users or only existing users.
   * 
   * if `true`, then all newly registered users who register before the mail's `expiryTimestamp` will receive the mail.
   */
  includeNewUsers: boolean;
}

/**
 * Represents an attachment to a mail.
 * 
 * Attachments usually are some forms of rewards or forms of assets that are sent along with the mail.
 */
export interface MailAttachment {
  /** the attachment type */
  type: 'food' | 'item' | 'resource' | 'xCookies';
  /** the name of the attachment */
  name: AssetType | 'xCookies';
  /** the amount of the attachment sent */
  amount: number;
}

/**
 * Represents a mail type.
 */
export enum MailType {
  /**
   * Maintenance mail.
   */
  MAINTENANCE = 'Maintenance',
  /**
   * Update mail.
   */
  UPDATE = 'Update',
  /**
   * Rewards mail.
   */
  REWARDS = 'Rewards',
  /**
   * Notice mail.
   */
  NOTICE = 'Notice',
}

/**
 * Represents the status of a receiver of a mail.
 */
export interface MailReceiverData {
  /**
   * the user's database ID.
   */
  userId?: string;
  /**
   * the ID of the mail this receiver data is associated with.
   */
  mailId?: string;
  /**
   * the mail's read status
   */
  readStatus: MailStatus;
  /**
   * the mail's claimed status
   */
  claimedStatus: MailStatus;
  /**
   * the mail's deleted status
   */
  deletedStatus: MailStatus;
}

/**
 * Represents the status of a mail.
 */
export interface MailStatus {
  /** the status of the mail (e.g. for `readStatus`, a status of `true` means that the mail has been read by the receiver) */
  status: boolean;
  /** the timestamp when the status turned `true`. if still `false`, timestamp will be `0`. */
  timestamp: number;
}

/**
 * MailDTO is used as a return interface for fetching mails, combining elements from `Mail` and `MailReceiverData`.
 */
export interface MailDTO extends Mail, MailReceiverData {}