import { Items, Mail, MailType, ReceiverStatus } from '../models/mail';
import { MailModel, UserModel } from '../utils/constants/db';
import { ReturnValue, Status } from '../utils/retVal';
import { ClientSession, startSession } from 'mongoose';

interface CreateMailParams {
  /**
   * The list of receivers of the mail.
   * Each receiver is represented by an object with the following properties:
   * - `_id`: the ID of the receiver user
   * - `isRead`: whether the mail has been read by the receiver
   * - `isClaimed`: whether the mail has been claimed by the receiver
   * - `isDeleted`: whether the mail has been deleted by the receiver
   */
  receivers: ReceiverStatus[];
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
  items: Items[];
  /**
   * The type of mail
   */
  type: MailType;
}

const createMail = async (
  { receivers, subject, body, items, type }: CreateMailParams,
  session?: ClientSession
): Promise<boolean> => {
  try {
    const newMail = new MailModel({
      receiverIds: receivers,
      subject,
      body,
      items,
      isRead: false,
      timestamp: new Date(),
      type: MailType[type],
    });
    await newMail.save({ session });
    return true;
  } catch (err: any) {
    return false;
  }
};

/**
 * Notify all users with a new mail.
 *
 * @param {string} subject - The subject of the mail.
 * @param {string} body - The body of the mail.
 * @param {Items[]} items - The items attached to the mail.
 * @param {MailType} type - The type of mail.
 * @returns {Promise<ReturnValue>}
 * @example notifyUsers(subject, body, items, type): Promise<ReturnValue> => {
 *  return {
 *    status: Status.SUCCESS,
 *    message: "(notifyUsers) Successfully added new mail to database",
 *  }
 * }
 */
export const notifyUsers = async (
  subject: string,
  body: string,
  items: Items[],
  type: MailType
): Promise<ReturnValue> => {
  try {
    const users = await UserModel.find().lean();
    const receiverIds: ReceiverStatus[] = users.map((user) => {
      return {
        _id: user._id,
        isRead: { status: false, timestamp: new Date() },
        isClaimed: { status: false, timestamp: new Date() },
        isDeleted: { status: false, timestamp: new Date() },
      };
    });

    await createMail({ receivers: receiverIds, subject, body, items, type });
    return {
      status: Status.SUCCESS,
      message: '(notifyUsers) Successfully added new mail to database',
    };
  } catch (err: any) {
    return {
      status: Status.ERROR,
      message: `(notifyUsers) Error: ${err.message}`,
    };
  }
};

/**
 * Notify specific users with a new mail.
 *
 * @param {string[]} receivers - The user IDs of the receivers.
 * @param {string} subject - The subject of the mail.
 * @param {string} body - The body of the mail.
 * @param {Items[]} items - The items attached to the mail.
 * @param {MailType} type - The type of mail.
 * @returns {Promise<ReturnValue>}
 * @example notifySpecificUser(receivers, subject, body, items, type): Promise<ReturnValue> => {
 *  return {
 *    status: Status.SUCCESS,
 *    message: "(notifySpecificUser) Successfully added new mail to database",
 *  }
 * }
 */
export const notifySpecificUser = async (
  receivers: string[],
  subject: string,
  body: string,
  items: Items[],
  type: MailType
): Promise<ReturnValue> => {
  const receiverList: ReceiverStatus[] = receivers.map((receiver) => ({
    _id: receiver,
    isRead: { status: false, timestamp: new Date() },
    isClaimed: { status: false, timestamp: new Date() },
    isDeleted: { status: false, timestamp: new Date() },
  }));

  try {
    await createMail({ receivers: receiverList, subject, body, items, type });
    return {
      status: Status.SUCCESS,
      message: '(notifySpecificUser) Successfully added new mail to database',
    };
  } catch (err: any) {
    return {
      status: Status.ERROR,
      message: `(notifySpecificUser) Error: ${err.message}`,
    };
  }
};

export const getAllMailsByUserId = async (userId: string): Promise<ReturnValue<Mail[]>> => {
  /**
   * Retrieves all mail by a specific user ID.
   * 
   * @param {string} userId - The ID of the user.
   * @returns {Promise<ReturnValue<Mail[]>>} - A promise with a ReturnValue object which contains an array of mail objects.
   * @example getAllMailsByUserId(userId): Promise<ReturnValue<Mail[]>> => {
   *  return {
   *    status: Status.SUCCESS,
   *    message: '(getAllMailsByReceiverId) Successfully retrieved mails',
   *    data: [Mail]
   *  }
   * }
   */
  if (!userId) {
    return {
      status: Status.BAD_REQUEST,
      message: '(getAllMailsByReceiverId) Receiver ID is required',
    };
  }

  try {
    const mails = await MailModel.find({ receiverId:{
      receiverIds: { 
        $elemMatch: { _id: userId } 
      }
    } }).lean();
    return {
      status: Status.SUCCESS,
      message: '(getAllMailsByReceiverId) Successfully retrieved mails',
      data: mails,
    };
  } catch (err: any) {
    return {
      status: Status.ERROR,
      message: `(getAllMailsByReceiverId) Error: ${err.message}`,
    };
  }
};
