import { Setting } from '../models/setting';
import { SettingModel } from '../utils/constants/db';
import { generateObjectId } from '../utils/crypto';
import { ReturnValue, Status } from '../utils/retVal';

/**
 * Adds a setting to the database.
 */
export const addSetting = async (setting: Setting): Promise<ReturnValue> => {
    try {
        // create a new setting instance
        const newSetting = new SettingModel({
            _id: generateObjectId(),
            ...setting,
        });

        await newSetting.save();

        return {
            status: Status.SUCCESS,
            message: `(addSetting) Successfully added setting with name: ${setting.name}`,
        };
    } catch (err: any) {
        console.log('(addSetting) Error:', err.message);
        return {
            status: Status.ERROR,
            message: `(addSetting) Error: ${err.message}`,
        };
    }
};

/**
 * Updates an existing setting in the database.
 */
export const updateSetting = async (_id: string, setting: Setting): Promise<ReturnValue> => {
    try {
        const updatedSetting = await SettingModel.findOne({ _id });

        if (!updatedSetting) {
            return {
                status: Status.ERROR,
                message: '(updateSetting) Setting not found.',
            };
        }

        // Update properties if they are provided
        if (updatedSetting.key !== undefined) updatedSetting.key = setting.key;
        if (updatedSetting.name !== undefined) updatedSetting.name = setting.name;
        if (updatedSetting.description !== undefined) updatedSetting.description = setting.description;
        if (updatedSetting.value !== undefined) updatedSetting.value = setting.value;

        // Save the updated setting
        await updatedSetting.save();

        return {
            status: Status.SUCCESS,
            message: `(updateSetting) Successfully updated setting with id: ${updatedSetting._id}`,
            data: setting,
        };
    } catch (err: any) {
        console.log('(updateSetting) Error:', err.message);
        return {
            status: Status.ERROR,
            message: `(updateSetting) Error: ${err.message}`,
        };
    }
};

/**
 * Gets all settings from the database.
 */
export const getSettings = async (): Promise<ReturnValue> => {
    try {
        const settings = await SettingModel.find();

        if (!settings || settings.length === 0) {
            return {
                status: Status.ERROR,
                message: '(getSettings) No settings found.',
            };
        }

        return {
            status: Status.SUCCESS,
            message: '(getSettings) Successfully retrieved settings',
            data: {
                settings: settings as Setting[],
            },
        };
    } catch (err: any) {
        console.log('(getSettings) Error:', err.message);
        return {
            status: Status.ERROR,
            message: `(getSettings) Error: ${err.message}`,
        };
    }
};
