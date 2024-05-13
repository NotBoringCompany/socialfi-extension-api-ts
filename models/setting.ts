/****************
 * SETTING-RELATED MODELS
 ****************/

/**
 * Represents application settings.
 */
export interface Setting {
    /** unique key of the setting */
    key: string;
    /** setting's readable name */
    name: string;
    /** setting's description */
    description: string;

    /** setting's value, could be string, number, boolean or object */
    value: any;
}
