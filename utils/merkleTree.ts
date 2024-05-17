import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';

const whitelistAddresses = [
    '0x2c8bb107Ca119A4C39B8174AA5333F741fb57C15',
    '0xB40C5a061c0Aaa34a5da41198893A8965f833D98',
    '0x6926bD509dedF08405453850F48018E62314c12d',
    '0x2Ee57cBB2D91c29d08aEae379681C6d8adF4EE0b',
    '0x98916A7D66B81241EfDa4A06B411a119CB2eB13C',
    '0x60b6502bAF1d81acc9E5cf660F3952DC321Cef04',
    '0x1b061147d132a756567091412a197444D1139FaF',
    '0xF1407E00F374cc79f5C536946AaF567F865CC85b',
    '0xC98CF2C075c5827B80F9A8DA9B2b754Eff279044',
    '0x15F5EdCa7245BA90315795c077c1e26142354209',
    '0xdFc2B0d741Ae7627c8Ac0b6d4108136cc570df9F',
    '0xfEBb8e130C505284a720315De4DcAd8003a83Cd1',
    '0xeB2A40896eD76Ad33063DF00C65287cB6F88248f',
    '0xAD366A969c768D845d8368D64928B3B0b1ca8058',
    '0xD9970e93Ee2B1BD46956740BAa127D1EB40F1D66',
    '0xd0cF7EFb39f5309318c782081c6F3B8A372Fb6E8'
];

// hash addresses to create leaf nodes
const leafNodes = whitelistAddresses.map((address) => keccak256(address));

// create the merkle tree using the hashed leaf nodes
const merkleTree = new MerkleTree(leafNodes, keccak256, { sortPairs: true });

// get the merkle root
const rootHash = merkleTree.getHexRoot();

console.log('rootHash: ', rootHash);

// proof of address '0x2c8bb107Ca119A4C39B8174AA5333F741fb57C15'
const proof = merkleTree.getHexProof(keccak256('0x2c8bb107Ca119A4C39B8174AA5333F741fb57C15'));

console.log('proof: ', proof);

["0x25bdf1643dc778fbbccf420763317eebd5da86e3e11572614817eca6328c1f11", "0xc0aca18f3332f1c9950aa6723d2ea6d7ce430bf6f944221855163ba9a23bd980", "0xa8675530802f64fab81cbe9763cdfd64d0444e9f43ff4870a75b66e45f6bce39","0xab78fa316eb59d74665c05aa387ad262cc0c253d303c84a0c9fec8a527139f79"]