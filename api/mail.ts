import { ClientSession } from 'mongoose';
import { MailAttachment, MailDTO, MailType } from '../models/mail';
import { MailModel, MailReceiverDataModel, UserModel } from '../utils/constants/db';
import { generateObjectId } from '../utils/crypto';
import { ReturnValue, Status } from '../utils/retVal';
import { Food } from '../models/food';
import { Item } from '../models/item';
import { resources } from '../utils/constants/resource';
import { ExtendedResource, ExtendedResourceOrigin } from '../models/resource';
import { MAIL_PURGE_QUEUE } from '../utils/mail';

/**
 * Creates a mail instance and saves it to the database.
 * 
 * Also sends the mail to the users and stores them in the `MailReceiverData` collection.
 */
export const createMail = async (
  /** the type of mail */
  type: MailType,
  /** whether the mail is sent to all users or specific users */
  receivers: 'all' | 'specific',
  /** if this mail should be sent to newly registered users (before the mail expires) */
  includeNewUsers: boolean,
  /** the subject of the mail */
  subject: string,
  /** the body of the mail */
  body: string,
  /** the attachments of the mail */
  attachments: MailAttachment[],
  /**  when the mail expires (unless never) */
  expiryTimestamp: number | 'never',
  /** IF `receivers` is 'specific', this field is required */
  receiverIds?: string[],
  session?: ClientSession
): Promise<ReturnValue> => {
  try {
    const newMail = new MailModel({
      _id: generateObjectId(),
      mailType: type,
      receiverOptions: {
        receivers,
        includeNewUsers
      },
      subject,
      body,
      attachments,
      sentTimestamp: Math.floor(Date.now() / 1000),
      expiryTimestamp
    });

    await newMail.save();

    // if receivers is `all`, fetch all users and get their IDs. else, use the provided IDs
    const finalReceiverIds =
      receivers === 'all'
        ? (await UserModel.find().lean()).map((user) => user._id)
        : receiverIds;

    const mailReceiverData = finalReceiverIds.map(userId => ({
      userId,
      mailId: newMail._id,
      readStatus: { status: false, timestamp: 0 },
      claimedStatus: { status: false, timestamp: 0 },
      deletedStatus: { status: false, timestamp: 0 }
    }))

    await MailReceiverDataModel.insertMany(mailReceiverData);

    // if mail has an expiry timestamp, add it to the queue for purging
    if (expiryTimestamp !== 'never') {
      await MAIL_PURGE_QUEUE.add(
        'purgeMail', 
        { mailId: newMail._id }, 
        { delay: expiryTimestamp * 1000 - Date.now() }
      );
    }

    return {
      status: Status.SUCCESS,
      message: '(createMail) Successfully added new mail to database and sent to users in MailReceiverData.',
    }
  } catch (err: any) {
    return {
      status: Status.ERROR,
      message: `(createMail) Error: ${err.message}`,
    }
  }
}

/**
 * Retrieves all mails that are NOT marked deleted sent to a specific user with pagination (sorted by sent timestamp).
 * 
 * NOTE: `limit` CANNOT be greater than 20 per page.
 * 
 * Usage: Say `page` is 2 and `limit` is 20. This means that the function will skip the first 20 mails and return the next 20 mails.
 */
