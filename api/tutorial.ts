import { Tutorial } from '../models/tutorial';
import { TutorialModel, UserModel } from '../utils/constants/db';
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

/**
 * Gets called when a user completes a specific tutorial.
 */
export const completeTutorial = async (twitterId: string, tutorialId: number): Promise<ReturnValue> => {
    try {
        const tutorial = await TutorialModel.findOne({ id: tutorialId });

        if (!tutorial) {
            return {
                status: Status.ERROR,
                message: `(completeTutorial) Tutorial ID ${tutorialId} not found.`
            }
        }

        // get the user's list of tutorials
        const user = await UserModel.findOne({ twitterId }).lean();

        if (!user) {
            return {
                status: Status.ERROR,
                message: `(completeTutorial) User not found.`
            }
        }

        const userTutorials = user.inGameData.completedTutorialIds as number[];

        // check if the user has already completed this tutorial
        if (userTutorials.includes(tutorialId)) {
            return {
                status: Status.ERROR,
                message: `(completeTutorial) User has already completed tutorial ID ${tutorialId}.`
            }
        }

        // add the tutorial to the user's list of completed tutorials
        await UserModel.updateOne({ twitterId }, {
            $push: {
                'inGameData.completedTutorialIds': tutorialId
            }
        });

        return {
            status: Status.SUCCESS,
            message: `(completeTutorial) User has completed tutorial ID ${tutorialId}.`
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(completeTutorial) Error: ${err.message}`
        }
    }
}