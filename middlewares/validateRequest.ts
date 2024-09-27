import {Request, Response, NextFunction} from 'express';
import {  Status } from '../utils/retVal';
import { validateRequestAuth } from '../utils/auth';
/**
 * this approach to make router more flexible
 * and looks cleaner
 * @param router router path
 * @returns if success then next, else return error
 * @example: router.post('/signup', validateRequestAuthV2('signup'))
 */
export const validateRequestAuthV2 = (router:string) =>{
  return async (req: Request, res: Response, next: NextFunction) => {
    const { status, message, data } = await validateRequestAuth(req, res, router);
    if (status === Status.SUCCESS) {
      req.body.twitterId = data?.twitterId;
      next();
    } else {
      res.status(status).json({
        status,
        message
      });
    }
  }
}