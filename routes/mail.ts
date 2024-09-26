import express from 'express';
import { authMiddleware } from '../middlewares/auth';
import {
  readMail,
  claimMail,
  deleteMail,
  notifyUsers,
  getEmailById,
  readAllMails,
  claimAllMails,
  updateMailStatus,
  notifySpecificUser,
  getAllMailsByUserId,
  getAllMailsByUserIdWithPagination,
} from '../api/mail';
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
router.get('/get_unread_mails/:userId', async (req, res) => {
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
router.get('/get_mails/:userId', async (req, res) => {
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


    const { status, message, data, meta } = await getAllMailsByUserIdWithPagination(userId, page, limit);
    return res.status(status).json({
      status,
      message,
      data,
      meta
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
router.post('/read_mail', async (req, res) => {
  const { mailId, userId } = req.body;
  if (!mailId || !userId) {
    return res.status(Status.BAD_REQUEST).json({
      status: Status.BAD_REQUEST,
      message: '(readMail) Error: mailId and userId are required'
    })
  }
  try {

    const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'read_mail');

    if (validateStatus !== Status.SUCCESS) {
      return res.status(validateStatus).json({
        status: validateStatus,
        message: validateMessage
      })
    }

    const { status, message } = await readMail(mailId, userId);
    return res.status(status).json({
      status,
      message
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 500,
      message:`(readMail) Error: ${err.message}` 
    })
  }
})

// delete mail
router.post('/delete_mail', async (req, res) => {
  const { mailId, userId } = req.body;

  if (!mailId || !userId) {
    return res.status(Status.BAD_REQUEST).json({
      status: Status.BAD_REQUEST,
      message: '(deleteMail) Error: mailId and userId are required'
    })
  }

  try {

    const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'delete_mail');

    if (validateStatus !== Status.SUCCESS) {
      return res.status(validateStatus).json({
        status: validateStatus,
        message: validateMessage
      })
    }

    const { status, message } = await deleteMail(mailId, userId);
    return res.status(status).json({
      status,
      message
    });
  } catch (err: any) {
    return res.status(Status.ERROR).json({
      status: Status.ERROR,
      message: `(deleteMail) Error: ${err.message}`
    })
  }
})

// claim mail
router.post('/claim_mail', async (req, res) => {
  const { mailId, userId } = req.body;

  if (!mailId || !userId) {
    return res.status(Status.BAD_REQUEST).json({
      status: Status.BAD_REQUEST,
      message: '(claimMail) Error: mailId and userId are required'
    })
  }

  try {

    const { status: validateStatus, message: validateMessage, data: validateData } = await validateRequestAuth(req, res, 'claim_mail');

    if (validateStatus !== Status.SUCCESS) {
      return res.status(validateStatus).json({
        status: validateStatus,
        message: validateMessage
      })
    }

    const { status, message } = await claimMail(mailId, userId);
    return res.status(status).json({
      status,
      message
    });
  } catch (err: any) {
    return res.status(500).json({
      status: 500,
      message: `(claimMail) Error: ${err.message}`
    })
  }
})

// read all mail
router.post('/read_all_mail', async (req, res) => {
  const { userId } = req.body;
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
router.post('/claim_all_mail', async (req, res) => {
  const { userId } = req.body;
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
router.post('/delete_all_mail', async (req, res) => {
  const { userId } = req.body;
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