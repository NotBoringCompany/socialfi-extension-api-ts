import Mixpanel from 'mixpanel';

/** create an instance of Mixpanel */
export const mixpanel = Mixpanel.init(process.env.MIXPANEL_TOKEN!);