import { WONDERBITS_CONTRACT } from '../utils/constants/web3';
import { ReturnValue, Status } from '../utils/retVal';

/**
 * Checks if the player has an account on the Wonderbits contract and creates one if they don't.
 */
export const checkWonderbitsAccountRegistrationRequired = async (address: string): Promise<ReturnValue> => {
    try {
        const exists = await WONDERBITS_CONTRACT.playerExists(address);

        if (!exists) {
            const tx = await WONDERBITS_CONTRACT.createPlayer(address);

            return {
                status: Status.SUCCESS,
                message: `(createWonderbitsAccount) Player account with address ${address} created successfully.`,
                data: {
                    txHash: tx.hash
                }
            }
        } else {
            // return simple success message if account already exists.
            return {
                status: Status.SUCCESS,
                message: `(createWonderbitsAccount) Player account with address ${address} already exists.`,
            }
        }
    } catch (err: any) {
        return {
            status: Status.ERROR,
            message: `(createWonderbitsAccount) ${err.message}`
        }
    }
}