export const getAllUserMails = async (twitterId: string, page: number, limit: number): Promise<ReturnValue> => {
  // if page is NaN or less than 1, throw an error.
  // if limit is NaN or less than 1 OR greater than 20, throw an error.
  if (isNaN(page) || page < 1) {
    return {
      status: Status.ERROR,
      message: '(getAllUserMails) Page must be a number greater than 0.',
    }
  }

  if (isNaN(limit) || limit < 1 || limit > 20) {
    return {
      status: Status.ERROR,
      message: '(getAllUserMails) Limit must be a number between 1 and 20.',
    }
  }

  try {
    const user = await UserModel.findOne({ twitterId }).lean();

    if (!user) {
      return {
        status: Status.ERROR,
        message: `(getAllUserMails) User with Twitter ID ${twitterId} not found`,
      }
    }

    // find those not marked deleted
    const mailReceiverData = await MailReceiverDataModel.find({ userId: user._id, 'deletedStatus.status': false }).lean();

    // fetch total mail count for pagination calculation
    const totalCount = await MailModel.countDocuments({ _id: { $in: mailReceiverData.map(mail => mail.mailId) } });

    // fetch the mails using the mail IDs
    const mailIds = mailReceiverData.map(mail => mail.mailId);

    const mails = await MailModel.find({ _id: { $in: mailIds } }).sort({ sentTimestamp: -1 }).skip((page - 1) * limit).limit(limit).lean();

    const mailDTOs: MailDTO[] = mails.map(mail => ({
      _id: mail._id,
      mailType: mail.mailType,
      receiverOptions: mail.receiverOptions,
      subject: mail.subject,
      body: mail.body,
      attachments: mail.attachments,
      sentTimestamp: mail.sentTimestamp,
      expiryTimestamp: mail.expiryTimestamp,
      readStatus: mailReceiverData.find(data => data.mailId === mail._id)?.readStatus,
      claimedStatus: mailReceiverData.find(data => data.mailId === mail._id)?.claimedStatus,
      deletedStatus: mailReceiverData.find(data => data.mailId === mail._id)?.deletedStatus
    }));

    // Calculate next page
    const totalPages = Math.ceil(totalCount / limit);
    const nextPage = page < totalPages ? page + 1 : null;

    return {
      status: Status.SUCCESS,
      message: '(getAllUserMails) Successfully retrieved mails.',
      data: {
        mailDTOs: mailDTOs,
        mailInfo: {
          totalCount: totalCount,
          totalPages: totalPages,
          nextPage: nextPage,
        }
      }
    }
  } catch (err: any) {
    return {
      status: Status.ERROR,
      message: `(getAllUserMails) Error: ${err.message}`,
    }
  }
}

/**
 * Deletes a mail for a specific user.
 * 
 * NOTE: If this mail still has claimable attachments/rewards, an error will be thrown.
 */
export const deleteMail = async (mailId: string, twitterId: string): Promise<ReturnValue> => {
  try {
    const user = await UserModel.findOne({ twitterId }).lean();

    if (!user) {
      return {
        status: Status.ERROR,
        message: `(deleteMail) User with Twitter ID ${twitterId} not found`,
      }
    }

    const userId = user._id;

    const mail = await MailReceiverDataModel.findOne({ mailId, userId }).lean();

    if (!mail) {
      return {
        status: Status.ERROR,
        message: `(deleteMail) Mail ID ${mailId} not found for user with ID ${userId}`,
      }
    }

    // if the mail is already deleted, return an error
    if (mail.deletedStatus.status) {
      return {
        status: Status.ERROR,
        message: `(deleteMail) Mail ID ${mailId} already deleted for user with ID ${userId}`,
      }
    }

    // if the mail has attachments and has NOT been claimed, return an error
    const mailData = await MailModel.findOne({ _id: mailId }).lean();

    if (mailData.attachments.length && !mail.claimedStatus.status) {
      return {
        status: Status.ERROR,
        message: `(deleteMail) Mail ID ${mailId} has attachments and has not been claimed for user with ID ${userId}`,
      }
    }

    // instead of deleting the data from the database, we just mark it as deleted.
    // the mail will be purged eventually.
    await MailReceiverDataModel.updateOne({ mailId, userId }, {
      $set: {
        'deletedStatus.status': true,
        'deletedStatus.timestamp': Math.floor(Date.now() / 1000)
      }
    });

    return {
      status: Status.SUCCESS,
      message: '(deleteMail) Successfully marked mail as deleted.',
    }
  } catch (err: any) {
    return {
      status: Status.ERROR,
      message: `(deleteMail) Error: ${err.message}`,
    }
  }
}

/**
 * Claims a mail for a specific user. If not yet marked as `read`, it will be marked as `read`.
 * 
 * This will only be possible if the mail has attachments.
 */
