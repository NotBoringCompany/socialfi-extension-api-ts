/**
 * Repressents Token Verify API response provided by LINE.
 */
export interface VerifiedTokenResponse {
    /**
     * The permissions granted to the access token
     * Ref: https://developers.line.biz/en/docs/line-login/integrate-line-login/#scopes
     */
    scope: string;
    /** Channel ID for which the access token is issued */
    client_id: string;
    /** Number of seconds until the access token expires. */
    expires_in: number;
}

/**
 * Represents Error Response provided by LINE.
 */
export interface LineErrorResponse {
    error: string;
    error_description: string;
}

/**
 * Represents LINE user's profile.
 */
export interface LineProfile {
    userId: string;
    displayName: string;
    pictureUrl?: string;
    statusMessage?: string;
}
