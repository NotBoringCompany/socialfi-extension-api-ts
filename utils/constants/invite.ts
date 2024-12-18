/** 
 * The required level for referrals or indirect referrals to reach before the referrer starts earning rewards. 
 * 
 * NOTE: Because this may change based on balancing factors, any referrals that have already been marked true
 * even if they haven't reached this level (e.g. because this level is increased from X to Y in the future) will 
 * still allow the rewards to be earned, just that the referrers cannot earn them again once the referrals/indirect referrals reach this level.
 */
export const REFERRAL_REQUIRED_LEVEL = 10;