export const claimMail = async (mailId: string, twitterId: string): Promise<ReturnValue> => {
  try {
    const user = await UserModel.findOne({ twitterId }).lean();

    if (!user) {
      return {
        status: Status.ERROR,
        message: `(claimMail) User with Twitter ID ${twitterId} not found`,
      }
    }

    const userId = user._id;

    const mail = await MailReceiverDataModel.findOne({ mailId, userId }).lean();

    if (!mail) {
      return {
        status: Status.ERROR,
        message: `(claimMail) Mail ID ${mailId} not found for user with ID ${userId}`,
      }
    }

    if (!user) {
      return {
        status: Status.ERROR,
        message: `(claimMail) User with ID ${userId} not found`,
      }
    }

    // if the mail is already claimed, return an error
    if (mail.claimedStatus.status) {
      return {
        status: Status.ERROR,
        message: `(claimMail) Mail ID ${mailId} already claimed for user with ID ${userId}`,
      }
    }

    // if the mail has no attachments, return an error
    const mailData = await MailModel.findOne({ _id: mailId }).lean();

    if (!mailData.attachments.length) {
      return {
        status: Status.ERROR,
        message: `(claimMail) Mail ID ${mailId} has no attachments to claim for user with ID ${userId}`,
      }
    }

    const userUpdateOperations = {
      $pull: {},
      $inc: {},
      $set: {},
      $push: {}
    };

    const mailReceiverDataUpdateOperations = {
      $set: {}
    }

    // initialize $each on the user's inventory items, foods and/or resources.
    if (!userUpdateOperations.$push['inventory.items']) {
      userUpdateOperations.$push['inventory.items'] = { $each: [] }
  }

  if (!userUpdateOperations.$push['inventory.foods']) {
      userUpdateOperations.$push['inventory.foods'] = { $each: [] }
  }

  if (!userUpdateOperations.$push['inventory.resources']) {
      userUpdateOperations.$push['inventory.resources'] = { $each: [] }
  }

    // claim the mail and give the user the rewards.
    for (const attachment of mailData.attachments) {
      const type = attachment.type;

      if (type === 'food') {
        // add the food to the user's inventory
        // firstly, check if the food already exists in the user's inventory
        const existingFoodIndex = (user.inventory?.foods as Food[]).findIndex((food) => food.type === attachment.name);

        if (existingFoodIndex !== -1) {
          userUpdateOperations.$inc[`inventory.foods.${existingFoodIndex}.amount`] = attachment.amount;
        } else {
          userUpdateOperations.$push['inventory.foods'].$each.push({ 
            type: attachment.name, 
            amount: attachment.amount,
            mintableAmount: 0,
          });
        }
      } else if (type === 'item') {
        // add the item to the user's inventory
        // firstly, check if the item already exists in the user's inventory
        const existingItemIndex = (user.inventory?.items as Item[]).findIndex((item) => item.type === attachment.name);

        if (existingItemIndex !== -1) {
          userUpdateOperations.$inc[`inventory.items.${existingItemIndex}.amount`] = attachment.amount;
        } else {
          userUpdateOperations.$push['inventory.items'].$each.push({ 
            type: attachment.name, 
            amount: attachment.amount,
            totalAmountConsumed: 0,
            weeklyAmountConsumed: 0,
            mintableAmount: 0,
          });
        }
      } else if (type === 'resource') {
        // get the resource data
        const resourceData = resources.find((resource) => resource.type === attachment.name);

        if (!resourceData) {
          return {
            status: Status.ERROR,
            message: `(claimMail) Resource ${attachment.name} not found in resources list`,
          }
        }

        // check if the resource already exists in the user's inventory
        const existingResourceIndex = (user.inventory?.resources as ExtendedResource[]).findIndex((resource) => resource.type === attachment.name);

        // if the resource already exists, increment the amount
        if (existingResourceIndex !== -1) {
          userUpdateOperations.$inc[`inventory.resources.${existingResourceIndex}.amount`] = attachment.amount;
        } else {
          // else, push the new resource to the user's inventory
          userUpdateOperations.$push['inventory.resources'].$each.push({ 
            ...resourceData,
            amount: attachment.amount,
            origin: ExtendedResourceOrigin.NORMAL,
            mintableAmount: 0,
          });
        }
      } else if (type === 'xCookies') {
        // increment the user's xCookies via inventory.xCookieData.currentXCookies
        userUpdateOperations.$inc['inventory.xCookieData.currentXCookies'] = attachment.amount;
      } else {
        // unknown attachment type for now. throw an error.
        return {
          status: Status.ERROR,
          message: `(claimMail) Unknown attachment type: ${type}`,
        }
      }
    }

    // mark the mail as claimed. if not yet read somehow, mark it as read.
    mailReceiverDataUpdateOperations.$set['claimedStatus.status'] = true;
    mailReceiverDataUpdateOperations.$set['claimedStatus.timestamp'] = Math.floor(Date.now() / 1000);

    if (!mail.readStatus.status) {
      mailReceiverDataUpdateOperations.$set['readStatus.status'] = true;
      mailReceiverDataUpdateOperations.$set['readStatus.timestamp'] = Math.floor(Date.now() / 1000);
    }

    // simultaneously, update the user's inventory with the rewards (divide $inc + $set and $push + $pull operations)
    await Promise.all([
      UserModel.updateOne({ _id: userId }, {
        $set: userUpdateOperations.$set,
        $inc: userUpdateOperations.$inc,
      }),
      MailReceiverDataModel.updateOne({ mailId, userId }, mailReceiverDataUpdateOperations)
    ]);

    await UserModel.updateOne({ _id: userId }, {
      $push: userUpdateOperations.$push,
      $pull: userUpdateOperations.$pull
    });

    return {
      status: Status.SUCCESS,
      message: '(claimMail) Successfully claimed mail and added rewards to user inventory.',
    }
  } catch (err: any) {
    return {
      status: Status.ERROR,
      message: `(claimMail) Error: ${err.message}`,
    }
  }
}

