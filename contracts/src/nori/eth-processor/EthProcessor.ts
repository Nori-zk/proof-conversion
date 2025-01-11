import {
  Field,
  PrivateKey,
  Provable,
  SmartContract,
  State,
  VerificationKey,
  method,
  state,
  Poseidon,
  UInt8,
  Bytes,
  Gadgets,
  MerkleTree,
  MerkleWitness,
  Undefined,
  Proof,
} from 'o1js';
import { EthInput, EthProof, EthVerifier, Bytes32 } from './EthVerifier.js';

export const adminPrivateKey = PrivateKey.fromBase58(
  'EKFcef5HKXAn7V2rQntLiXtJr15dkxrsrQ1G4pnYemhMEAWYbkZW'
);

export const adminPublicKey = adminPrivateKey.toPublicKey();

export class EthMerkleWitness extends MerkleWitness(32) {}

class EthProofType extends EthProof {}

export class EthProcessor extends SmartContract {
  @state(Field) parametersWereSet = State<Field>();
  @state(Field) commitmentsRoot = State<Field>();
  @state(Field) currentLeafIndex = State<Field>();
  @state(Field) trustedBlock = State<Field>();
  @state(Field) verifiedStateRoot = State<Field>();

  init() {
    super.init();
    this.commitmentsRoot.set(
      Field.from(
        19057105225525447794058879360670244229202611178388892366137113354909512903676n
      )
    );
    this.currentLeafIndex.set(Field(0));
    this.account.delegate.set(adminPublicKey);
    this.parametersWereSet.set(Field(0));
  }

  @method async setParameters(trustedBlock: Field) {
    const parametersWereSet = this.parametersWereSet.getAndRequireEquals();
    parametersWereSet.assertEquals(Field(0));

    this.trustedBlock.set(trustedBlock);
    this.parametersWereSet.set(Field(1));
  }
  @method async mockUpdate(ethProof: EthProofType) {
    Provable.log('mockUpdate');
    ethProof.verify();
    Provable.log(
      'set state for the latest commited ETH slot on Mina:',
      ethProof.publicInput.newHead
    );
    Provable.log(
      'length fields',
      ethProof.publicInput.executionStateRoot.toFields().length
    );
    this.verifiedStateRoot.set(
      Poseidon.hash(ethProof.publicInput.executionStateRoot.toFields())
    );
  }

  @method async update(
    admin: PrivateKey,
    ethProof: EthProofType,
    path: EthMerkleWitness
  ) {
    ethProof.verify();
    let leafIndex = this.currentLeafIndex.getAndRequireEquals();

    let commitmentsRoot = this.commitmentsRoot.getAndRequireEquals();

    path.calculateRoot(Field(0)).assertEquals(commitmentsRoot);
    // const newRoot = path.calculateRoot(
    //   Poseidon.hash([...EthProof.publicInput.dataCommitment.toFields()])
    // );

    // let trustedBlock = this.trustedBlock.getAndRequireEquals();
    // trustedBlock.assertEquals(
    //   Poseidon.hashPacked(
    //     Bytes32.provable,
    //     EthProof.publicInput.trustedHeaderHash
    //   )
    // );

    // this.trustedBlock.set(
    //   Poseidon.hashPacked(
    //     Bytes32.provable,
    //     EthProof.publicInput.targetHeaderHash
    //   )
    // );

    // this.commitmentsRoot.set(newRoot);

    this.currentLeafIndex.set(leafIndex.add(Field.from(1)));

    const adminPk = admin.toPublicKey();
    this.account.delegate.requireEquals(adminPk);
  }
}
