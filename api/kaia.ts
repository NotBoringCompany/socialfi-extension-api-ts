import { KAIA_MAINNET_PROVIDER } from '../utils/constants/web3';
import { ReturnValue, Status } from '../utils/retVal';

/**
 * Verifies an ECDSA signature signed by a private key associated with the given address.
 *
 * Reference: https://docs.kaia.io/ko/references/json-rpc/kaia/recover-from-message/
 */
export const recoverFromMessage = async (
    address: string,
    message: string,
    signature: string
): Promise<ReturnValue> => {
    try {
        console.log(`(recoverFromMessage) address: ${address}`);
        console.log(`(recoverFromMessage) message: ${message}`);
        console.log(`(recoverFromMessage) signature: ${signature}`);

        const blockNumber = 'latest';

        const result = await KAIA_MAINNET_PROVIDER.kaia.recoverFromMessage(
            address,
            message,
            signature,
            blockNumber,
            {}
        );

        console.log(`(recoverFromMessage) result: ${result}`);

        if (!result) {
            throw new Error('Invalid signature');
        }

        return {
            status: Status.SUCCESS,
            message: `(recoverFromMessage) Signature valid.`,
        };
    } catch (err: any) {
        console.log(err.message);

        return {
            status: Status.ERROR,
            message: `(recoverFromMessage) Signature invalid.`,
        };
    }
};

/**
 * Sign a kaia message to get the signature.
 *
 * Reference: https://docs.kaia.io/ko/references/json-rpc/kaia/sign/
 */
export const signMessage = async (address: string, message: string): Promise<ReturnValue<{ signature: string }>> => {
    try {
        const result = await KAIA_MAINNET_PROVIDER.kaia.sign(address, message, {});

        if (!result) {
            throw new Error('Failed to sign the message');
        }

        return {
            status: Status.SUCCESS,
            message: `(signMessage) Message signed.`,
            data: {
                signature: result
            }
        };
    } catch (err: any) {

        console.log(err.message);
        
        return {
            status: Status.ERROR,
            message: `(signMessage) Failed to sign the message.`,
        };
    }
};