/**
 * Marks a mail as read for a specific user.
 */
export const readMail = async (mailId: string, twitterId: string): Promise<ReturnValue> => {
  try {
    const user = await UserModel.findOne({ twitterId }).lean();

    if (!user) {
      return {
        status: Status.ERROR,
        message: `(readMail) User with Twitter ID ${twitterId} not found`,
      }
    }

    const userId = user._id;

    const mail = await MailReceiverDataModel.findOne({ mailId, userId }).lean();

    if (!mail) {
      return {
        status: Status.ERROR,
        message: `(readMail) Mail ID ${mailId} not found for user with ID ${userId}`,
      }
    }

    // if the mail is already read, return an error
    if (mail.readStatus.status) {
      return {
        status: Status.ERROR,
        message: `(readMail) Mail ID ${mailId} already read for user with ID ${userId}`,
      }
    }

    // mark the mail as read
    await MailReceiverDataModel.updateOne({ mailId, userId }, {
      $set: {
        'readStatus.status': true,
        'readStatus.timestamp': Math.floor(Date.now() / 1000)
      }
    });

    return {
      status: Status.SUCCESS,
      message: '(readMail) Successfully marked mail as read.',
    }
  } catch (err: any) {
    return {
      status: Status.ERROR,
      message: `(readMail) Error: ${err.message}`,
    }
  }
}

/**
 * Finds all unclaimed and unread mails for a specific user and claim any rewards, also marking them as read.
 */
