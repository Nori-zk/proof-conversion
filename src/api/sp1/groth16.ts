import { Logger } from 'esm-iso-logger';
import { ApiMethod } from '../methodDecorator.js';
import {
  type SP1ProofWithPublicValuesGroth16NoTee,
  sp1Groth16InputSchema,
} from '../validation/sp1/schema.js';
import { Sp1Groth16ComputationalPlan } from '../../compute/plans/sp1/groth16.js';

const logger = new Logger('API');

export const performSp1Groth16 = ApiMethod<
  SP1ProofWithPublicValuesGroth16NoTee, // TInput (what executor expects)
  typeof sp1Groth16InputSchema
>(
  sp1Groth16InputSchema, // Schema object for SP1ProofWithPublicValuesGroth16NoTee
  false // Arguments mode disabled
)(async (executor, input) => {
  logger.log('Performing SP1 Groth16 conversion...');
  return executor.execute(new Sp1Groth16ComputationalPlan(), input);
});
