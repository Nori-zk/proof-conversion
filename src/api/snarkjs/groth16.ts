import { Logger } from 'esm-iso-logger';
import { ApiMethod } from '../methodDecorator.js';
import {
  type SnarkjsGroth16Input,
  snarkjsGroth16ArgsKeys,
  snarkjsGroth16InputSchema,
} from '../validation/snarkjs/schema.js';
import { SnarkjsGroth16ComputationalPlan } from '../../compute/plans/snarkjs/groth16.js';

const logger = new Logger('API');

export const performSnarkjsGroth16 = ApiMethod<
  SnarkjsGroth16Input, // TInput (what executor expects)
  typeof snarkjsGroth16InputSchema, // Type of schema object for SnarkjsGroth16Input
  typeof snarkjsGroth16ArgsKeys // TKeys: what arguments mode expects to be provided to performSnarkjsGroth16.fromArgs(proof, vk, publicInputs)
>(
  snarkjsGroth16InputSchema, // Schema object for SnarkjsGroth16Input
  true, // If we support arguments mode
  snarkjsGroth16ArgsKeys // What arguments mode expects to be provided to performSnarkjsGroth16.fromArgs(proof, vk, publicInputs)
)(async (executor, input) => {
  logger.log('Performing Snarkjs Groth16 conversion...');
  return executor.execute(new SnarkjsGroth16ComputationalPlan(), input);
});