export const readAndClaimAllMails = async (twitterId: string): Promise<ReturnValue> => {
  try {
    // initialize claimedAttachments data
    const claimedAttachments: MailAttachment[] = [];
    
    const user = await UserModel.findOne({ twitterId }).lean();

    if (!user) {
      return {
        status: Status.ERROR,
        message: `(readAndClaimAllMails) User with Twitter ID ${twitterId} not found`,
      }
    }

    const userId = user._id;

    // fetch all unclaimed and undeleted mailReceiverData based on userId
    const mailReceiverData = await MailReceiverDataModel.find({ userId, $or: [ { "claimedStatus.status": false }, { "deletedStatus.status": false } ] }).lean();

    if (mailReceiverData.length === 0) {
      return {
        status: Status.SUCCESS,
        message: '(readAndClaimAllMails) No available mails to read and/or claim.',
        data: {
          claimedAttachments: claimedAttachments
        }
      }
    }

    const mailIds = mailReceiverData.map(mail => mail.mailId);

    const mails = await MailModel.find({ _id: { $in: mailIds } }).lean();

    // filter the data with these requirements:
    // 1. for mails without attachment, check unread status.
    // 2. for mails with attachment, check unclaimed status regardless of read state.
    const filteredMails = mails.filter(mail => {
      const mailData = mailReceiverData.find(data => data.mailId === mail._id);

      // for mails without attachments, return if the mail is unread
      if (!mail.attachments || mail.attachments.length === 0) {
        return !mailData.readStatus.status;
      } 
      // for mails with attachments, return if the mail is unclaimed
      else {
        return !mailData.claimedStatus.status;
      }
    });

    if (filteredMails.length === 0) {
      return {
        status: Status.SUCCESS,
        message: '(readAndClaimAllMails) No available filtered mails to read and/or claim.',
        data: {
          claimedAttachments: claimedAttachments
        }
      }
    }

    const userUpdateOperations = {
      $pull: {},
      $inc: {},
      $set: {},
      $push: {}
    };

    const mailReceiverDataUpdateOperations: Array<{
      id: string,
      updateOperations: {
        $set: {}
      }
    }> = [];

    // initialize $each on the user's inventory items, foods and/or resources.
    if (!userUpdateOperations.$push['inventory.items']) {
      userUpdateOperations.$push['inventory.items'] = { $each: [] }
    }

    if (!userUpdateOperations.$push['inventory.foods']) {
      userUpdateOperations.$push['inventory.foods'] = { $each: [] }
    }

    if (!userUpdateOperations.$push['inventory.resources']) {
      userUpdateOperations.$push['inventory.resources'] = { $each: [] }
    }

    for (const mail of filteredMails) {
      // we will check if this mail has attachments. if not, we will just set it as read.
      if (mail.attachments.length === 0) {
        mailReceiverDataUpdateOperations.push({
          id: mail._id,
          updateOperations: {
            $set: {
              'readStatus.status': true,
              'readStatus.timestamp': Math.floor(Date.now() / 1000)
            }
          }
        });
        continue;
      } else {
        // if there are attachments, we will claim the mail and give the user the rewards.
        for (const attachment of mail.attachments) {
          const existingAttachmentIndex = claimedAttachments.findIndex(
            (claimed) => claimed.name === attachment.name
          );
    
          if (existingAttachmentIndex !== -1) {
            // If the attachment already exists, increment the amount
            claimedAttachments[existingAttachmentIndex].amount += attachment.amount;
          } else {
            // If it doesn't exist, push the new attachment
            claimedAttachments.push({ ...attachment });
          }

          // Check attachment type
          const type = attachment.type;

          if (type === 'food') {
            // add the food to the user's inventory
            // firstly, check if the food to be added already exists in the update operations (so we don't override)
            const existingFoodIndexInOps = userUpdateOperations.$push['inventory.foods'].$each.findIndex((food: Food) => food.type === attachment.name);

            // if the food already exists in the update operations, increment the amount (in the update operations, NOT the database)
            if (existingFoodIndexInOps !== -1) {
              userUpdateOperations.$push['inventory.foods'].$each[existingFoodIndexInOps].amount += attachment.amount;
            } else {
              // if not found, then we check if the food already exists in the user's inventory
              const existingFoodIndex = (user.inventory?.foods as Food[]).findIndex((food) => food.type === attachment.name);

              // if the food already exists in the user's inventory, increment the amount
              if (existingFoodIndex !== -1) {
                userUpdateOperations.$inc[`inventory.foods.${existingFoodIndex}.amount`] = attachment.amount;
              } else {
                // else, push the new food to the update operations
                userUpdateOperations.$push['inventory.foods'].$each.push({ 
                  type: attachment.name, 
                  amount: attachment.amount,
                  mintableAmount: 0,
                });
              }
            }
          } else if (type === 'item') {
            // add the item to the user's inventory
            // firstly, check if the item to be added already exists in the update operations (so we don't override)
            const existingItemIndexInOps = userUpdateOperations.$push['inventory.items'].$each.findIndex((item: Item) => item.type === attachment.name);

            // if the item already exists in the update operations, increment the amount (in the update operations, NOT the database)
            if (existingItemIndexInOps !== -1) {
              userUpdateOperations.$push['inventory.items'].$each[existingItemIndexInOps].amount += attachment.amount;
            } else {
              // if not found, then we check if the item already exists in the user's inventory
              const existingItemIndex = (user.inventory?.items as Item[]).findIndex((item) => item.type === attachment.name);

              // if the item already exists in the user's inventory, increment the amount
              if (existingItemIndex !== -1) {
                userUpdateOperations.$inc[`inventory.items.${existingItemIndex}.amount`] = attachment.amount;
              } else {
                // else, push the new item to the update operations
                userUpdateOperations.$push['inventory.items'].$each.push({ 
                  type: attachment.name, 
                  amount: attachment.amount,
                  totalAmountConsumed: 0,
                  weeklyAmountConsumed: 0,
                  mintableAmount: 0,
                });
              }
            }
          } else if (type === 'resource') {
            // get the resource data
            const resourceData = resources.find((resource) => resource.type === attachment.name);

            if (!resourceData) {
              return {
                status: Status.ERROR,
                message: `(readAndClaimAllMails) Resource ${attachment.name} not found in resources list`,
              }
            }

            // check if the resource to be added already exists in the update operations (so we don't override)
            const existingResourceIndexInOps = userUpdateOperations.$push['inventory.resources'].$each.findIndex((resource: ExtendedResource) => resource.type === attachment.name);

            // if the resource already exists in the update operations, increment the amount (in the update operations, NOT the database)
            if (existingResourceIndexInOps !== -1) {
              userUpdateOperations.$push['inventory.resources'].$each[existingResourceIndexInOps].amount += attachment.amount;
            } else {
              // if not found, then we check if the resource already exists in the user's inventory
              const existingResourceIndex = (user.inventory?.resources as ExtendedResource[]).findIndex((resource) => resource.type === attachment.name);

              // if the resource already exists in the user's inventory, increment the amount
              if (existingResourceIndex !== -1) {
                userUpdateOperations.$inc[`inventory.resources.${existingResourceIndex}.amount`] = attachment.amount;
              } else {
                // else, push the new resource to the update operations
                userUpdateOperations.$push['inventory.resources'].$each.push({ 
                  ...resourceData,
                  amount: attachment.amount,
                  origin: ExtendedResourceOrigin.NORMAL,
                  mintableAmount: 0,
                });
              }
            }
          } else if (type === 'xCookies') {
            // check if the xCookies to be added already exists in the update operations (so we don't override)
            const existingXCookiesInOps = userUpdateOperations.$inc['inventory.xCookieData.currentXCookies'];

            // if the xCookies already exists in the update operations, increment the amount (in the update operations, NOT the database)
            if (existingXCookiesInOps) {
              userUpdateOperations.$inc['inventory.xCookieData.currentXCookies'] += attachment.amount;
            } else {
              // if not found, then increment the xCookies in the update operations
              userUpdateOperations.$inc['inventory.xCookieData.currentXCookies'] = attachment.amount;
            }
          } else {
            // unknown attachment type for now. simply skip this attachment.
            continue;
          }
        }
      }

      // Update read & claim status into true as well as updating each state timestamp.
      mailReceiverDataUpdateOperations.push({
        id: mail._id,
        updateOperations: {
          $set: {
            'readStatus.status': true,
            'readStatus.timestamp': Math.floor(Date.now() / 1000),
            'claimedStatus.status': mail.attachments.length > 0,
            'claimedStatus.timestamp': mail.attachments.length > 0 ? Math.floor(Date.now() / 1000) : 0
          }
        }
      });
    }

    const mailBatchUpdateOps = mailReceiverDataUpdateOperations.map(async ({ id, updateOperations }) => {
      return MailReceiverDataModel.updateOne({ mailId: id, userId }, updateOperations);
    })

    // simultaneously, update the user's inventory with the rewards (divide $inc + $set and $push + $pull operations)
    await Promise.all([
      UserModel.updateOne({ _id: userId }, {
        $set: userUpdateOperations.$set,
        $inc: userUpdateOperations.$inc,
      }),
      ...mailBatchUpdateOps
    ]);

    await UserModel.updateOne({ _id: userId }, {
      $push: userUpdateOperations.$push,
      $pull: userUpdateOperations.$pull
    });

    return {
      status: Status.SUCCESS,
      message: '(readAndClaimAllMails) Successfully claimed and read all mails and added rewards to user inventory.',
      data: {
        claimedAttachments: claimedAttachments
      }
    }
  } catch (err: any) {
    return {
      status: Status.ERROR,
      message: `(readAndClaimAllMails) Error: ${err.message}`,
    }
  }
}

