import { Logger } from 'esm-iso-logger';
import { Sp1Groth16ComputationalPlan } from 'src/compute/plans/sp1/groth16.js';
import { ApiMethod } from '../methodDecorator.js';
import {
  isSP1ProofWithPublicValuesGroth16NoTee,
  sp1Groth16ObjKeys,
  type Sp1Input,
  type SP1ProofWithPublicValuesGroth16NoTee,
} from './types.js';
import { assertExactStructure } from '../validation/validation.js';
import { ProofInputValidationError } from '../validation/ProofInputValidationError.js';
import { sp1Groth16InputSchema } from '../validation/sp1/schema.js';

const logger = new Logger('API');

const fromSp1Object = (obj: Sp1Input) => {
  // Validate structure first
  assertExactStructure(obj, sp1Groth16InputSchema, 'Sp1Groth16Input');

  // Type the input
  if (isSP1ProofWithPublicValuesGroth16NoTee(obj)) return obj;

  throw new ProofInputValidationError(
    'A non groth16 Sp1Proof was given to this method.'
  );
};

export const performSp1Groth16 = ApiMethod<
  SP1ProofWithPublicValuesGroth16NoTee, // TInput: processed shape given to executor
  false, // TKeys (disable arguments mode)
  Sp1Input // TObject (what object mode expects as a single object) performGroth16Plonk.fromObject({} as Sp1Input)
>(
  false,
  fromSp1Object,
  sp1Groth16ObjKeys
)(async (executor, input) => {
  logger.log('Performing SP1 Groth16 conversion...');
  return executor.execute(new Sp1Groth16ComputationalPlan(), input);
});