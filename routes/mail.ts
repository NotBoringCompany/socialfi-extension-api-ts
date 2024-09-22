import express from 'express';
import { authMiddleware } from '../middlewares/auth';
import { claimAllMails, getAllMailsByUserId, getAllMailsByUserIdWithPagination, getEmailById, notifySpecificUser, notifyUsers, readAllMails } from '../api/mail';
import { Status } from '../utils/retVal';
import { validateRequestAuth } from '../utils/auth';
const router = express.Router();

// notify users
router.post('/notify_users', authMiddleware(3), async (req, res) => {
  try {
    const { subject, body, items, type, expiredDate } = req.body;
    const { status, message } = await notifyUsers(subject, body, items, type, expiredDate);
    return res.status(status).json({
      status,
      message
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 500,
      message: err.message
    })
  }
})

// notify specific user
router.post('/notify_specific_user', authMiddleware(3), async (req, res) => {
  try {
    const { receivers, subject, body, items, type, expiredDate } = req.body;
    const { status, message } = await notifySpecificUser(receivers, subject, body, items, type, expiredDate);
    return res.status(status).json({
      status,
      message
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 500,
      message: err.message
    })
  }
})

// get all unread mails by user id
router.get('/get_unread_mails/:userId',  async (req, res) => {
  const { userId } = req.params;
  try {

    const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'get_unread_mails');

    if (validateStatus !== Status.SUCCESS) {
        return res.status(validateStatus).json({
            status: validateStatus,
            message: validateMessage
        })
    }

    const { status, message, data } = await getAllMailsByUserId(userId);
    return res.status(status).json({
      status,
      message,
      data
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 500,
      message: err.message
    })
  }
})

/** 
 * get all mails with pagination
 * @example get_mails/:userId?page=1&limit=10
*/
router.get('/get_mails/:userId',  async (req, res) => {
  const { userId } = req.params;

  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;

  try {

    const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'get_mails');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage
            })
        }


    const { status, message, data } = await getAllMailsByUserIdWithPagination(userId, page, limit);
    return res.status(status).json({
      status,
      message,
      data
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 500,
      message: err.message
    })
  }
})

// read mail 
// todo check user has an email
router.post('/read_mail/:mailId',  async (req, res) => {
  const { mailId } = req.params;
  try {

    const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'read_mail');

    if (validateStatus !== Status.SUCCESS) {
        return res.status(validateStatus).json({
            status: validateStatus,
            message: validateMessage
        })
    }

    const { status, message } = await getEmailById(mailId);
    return res.status(status).json({
      status,
      message
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 500,
      message: err.message
    })
  }
})

// delete mail
router.post('/delete_mail/:mailId',  async (req, res) => {
  const { mailId } = req.params;
  try {

    const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'delete_mail');

    if (validateStatus !== Status.SUCCESS) {
        return res.status(validateStatus).json({
            status: validateStatus,
            message: validateMessage
        })
    }

    const { status, message } = await getEmailById(mailId);
    return res.status(status).json({
      status,
      message
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 500,
      message: err.message
    })
  }
})

// read all mail
router.post('/read_all_mail/:userId',  async (req, res) => {
  const { userId } = req.params;
  try {

    const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'read_all_mail');

    if (validateStatus !== Status.SUCCESS) {
        return res.status(validateStatus).json({
            status: validateStatus,
            message: validateMessage
        })
    }

    const { status, message } = await readAllMails(userId);
    return res.status(status).json({
      status,
      message
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 500,
      message: err.message
    })
  }
})

// claim all mail
router.post('/claim_all_mail/:userId',  async (req, res) => {
  const { userId } = req.params;
  try {

    const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'claim_all_mail');

    if (validateStatus !== Status.SUCCESS) {
        return res.status(validateStatus).json({
            status: validateStatus,
            message: validateMessage
        })
    }

    const { status, message } = await claimAllMails(userId);
    return res.status(status).json({
      status,
      message
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 500,
      message: err.message
    })
  }
})

// delete all mail
router.post('/delete_all_mail/:userId',  async (req, res) => {
  const { userId } = req.params;
  try {

    const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'delete_all_mail');

    if (validateStatus !== Status.SUCCESS) {
        return res.status(validateStatus).json({
            status: validateStatus,
            message: validateMessage
        })
    }

    const { status, message } = await readAllMails(userId);
    return res.status(status).json({
      status,
      message
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 500,
      message: err.message
    })
  }
})


export default router