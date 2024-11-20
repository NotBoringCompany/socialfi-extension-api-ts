import express from 'express';
import { authMiddleware } from '../middlewares/auth';
import { Status } from '../utils/retVal';
import { claimMail, createMail, deleteAllReadAndClaimedMails, deleteMail, getAllUserMails, readAndClaimAllMails, readMail } from '../api/mail';
import { validateRequestAuth } from '../utils/auth';
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

        // if (!validateData?.twitterId || validateData?.twitterId !== twitterId) {
        //     return res.status(Status.UNAUTHORIZED).json({
        //         status: Status.UNAUTHORIZED,
        //         message: '(get_all_user_mails) Unauthorized'
        //     });
        // }

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
});

router.post('/delete_mail', async (req, res) => {
    const { mailId } = req.body;

    try {
        const {
            status: validateStatus,
            message: validateMessage,
            data: validateData,
        } = await validateRequestAuth(req, res, 'delete_mail');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage,
            });
        }

        const { status, message } = await deleteMail(mailId, validateData?.twitterId);

        return res.status(status).json({
            status,
            message
        });
    } catch (err: any) {
        return res.status(Status.ERROR).json({
            status: Status.ERROR,
            message: err.message
        })
    }
});

router.post('/claim_mail', async (req, res) => {
    const { mailId } = req.body;

    try {
        const {
            status: validateStatus,
            message: validateMessage,
            data: validateData,
        } = await validateRequestAuth(req, res, 'claim_mail');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage,
            });
        }

        const { status, message } = await claimMail(mailId, validateData?.twitterId);

        return res.status(status).json({
            status,
            message
        });
    } catch (err: any) {
        return res.status(Status.ERROR).json({
            status: Status.ERROR,
            message: err.message
        })
    }
})

router.post('/read_mail', async (req, res) => {
    const { mailId } = req.body;

    try {
        const {
            status: validateStatus,
            message: validateMessage,
            data: validateData,
        } = await validateRequestAuth(req, res, 'read_mail');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage,
            });
        }

        const { status, message } = await readMail(mailId, validateData?.twitterId);

        return res.status(status).json({
            status,
            message
        });
    } catch (err: any) {
        return res.status(Status.ERROR).json({
            status: Status.ERROR,
            message: err.message
        })
    }
});

router.post('/read_and_claim_all_mails', async (req, res) => {
    try {
        const {
            status: validateStatus,
            message: validateMessage,
            data: validateData,
        } = await validateRequestAuth(req, res, 'read_and_claim_all_mails');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage,
            });
        }

        const { status, message, data } = await readAndClaimAllMails(validateData?.twitterId);

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

router.post('/delete_all_read_and_claimed_mails', async (req, res) => {
    try {
        const {
            status: validateStatus,
            message: validateMessage,
            data: validateData,
        } = await validateRequestAuth(req, res, 'delete_all_mails');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage,
            });
        }

        const { status, message } = await deleteAllReadAndClaimedMails(validateData?.twitterId);

        return res.status(status).json({
            status,
            message,
        });
    } catch (err: any) {
        return res.status(Status.ERROR).json({
            status: Status.ERROR,
            message: err.message
        })
    }
});

export default router;
