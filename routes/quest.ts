import express from 'express';
import {
    acceptDailyQuest,
    addQuest,
    completeQuest,
    deleteQuest,
    getAcceptedQuest,
    getDailyQuests,
    getQuestProgression,
    getQuests,
    getUserClaimableQuest,
    getUserCompletedQuests,
    getUserQuests,
    updateQuest,
} from '../api/quest';
import { Status } from '../utils/retVal';
import { validateRequestAuth } from '../utils/auth';
import { QuestCategory } from '../models/quest';
import { allowMixpanel, mixpanel } from '../utils/mixpanel';
import { authMiddleware } from '../middlewares/auth';
import { UserWallet } from '../models/user';
import { getMainWallet } from '../api/user';
import { COMPLETE_QUEST_MIXPANEL_EVENT_HASH } from '../utils/constants/mixpanelEvents';
import { WONDERBITS_CONTRACT } from '../utils/constants/web3';
import { QuestDailyQuery, questDailyQuery } from '../validations/quest';
import { POIName } from '../models/poi';

const router = express.Router();

router.post('/add_quest', authMiddleware(3), async (req, res) => {
    const quest = req.body;

    try {
        const { status, message, data } = await addQuest(quest);

        return res.status(status).json({
            status,
            message,
            data,
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message,
        });
    }
});

router.post('/complete_quest', async (req, res) => {
    const { questId } = req.body;

    try {
        const {
            status: validateStatus,
            message: validateMessage,
            data: validateData,
        } = await validateRequestAuth(req, res, 'complete_quest');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage,
            });
        }

        const { status, message, data } = await completeQuest(validateData?.twitterId, questId);

        if (status === Status.SUCCESS && allowMixpanel) {
            mixpanel.track('Complete Quest', {
                distinct_id: validateData?.twitterId,
                _data: data,
            });
        }

        return res.status(status).json({
            status,
            message,
            data,
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message,
        });
    }
});

router.get('/get_quests', async (req, res) => {
    const { category } = req.query;

    try {
        const {
            status: validateStatus,
            message: validateMessage,
            data: validateData,
        } = await validateRequestAuth(req, res, 'get_user_quests');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage,
            });
        }

        const { status, message, data } = await getUserQuests(
            validateData?.twitterId,
            category?.toString() || QuestCategory.SOCIAL
        );

        return res.status(status).json({
            status,
            message,
            data,
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message,
        });
    }
});

router.get('/get_user_quests', async (req, res) => {
    const { category } = req.query;

    try {
        const {
            status: validateStatus,
            message: validateMessage,
            data: validateData,
        } = await validateRequestAuth(req, res, 'get_user_quests');

        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage,
            });
        }

        const { status, message, data } = await getUserQuests(
            validateData?.twitterId,
            category?.toString() || QuestCategory.SOCIAL
        );

        return res.status(status).json({
            status,
            message,
            data,
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message,
        });
    }
});

router.get('/get_quest_detail/:questId', async (req, res) => {
    const { questId } = req.params;

    try {
        const {
            data: validateData,
            status: validateStatus,
            message: validateMessage,
        } = await validateRequestAuth(req, res, 'get_quest_detail');
        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage,
            });
        }

        const { status, message, data } = await getQuestProgression(questId, validateData?.twitterId);

        return res.status(status).json({
            status,
            message,
            data,
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message,
        });
    }
});

router.post('/delete_quest', async (req, res) => {
    const { questId, adminKey } = req.body;

    try {
        const { status, message, data } = await deleteQuest(questId, adminKey);

        return res.status(status).json({
            status,
            message,
            data,
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message,
        });
    }
});

router.get('/get_user_completed_quests/:twitterId', async (req, res) => {
    const { twitterId } = req.params;

    try {
        const { status: validateStatus, message: validateMessage } = await validateRequestAuth(
            req,
            res,
            'get_user_completed_quests'
        );
        if (validateStatus !== Status.SUCCESS) {
            return res.status(validateStatus).json({
                status: validateStatus,
                message: validateMessage,
            });
        }

        const { status, message, data } = await getUserCompletedQuests(twitterId);

        return res.status(status).json({
            status,
            message,
            data,
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message,
        });
    }
});

router.get('/get_user_claimable_quests/:twitterId', async (req, res) => {
    const { twitterId } = req.params;

    try {
        const { status, message, data } = await getUserClaimableQuest(twitterId);

        return res.status(status).json({
            status,
            message,
            data,
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message,
        });
    }
});

router.post('/update_quest/:questId', authMiddleware(3), async (req, res) => {
    const { questId } = req.params;
    const quest = req.body;

    try {
        const { status, message, data } = await updateQuest(questId, quest);

        return res.status(status).json({
            status,
            message,
            data,
        });
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message,
        });
    }
});

/**
 * @route GET /quest/daily_quest
 * @description Retrieves the daily quest based on user's POI location.
 * @param {QuestDailyQuery} req.query - the query request.
 */
router.get('/daily_quest', async (req, res) => {
    try {
        const auth = await validateRequestAuth(req, res, 'daily_quest');
        if (auth.status !== Status.SUCCESS) {
            return res.status(auth.status).json(auth);
        }

        const validation = questDailyQuery.validate(req.query);
        if (validation.status !== Status.SUCCESS) {
            return res.status(validation.status).json(validation);
        }

        const result = await getDailyQuests(auth.data.twitterId, validation.data.poi);

        return res.status(result.status).json(result);
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message,
        });
    }
});

/**
 * @route GET /quest/daily_quest_accepted
 * @description Retrieves user's accepted daily quest.
 */
router.get('/daily_quest_accepted', async (req, res) => {
    try {
        const auth = await validateRequestAuth(req, res, 'daily_quest_accepted');
        if (auth.status !== Status.SUCCESS) {
            return res.status(auth.status).json(auth);
        }

        const result = await getAcceptedQuest(auth.data.twitterId);

        return res.status(result.status).json(result);
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message,
        });
    }
});

/**
 * @route GET /quest/accept_quest/:questId
 * @description Accept the daily quest
 */
router.post('/accept_quest/:questId', async (req, res) => {
    try {
        const { questId } = req.params;

        const auth = await validateRequestAuth(req, res, 'accept_quest');
        if (auth.status !== Status.SUCCESS) {
            return res.status(auth.status).json(auth);
        }

        const result = await acceptDailyQuest(auth.data.twitterId, questId);

        return res.status(result.status).json(result);
    } catch (err: any) {
        return res.status(500).json({
            status: 500,
            message: err.message,
        });
    }
});

export default router;
