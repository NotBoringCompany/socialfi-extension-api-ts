import { AssetType } from './asset';
import { FoodType } from './food';
import { ItemType } from './item';

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
export interface CreateMailParams {
  /**
   * The list of receivers of the mail.
   * Each receiver is represented by an object with the following properties:
   * - `_id`: the ID of the receiver user
   * - `isRead`: whether the mail has been read by the receiver
   * - `isClaimed`: whether the mail has been claimed by the receiver
   * - `isDeleted`: whether the mail has been deleted by the receiver
   */
  receivers: MailReceiverData[];
  /**
   * The subject of the mail
   */
  subject: string;
  /**
   * The body of the mail
   */
  body: string;
  /**
   * The items attached to the mail
   */
  attachments: Attachment[];
  /**
   * The type of mail
   */
  type: MailType;
  expiredDate?: number;
}

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
  // /**
  //  * The receivers of this mail.
  //  * Each receiver requires tracking to check whether they've read, claimed and/or deleted the mail.
  //  */
  // receiverData: ReceiverStatus[];
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
  sentTimestamp: number;
  /**
   * when the mail expires. this is used for purging old mails from the database.
   */
  expiryTimestamp: number;
}

/**
 * Represents an attachment to a mail.
 * 
 * Attachments usually are some forms of rewards or forms of assets that are sent along with the mail.
 */
export interface Attachment {
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
  userId: string;
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
 * the MailDTO is for return value
 *  so this interface different from Mail models
 * for information Mail is for database schema
 * and if we return the value same as Mail interface
 * it should be confused, because in the Mail interface we have recevierIds as an array of who user have received mail and configurations status.
 * so that why we transform it to MailDTO when we return.
 * for better information chek receiverIds in Mail interface
 */
export interface MailDTO {
  // id here is for the mail id
  _id: string;
  // userId here for user 
  userId: string;
  isRead: boolean;
  isReadAt: number;
  // is deleted here for the user who delete the mail
  // the fondation from the user who delete the mail, is not truly deleted the mail it just change the status
  isDeleted: boolean;
  isDeletedAt: number;
  // is claimed here for the user who claim the mail with MailType Reward
  // if user already claim the mail, isClaimed will be true and we can used it for prevent claim more than once
  isClaimed: boolean;
  // isClaimedAt is for the timestamp when user claim the mail
  isClaimedAt: number;
  subject: string;
  body: string;
  /**
   * the attachments here for email with MailType Reward.
   * we have name, type, and quantity.
   * so we can use this attachments to store food and items to the user
   * and for claiming method we create some endpoints to claim food and items with POST method mail/claim_mail and body {mailId, userId}
   */
  attachments: Attachment[];
  timestamp: number;
  /**
   * in previous deleted status we already know the mail is not truly deleted right ?
   * so thats why expiredDate is for cronjob to make easier to filter and purge the mail, if the mail is expired.
   * now if cronjob see the expiredDate is less than current time, it will delete the mail
   * this approach is for storage optimization, we just only need to create one email for each user
   */
  expiredDate: number;
  type: MailType;
}