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