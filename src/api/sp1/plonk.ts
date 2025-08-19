import { PlonkComputationalPlan } from '../../compute/plans/plonk/index.js';
import { Logger } from '../../logging/logger.js';
import { ApiMethod } from '../methodDecorator.js';
import { Sp1Input } from './types.js';

const logger = new Logger('API');

const sp1ArgKeys = ['hexPi', 'programVK', 'encodedProof'] as const;
const sp1ObjKeys = ['proof', 'public_values', 'sp1_version'] as const;

type Sp1InputProcessed = {
  hexPi: string;
  programVK: string;
  encodedProof: string;
};

const fromSp1Object = (obj: Sp1Input): Sp1InputProcessed => ({
  hexPi: `0x${Buffer.from(obj.public_values.buffer.data).toString('hex')}`,
  programVK: obj.proof.Plonk.public_inputs[0],
  encodedProof: `0x00000000${obj.proof.Plonk.encoded_proof}`,
});

export const performSp1ToPlonk = ApiMethod<
  Sp1InputProcessed, // TInput: processed shape given to executor
  typeof sp1ArgKeys, // TKeys (what arguments mode expects to be provided) performSp1ToPlonk.fromArgs(hexPi, programVK, encodedProof)
  Sp1Input // TObject (what object mode expects as a single object) performSp1ToPlonk.fromObject({} as Sp1Input)
>(
  sp1ArgKeys,
  fromSp1Object,
  sp1ObjKeys
)(async (executor, input) => {
  logger.log('Performing SP1 to Plonk conversion...');
  return executor.execute(new PlonkComputationalPlan(), input);
});
