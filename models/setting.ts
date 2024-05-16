/****************
 * SETTING-RELATED MODELS
 ****************/

/**
 * Represents application settings.
 */
export interface Setting {
    /** unique key of the setting */
    key: string;
    /** the setting's readable name */
    name: string;
    /** the setting's description */
    description: string;
    /** the setting's value; could be a string, number, boolean or object */
    value: string | number | boolean | object;
}
