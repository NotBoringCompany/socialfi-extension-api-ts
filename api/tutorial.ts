import { TutorialModel } from '../utils/constants/db';
import { generateObjectId } from '../utils/crypto';
import { ReturnValue, Status } from '../utils/retVal';

/**
 * Adds a tutorial to the database.
 */
export const addTutorial = async (name: string): Promise<ReturnValue> => {
    try {
        // get the latest id
        const latestTutorial = await TutorialModel.findOne().sort({ id: -1 });

        // create a new tutorial instance
        const newTutorial = new TutorialModel({
            _id: generateObjectId(),
            id: latestTutorial ? latestTutorial.id + 1 : 1,
            name
        });

        await newTutorial.save();

        console.log('(addTutorial) Successfully added tutorial with name:', name);

        return {
            status: Status.SUCCESS,
            message: `(addTutorial) Successfully added tutorial with name: ${name}`
        }
    } catch (err: any) {
        console.log('(addTutorial) Error:', err.message);
        return {
            status: Status.ERROR,
            message: `(addTutorial) Error: ${err.message}`
        }
    }
}