/**
 * Marks all mails that have been read and claimed as deleted for a specific user.
 * 
 * NOTE: For `read` mails, if they have unclaimed rewards, they will NOT be deleted. Only `read` mails without attachments AND `claimed` mails will be deleted.
 */
export const deleteAllReadAndClaimedMails = async (twitterId: string): Promise<ReturnValue> => {
  try {
    const user = await UserModel.findOne({ twitterId }).lean();

    if (!user) {
      return {
        status: Status.ERROR,
        message: `(deleteAllMails) User with Twitter ID ${twitterId} not found`,
      }
    }

    const userId = user._id;

    // find those marked read first.
    const mailReceiverData = await MailReceiverDataModel.find({ userId, 'readStatus.status': true }).lean();

    if (mailReceiverData.length === 0) {
      return {
        status: Status.SUCCESS,
        message: '(deleteAllMails) No mails found to delete.',
      }
    }

    // then, among these, check which ones have attachments.
    const mailIds = mailReceiverData.map(mail => mail.mailId);

    const mails = await MailModel.find({ _id: { $in: mailIds } }).lean();

    // only delete these:
    // 1. mails that have no attachments and are read (which is the default search query)
    // 2. mails that have attachments and have been claimed.
    // mails that have attachments but have not been claimed will not be deleted (will be skipped)
    const mailsToDelete = mails.filter(mail => {
      const mailData = mailReceiverData.find(data => data.mailId === mail._id);

      if (!mail.attachments.length) {
        return mailData.readStatus.status;
      } else {
        return mailData.readStatus.status && mailData.claimedStatus.status;
      }
    });

    const mailIdsToDelete = mailsToDelete.map(mail => mail._id);

    // mark all mails as deleted
    await MailReceiverDataModel.updateMany({ mailId: { $in: mailIdsToDelete }, userId }, {
      $set: {
        'deletedStatus.status': true,
        'deletedStatus.timestamp': Math.floor(Date.now() / 1000)
      }
    });

    return {
      status: Status.SUCCESS,
      message: '(deleteAllMails) Successfully marked all read and claimed mails as deleted.',
    }
  } catch (err: any) {
    return {
      status: Status.ERROR,
      message: `(deleteAllMails) Error: ${err.message}`,
    }
  }
}

