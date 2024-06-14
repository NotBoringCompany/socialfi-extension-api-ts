/**
 * keyMiddleware.ts
 * Middleware to validate API key for incoming requests.
 *
 * Usage:
 * Import this middleware and use it in the routes to protect them with API key validation.
 *
 * import express from 'express';
 * import keyMiddleware from './middleware/keyMiddleware';
 *
 * const router = express.Router();
 *
 * // Apply the middleware to all routes in this router
 * router.use(keyMiddleware);
 *
 * router.post('/some_protected_route', async (req, res) => {
 *     // Your route handler code
 * });
 *
 * export default router;
 */

import { Request, Response, NextFunction } from 'express';

// NOTE: will need to replace the variable from env
const apiKey = 'thisisasecret';

/**
 * Middleware function to check for the presence and validity of the API key.
 */
const keyMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const requestApiKey = req.header('x-api-key');

    if (!requestApiKey || requestApiKey !== apiKey) {
        return res.status(403).json({ status: 403, message: 'Forbidden: Invalid API key' });
    }

    next();
};

export default keyMiddleware;
