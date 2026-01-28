import { Logger } from 'esm-iso-logger';
import { ApiMethod } from '../methodDecorator.js';
import { assertExactStructure } from '../validation/validation.js';
import {
  type Sp1Input,
  type Sp1PlonkInputTransformed,
  sp1PlonkObjKeys,
  sp1PlonkInputSchema,
} from '../validation/sp1/schema.js';
import { Sp1PlonkComputationalPlan } from '../../compute/plans/sp1/plonk.js';

const logger = new Logger('API');

const fromSp1Object = (obj: unknown) => {
  // Validate structure first
  assertExactStructure(obj, sp1PlonkInputSchema, 'Sp1PlonkInput');
  // Perform the mapping
  return {
    hexPi: `0x${Buffer.from(obj.public_values.buffer.data).toString('hex')}`,
    programVK: obj.proof.Plonk.public_inputs[0],
    encodedProof: `0x00000000${obj.proof.Plonk.encoded_proof}`,
  };
};

export const performSp1Plonk = ApiMethod<
  Sp1PlonkInputTransformed, // TInput: processed shape given to executor
  // Disabling args at this time as unknown impact on new TEE option the decoding might change!
  false, //typeof sp1ArgKeys, // TKeys (what arguments mode expects to be provided) performSp1Plonk.fromArgs(hexPi, programVK, encodedProof)
  Sp1Input // TObject (what object mode expects as a single object) performSp1Plonk.fromObject({} as Sp1Input)
>(
  // Disabling args at this time as unknown impact on new TEE option the decoding might change!
  false, // sp1ArgKeys,
  fromSp1Object,
  sp1PlonkObjKeys
)(async (executor, input) => {
  logger.log('Performing SP1 Plonk conversion...');
  return executor.execute(new Sp1PlonkComputationalPlan(), input);
});
