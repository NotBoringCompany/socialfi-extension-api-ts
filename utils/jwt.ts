import { JwtPayload, TokenExpiredError, sign, verify } from 'jsonwebtoken'
import { ReturnValue, Status } from './retVal';

/**
 * Generates a JWT token. Parameters are only Twitter login-related for now.
 */
export const generateJWT = (
    twitterId: string, 
    twitterAccessToken: string, 
    twitterRefreshToken: string, 
    twitterExpiresIn: number
) => {
    return sign({ twitterId, twitterAccessToken, twitterRefreshToken, twitterExpiresIn }, process.env.JWT_SECRET, { expiresIn: twitterExpiresIn});
}

/**
 * Checks for JWT validity.
 */
export const validateJWT = (token: string): ReturnValue => {
    if (!token) {
        return {
            status: Status.UNAUTHORIZED,
            message: `(validateJWT) No token provided.`
        }
    }

    try {
        const decoded = verify(token, process.env.JWT_SECRET) as JwtPayload;

        // check for token expiration
        if (decoded.exp < Date.now() / 1000) {
            return {
                status: Status.UNAUTHORIZED,
                message: `(validateJWT) Token expired.`
            }
        }

        if (
            typeof decoded !== 'string' 
            && 'twitterId' in decoded
            && 'twitterAccessToken' in decoded
            && 'twitterRefreshToken' in decoded
            && 'twitterExpiresIn' in decoded
        ) {
            return {
                status: Status.SUCCESS,
                message: `(validateJWT) Token is valid.`,
                data: {
                    twitterId: decoded.twitterId,
                    twitterAccessToken: decoded.twitterAccessToken,
                    twitterRefreshToken: decoded.twitterRefreshToken,
                    twitterExpiresIn: decoded.twitterExpiresIn
                }
            }
        } else {
            return {
                status: Status.UNAUTHORIZED,
                message: `(validateJWT) Invalid token.`
            }
        
        }
    } catch (err: any) {
        {
            return {
                status: Status.UNAUTHORIZED,
                message: `(validateJWT) ${err.message}`
            }
        }
    }
}