import {
  Field,
  Provable,
  VerificationKey,
  Poseidon,
  UInt8,
  Bytes,
  ZkProgram,
  Struct,
  UInt64,
  Undefined,
} from 'o1js';

import { FrC } from '../../towers/index.js';
import { NodeProofLeft } from '../../structs.js';
import { parsePublicInputsProvable } from '../../plonk/parse_pi.js';
import { wordToBytes } from '../../sha/utils.js';
import fs from 'fs';
import { PATH_TO_O1_PROOF, PATH_TO_O1_VK } from './proofs.js';

class Bytes32 extends Bytes(32) {}

// sol! {
//     struct ProofOutputs {
//         bytes32 executionStateRoot;
//         bytes32 newHeader;
//         bytes32 nextSyncCommitteeHash;
//         uint256 newHead;
//         bytes32 prevHeader;
//         uint256 prevHead;
//         bytes32 syncCommitteeHash;
//     }
// }
class EthInput extends Struct({
  executionStateRoot: Bytes32.provable,
  newHeader: Bytes32.provable,
  nextSyncCommitteeHash: Bytes32.provable,
  newHead: UInt64,
  prevHeader: Bytes32.provable,
  prevHead: UInt64,
  syncCommitteeHash: Bytes32.provable,
}) {}
const EthVerifier = ZkProgram({
  name: 'EthVerifier',
  publicInput: EthInput,
  publicOutput: Undefined,
  methods: {
    compute: {
      privateInputs: [NodeProofLeft],
      async method(input: EthInput, proof: NodeProofLeft) {
        // if (process.env.BLOBSTREAM_ENABLED == 'true') {
        // ethProgramVK = FrC.from(process.env.BLOBSTREAM_PROGRAM_VK as string);
        const ethPlonkVK = FrC.from(
          '9789275659627809334116192247584283293808128911170761516714869670668916769' //$programVK todo check ?
        );

        const ethNodeVk = Field.from(
          JSON.parse(fs.readFileSync(PATH_TO_O1_PROOF, 'utf8')).publicOutput[2] //???
        );

        const vk = VerificationKey.fromJSON(
          JSON.parse(fs.readFileSync(PATH_TO_O1_VK, 'utf8'))
        );

        proof.verify(vk);
        proof.publicOutput.subtreeVkDigest.assertEquals(ethNodeVk);
        Provable.log('all', input);
        Provable.log('newHeader', input.newHeader);
        Provable.log('newHead slot', input.newHead);
        //   struct ProofOutputs {
        //     uint256 newHead;
        //     bytes32 prevHeader;
        //     uint256 prevHead;
        //     bytes32 syncCommitteeHash;
        // }
        let bytes: UInt8[] = [];
        bytes = bytes.concat(input.executionStateRoot.bytes);
        bytes = bytes.concat(input.newHeader.bytes);
        bytes = bytes.concat(input.nextSyncCommitteeHash.bytes);
        bytes = bytes.concat(padUInt64To32Bytes(input.newHead));
        bytes = bytes.concat(input.prevHeader.bytes);
        bytes = bytes.concat(padUInt64To32Bytes(input.prevHead));
        bytes = bytes.concat(input.syncCommitteeHash.bytes);

        // bytes = bytes.concat(uint64ToBytes32(input.prevHead));
        // bytes = bytes.concat(uint64ToBytes32(input.newHead));

        const pi0 = ethPlonkVK;
        const pi1 = parsePublicInputsProvable(Bytes.from(bytes));

        const piDigest = Poseidon.hashPacked(Provable.Array(FrC.provable, 2), [
          pi0,
          pi1,
        ]);
        Provable.log('piDigest', piDigest);
        Provable.log(
          'proof.publicOutput.rightOut',
          proof.publicOutput.rightOut
        );

        piDigest.assertEquals(proof.publicOutput.rightOut);

        return undefined;
      },
    },
  },
});

const EthProof = ZkProgram.Proof(EthVerifier);
export { EthVerifier, EthProof, EthInput, Bytes32 };

const padUInt64To32Bytes = (num: UInt64): UInt8[] => {
  let unpadded: UInt8[] = [];
  //   Provable.asProver(() => {
  unpadded = wordToBytes(num.toFields()[0]);
  //   });
  return [...unpadded, ...Array(24).fill(UInt8.from(0))].reverse();
};
