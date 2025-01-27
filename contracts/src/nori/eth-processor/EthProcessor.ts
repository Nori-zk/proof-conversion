import {
  Field,
  PrivateKey,
  Provable,
  SmartContract,
  State,
  method,
  state,
  Poseidon,
  UInt64,
  DeployArgs,
  PublicKey,
  Permissions,
} from 'o1js';
import { EthProof, Bytes32 } from './EthVerifier.js';

export const adminPrivateKey = PrivateKey.fromBase58(
  'EKFcef5HKXAn7V2rQntLiXtJr15dkxrsrQ1G4pnYemhMEAWYbkZW' // move to env
);

export const adminPublicKey = adminPrivateKey.toPublicKey();

class EthProofType extends EthProof {}

export class EthProcessor extends SmartContract {
  @state(Field) verifiedStateRoot = State<Field>();
  @state(UInt64) latestHead = State<UInt64>();
  @state(PublicKey) admin = State<PublicKey>();

  init() {
    super.init();
    this.admin.set(adminPublicKey);
    this.latestHead.set(UInt64.from(0));
    this.verifiedStateRoot.set(Field(0));

    this.account.permissions.set({
      ...Permissions.default(),
      editState: Permissions.proof(),
    });
  }
  //deploy (for redeployments) ?
  //ensure permissions for editstate are proof only
  //can update admin but no other state atm

  @method async update(ethProof: EthProofType) {
    const currentHead = this.latestHead.getAndRequireEquals();
    const proofHead = ethProof.publicInput.newHead;
    proofHead.assertGreaterThan(
      currentHead,
      'Proof head must be greater than current head'
    );
    ethProof.verify();

    this.latestHead.set(proofHead);

    this.verifiedStateRoot.set(
      Poseidon.hashPacked(
        Bytes32.provable,
        ethProof.publicInput.executionStateRoot
      )
    );
  }
}
