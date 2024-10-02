import express from 'express';
import { authMiddleware } from '../middlewares/auth';
import { Status } from '../utils/retVal';
import { createMail, getAllUserMails } from '../api/mail';
import { validateRequestAuth } from '../utils/auth';
// import { authMiddleware } from '../middlewares/auth';
// import {
//   readMail,
//   claimMail,
//   deleteMail,
//   notifyUsers,
//   getEmailById,
//   readAllMails,
//   claimAllMails,
//   updateMailStatus,
//   notifySpecificUser,
//   getAllMailsByUserId,
//   getAllMailsByUserIdWithPagination,
// } from '../api/mail';
// import { Status } from '../utils/retVal';
// import { validateRequestAuthV2 } from '../middlewares/validateRequest';
const router = express.Router();

router.post('/create_mail', authMiddleware(3), async (req, res) => {
    const { mailType, receivers, includeNewUsers, subject, body, attachments, expiryTimestamp, receiverIds } = req.body;

    try {
        const { status, message, data } = await createMail(mailType, receivers, includeNewUsers, subject, body, attachments, expiryTimestamp, receiverIds);
        
        return res.status(status).json({
            status,
            message,
            data
        });
    } catch (err: any) {
        return res.status(Status.ERROR).json({
            status: Status.ERROR,
            message: err.message
        })
    }
});

router.get('/get_all_user_mails/:twitterId/:page/:limit', async (req, res) => {
    const { twitterId, page, limit } = req.params;

    try {
        const {
            status: validateStatus,
            message: validateMessage,
            data: validateData,
        } = await validateRequestAuth(req, res, 'get_all_user_mails');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage,
            });
        }

        if (!validateData?.twitterId || validateData?.twitterId !== twitterId) {
            return res.status(Status.UNAUTHORIZED).json({
                status: Status.UNAUTHORIZED,
                message: '(get_all_user_mails) Unauthorized'
            });
        }

        const { status, message, data } = await getAllUserMails(validateData?.twitterId, parseInt(page), parseInt(limit));

        return res.status(status).json({
            status,
            message,
            data
        });
    } catch (err: any) {
        return res.status(Status.ERROR).json({
            status: Status.ERROR,
            message: err.message
        })
    }
})

export default router;