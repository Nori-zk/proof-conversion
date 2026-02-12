import { Logger } from 'esm-iso-logger';
import { ApiMethod } from '../ApiMethod.js';
import {
  sp1PlonkInputSchema,
  type SP1ProofWithPublicValuesPlonkNoTee,
} from './schema.js';
import { Sp1PlonkComputationalPlan } from '../../compute/plans/sp1/plonk.js';

const logger = new Logger('API');

export const performSp1Plonk = ApiMethod<
  SP1ProofWithPublicValuesPlonkNoTee, // TInput (what executor expects)
  typeof sp1PlonkInputSchema // Type of schema object for SP1ProofWithPublicValuesGroth16NoTee
>(
  sp1PlonkInputSchema, // Schema object for SP1ProofWithPublicValuesPlonkNoTee
  false // Arguments mode disabled
)(async (executor, input) => {
  logger.log('Performing SP1 Plonk conversion...');
  return executor.execute(new Sp1PlonkComputationalPlan(), input);
});
