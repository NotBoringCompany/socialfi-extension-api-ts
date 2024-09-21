import { Items, Mail, MailType } from "../models/mail";
import { MailModel, UserModel } from "../utils/constants/db";
import { ReturnValue, Status } from "../utils/retVal";
import { ClientSession, startSession } from 'mongoose'

/**
 * Creates a new mail in the database.
 *
 * @param {string} receiverId - The user ID of the receiver.
 * @param {string} subject - The subject of the mail.
 * @param {string} body - The body of the mail.
 * @param {Items[]} items - The items attached to the mail.
 * @param {MailType} type - The type of mail.
 * @returns {Promise<ReturnValue>}
 * @example createMail(receiverId, subject, body, items, type): Promise<boolean> => {
 * return true
 */
const createMail = async (receiverId: string, subject: string, body: string, items: Items[], type: MailType, session: ClientSession): Promise<boolean> => {
  try {
    const newMail = new MailModel({
      receiverId,
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
 * return {
 *  status: Status.SUCCESS,
 *  message: "(notifyUsers) Successfully added new mail to database",
 }
 */
export const notifyUsers = async (subject: string, body: string, items: Items[], type: MailType): Promise<ReturnValue> => {
  // this session for the transaction to deal with the race condition
  // see https://www.mongodb.com/docs/manual/core/transactions/
  /**
   * why whe are using sessions?
   * because whe want to make sure all seed successful created
   * in my opinion if race condition happens, and some email is not created it should be dosn't create email in the database
   * so this approach it would be save for the race condition
   */
  const session = await startSession();
  try {
    const users = await UserModel.find().lean();
    await Promise.all(users.map((user) => createMail(user._id, subject, body, items, type, session)));
    // if all users are successful, commit the transaction
    await session.commitTransaction();
    // end the session
    await session.endSession();

    return {
      status: Status.SUCCESS,
      message: "(notifyUsers) Successfully added new mail to database",
    };
  } catch (err: any) {
    // if any user fails, abort the transaction
    await session.abortTransaction();
    // end the session
    await session.endSession();
    return {
      status: Status.ERROR,
      message: `(notifyUsers) Error: ${err.message}`,
    };
  }
};

/**
 * Notify a specific user with a new mail.
 *
 * @param {string} receiverId - The user ID of the receiver.
 * @param {string} subject - The subject of the mail.
 * @param {string} body - The body of the mail.
 * @param {Items[]} items - The items attached to the mail.
 * @param {MailType} type - The type of mail.
 * @returns {Promise<ReturnValue>}
 * @example notifySpecificUser(receiverId, subject, body, items, type): Promise<ReturnValue> => {
 * return {
 *  status: Status.SUCCESS,
 *  message: "(notifySpecificUser) Successfully added new mail to database",
 }
 */
export const notifySpecificUser = async (receiverId: string, subject: string, body: string, items: Items[], type: MailType): Promise<ReturnValue> => {
  const session = await startSession();
  try {
    await createMail(receiverId, subject, body, items, type, session);
    await session.commitTransaction();
    await session.endSession();
    return {
      status: Status.SUCCESS,
      message: "(notifySpecificUser) Successfully added new mail to database",
    };
  } catch (err: any) {
    await session.abortTransaction();
    await session.endSession();
    return {
      status: Status.ERROR,
      message: `(notifySpecificUser) Error: ${err.message}`,
    };
  }
};

/**
 * Retrieves all mails sent to a specific user.
 *
 * @param {string} receiverId - The user ID of the receiver.
 * @returns {Promise<ReturnValue<Mail[]>>}
 * @example  {
 *  status: Status.SUCCESS,
 *  message: "(getAllMailsByReceiverId) Successfully retrieved mails",
 *  data: [{
 *      _id: "123",
 *      receiverId: "123",
 *      subject: "test",
 *      body: "test",
 *      items: [],
 *      isRead: false,
 *      timestamp: "2022-01-01T00:00:00.000Z",
 *      type: MailType.OTHER 
 * }],
 */
export const getAllMailsByReceiverId = async (receiverId: string): Promise<ReturnValue<Mail[]>> => {
  try {
    const mails = await MailModel.find({ receiverId }).lean();
    return {
      status: Status.SUCCESS,
      message: "(getAllMailsByReceiverId) Successfully retrieved mails",
      data: mails,
    };
  } catch (err: any) {
    return {
      status: Status.ERROR,
      message: `(getAllMailsByReceiverId) Error: ${err.message}`,
    };
  }
};
