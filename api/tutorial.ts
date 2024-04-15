import { Tutorial } from '../models/tutorial';
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

/**
 * Gets all tutorials from the database.
 */
export const getTutorials = async (): Promise<ReturnValue> => {
    try {
        const tutorials = await TutorialModel.find();

        if (!tutorials || tutorials.length === 0) {
            return {
                status: Status.ERROR,
                message: '(getTutorials) No tutorials found.'
            }
        }

        return {
            status: Status.SUCCESS,
            message: '(getTutorials) Successfully retrieved tutorials',
            data: {
                tutorials: tutorials as Tutorial[]
            }
        }
    } catch (err: any) {
        console.log('(getTutorials) Error:', err.message);
        return {
            status: Status.ERROR,
            message: `(getTutorials) Error: ${err.message}`
        }
    }
}