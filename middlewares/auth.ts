import { Request, Response, NextFunction } from 'express';
import { Status } from '../utils/retVal';
import { verifyToken } from '../api/auth';

/**
 * Middleware to verify the token and check user role.
 *
 * @param level Required role level
 * @example
 * router.use('/protected-route', authMiddleware(1), (req, res) => {
 *     res.json({ message: 'You have access to this protected route!' });
 * });
 */
export const authMiddleware = (level: number) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                status: Status.UNAUTHORIZED,
                message: '(verifyToken) No token provided',
            });
        }

        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            return res.status(401).json({
                status: Status.UNAUTHORIZED,
                message: '(verifyToken) Invalid token format',
            });
        }

        const token = parts[1];

        try {
            const { data } = await verifyToken(token);
            const { creds } = data;

            // Ensure the role is authorized based on the provided level
            if (creds.role < level) {
                return res.status(403).json({
                    status: 403,
                    message: '(verifyToken) Insufficient role level',
                });
            }

            // Store credentials and role in request locals
            res.locals.creds = creds;
            res.locals.role = creds.role;

            next();
        } catch (err) {
            return res.status(500).json({
                status: Status.ERROR,
                message: `(verifyToken) ${err.message}`,
            });
        }
    };
};
