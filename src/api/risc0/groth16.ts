import { Logger } from 'esm-iso-logger';
import { ApiMethod } from '../methodDecorator.js';
import { assertExactStructure } from '../validation/validation.js';
import {
  type Risc0Groth16Input,
  risc0Groth16ObjInputSchema,
  risc0Groth16ObjKeys,
} from '../validation/risc0/schema.js';
import { Risc0Groth16ComputationalPlan } from '../../compute/plans/risc0/groth16.js';

const logger = new Logger('API');

export const performRisc0Groth16 = ApiMethod<
  Risc0Groth16Input, // TInput (what executor expects)
  typeof risc0Groth16ObjInputSchema,
  typeof risc0Groth16ObjKeys // TKeys: what arguments mode expects to be provided to performRisc0Groth16.fromArgs(risc0_proof, raw_vk)
>(
  risc0Groth16ObjInputSchema, // Schema object for Risc0Groth16Input
  true, // If we support arguments mode
  risc0Groth16ObjKeys // What arguments mode expects to be provided performRisc0Groth16.fromArgs(risc0_proof, raw_vk)
)(async (executor, input) => {
  assertExactStructure(input, risc0Groth16ObjInputSchema, 'Risc0Groth16Input');
  logger.log('Performing Risc0 Groth16 conversion...');
  return executor.execute(new Risc0Groth16ComputationalPlan(), input);
});
