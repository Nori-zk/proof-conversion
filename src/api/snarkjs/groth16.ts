import { Logger } from 'esm-iso-logger';
import { ApiMethod } from '../ApiMethod.js';
import {
  type SnarkjsGroth16Input,
  snarkjsGroth16ArgKeys,
  snarkjsGroth16InputSchema,
} from './schema.js';
import { SnarkjsGroth16ComputationalPlan } from '../../compute/plans/snarkjs/groth16.js';

const logger = new Logger('API');

export const performSnarkjsGroth16 = ApiMethod<
  SnarkjsGroth16Input, // TInput (what executor expects)
  typeof snarkjsGroth16InputSchema, // Type of schema object for SnarkjsGroth16Input
  typeof snarkjsGroth16ArgKeys // TKeys: what arguments mode expects to be provided to performSnarkjsGroth16.fromArgs(proof, vk, publicInputs)
>(
  snarkjsGroth16InputSchema, // Schema object for SnarkjsGroth16Input
  true, // If we support arguments mode
  snarkjsGroth16ArgKeys // What arguments mode expects to be provided to performSnarkjsGroth16.fromArgs(proof, vk, publicInputs)
)(async (executor, input) => {
  logger.log('Performing Snarkjs Groth16 conversion...');
  return executor.execute(new SnarkjsGroth16ComputationalPlan(), input);
});
