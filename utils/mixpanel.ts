import Mixpanel from 'mixpanel';

/** create an instance of Mixpanel */
export const mixpanel = Mixpanel.init(process.env.MIXPANEL_PROJECT_TOKEN!);

/**
 * Set to true for Production API, Set to false for Test/Development API.
 */
export const allowMixpanel = false;