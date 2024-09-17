import express from 'express';
import { addBan, getBanById, getBanByUserId, getBans, updateBan } from '../api/ban';
import { authMiddleware } from '../middlewares/auth';
const router = express.Router();

/**
 * Get all bans
 * 
 * @returns {Promise<Response>} status 200 with ban data, or status 500 with error message
 */
router.get('/',
  // authMiddleware(3),
  async (req, res) => {
    try {
      const { status, message, data } = await getBans();
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
 * Get ban by id
 * 
 * @param {string} banId
 * @returns {Promise<Response>} status 200 with ban data, or status 500 with error message
 */
router.get('/:banId',
  // authMiddleware(3),
  async (req, res) => {
    const { banId } = req.params;
    try {
      const { status, message, data } = await getBanById(banId);

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
 * Get ban by user id
 * 
 * @param {string} userId
 * @returns {Promise<Response>} status 200 with ban data, or status 500 with error message
 * this route for protecting page
 */
router.get('/user/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const { status, message, data } = await getBanByUserId(userId);

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
 * Post a ban
 * 
 * @param {string} userId
 * @returns {Promise<Response>} status 200 with ban data, or status 500 with error message
 */
router.post('/',
  // authMiddleware(3),
  async (req, res) => {
    const { userId, reason, startDate, endDate, status: banStatus, banType } = req.body;
    const admin = 'test'; // todo get admin 
    try {
      const { status, message, data } = await addBan(userId, banType, startDate, endDate, reason, admin, banStatus);

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
 * Update a ban
 * 
 * @param {string} banId - The unique ID of the ban
 * @param {BanType} banType - The type of the ban
 * @param {Date} startDate - The timestamp when the ban starts
 * @param {Date} endDate - The timestamp when the ban ends
 * @param {string} reason - The reason for the ban
 * @param {string} admin - The user ID of the admin who banned the user
 * @param {BanStatus} status - The status of the ban
 * @returns {Promise<Response>} status 200 with ban data, or status 500 with error message
 */
router.patch('/:banId',
  // authMiddleware(3),
  async (req, res) => {
    const { banId } = req.params;
    const { reason, status: banStatus, startDate, endDate, banType } = req.body;
    const admin = 'test'; // todo get admin
    try {
      const { status, message, data } = await updateBan(banId, banType, startDate, endDate, reason, admin, banStatus);
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
export default router;