/**
 * Purge all expired mails.
 * 
 * NOTE: The main function is done in Bull and Redis. This function is just a backup which will be called in a daily scheduler.
 */
export const purgeExpiredMails = async (): Promise<void> => {
  try {
    await MailModel.deleteMany({ expiryTimestamp: { $lt: Math.floor(Date.now() / 1000) } });

    // also delete the mail receiver data for the purged mails
    // NOTE: because at this point the mails have already been deleted,
    // we use `$nin` to find all mail receiver data whose mail ID is NOT in the list of mail IDs (which have been deleted)
    await MailReceiverDataModel.deleteMany({ mailId: { $nin: (await MailModel.find().lean()).map(mail => mail._id) } });

    console.log('(purgeExpiredMails) Successfully purged all expired mails.');
  } catch (err: any) {
    console.error(`(purgeExpiredMails) Error: ${err.message}`);
  }
}

/**
 * Upon account registration, create a `MailReceiverData` for all active mails that have the `receiverOptions.receivers === 'all'` option for the user.
 */
export const sendMailsToNewUser = async (twitterId: string): Promise<ReturnValue> => {
  try {
    const user = await UserModel.findOne({ twitterId }).lean();

    if (!user) {
      return {
        status: Status.ERROR,
        message: `(sendMailsToNewUser) User with Twitter ID ${twitterId} not found`,
      }
    }

    const userId = user._id;

    // find all mails that are meant for all users with the `includeNewUsers` option set to `true`.
    // NOTE: even if `receivers` is set to `specific`, we will still send the mail to the new user if the `includeNewUsers` option is `true`.
    const mails = await MailModel.find({ 'receiverOptions.includeNewUsers': true }).lean();

    if (mails.length === 0) {
      return {
        status: Status.SUCCESS,
        message: '(sendMailsToNewUser) No mails found to send to new user.',
      }
    }

    const mailReceiverData = mails.map(mail => ({
      userId,
      mailId: mail._id,
      readStatus: { status: false, timestamp: 0 },
      claimedStatus: { status: false, timestamp: 0 },
      deletedStatus: { status: false, timestamp: 0 }
    }));

    await MailReceiverDataModel.insertMany(mailReceiverData);

    return {
      status: Status.SUCCESS,
      message: '(sendMailsToNewUser) Successfully added all mails to new user in MailReceiverData.',
    }
  } catch (err: any) {
    return {
      status: Status.ERROR,
      message: `(sendMailsToNewUser) Error: ${err.message}`,
    }
  }
}