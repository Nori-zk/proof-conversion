import { Risc0Groth16ComputationalPlan } from '../../compute/plans/risc0/groth16.js';
import { Logger } from 'esm-iso-logger';
import { ApiMethod } from '../methodDecorator.js';
import {
  risc0Groth16ArgsKeys,
  risc0Groth16ObjKeys,
  Risc0Groth16Input
} from '../validation/risc0/schema.js';
import { assertExactStructure } from '../validation/validation.js';
import { risc0Groth16ObjInputSchema } from '../validation/risc0/schema.js';

const logger = new Logger('API');

const fromRisc0Object = (obj: unknown) => {
  assertExactStructure(obj, risc0Groth16ObjInputSchema, 'Risc0ToGroth16Input');
  return obj;
};

export const performRisc0Groth16 = ApiMethod<
  Risc0Groth16Input, // TInput (what executor expects)
  typeof risc0Groth16ArgsKeys, // TKeys (what arguments mode expects to be provided) performRisc0ToGroth16.fromArgs(risc0_proof, raw_vk)
  Risc0Groth16Input // TObject (what object mode expects as a single object) performRisc0ToGroth16.fromObject({} as Risc0ToGroth16Input)
>(
  risc0Groth16ArgsKeys,
  fromRisc0Object,
  risc0Groth16ObjKeys
)(async (executor, input) => {
  // FIXME why are we not validating here as well think about how APIMethod works lazy!
  logger.log('Performing Risc0 Groth16 conversion...');
  return executor.execute(new Risc0Groth16ComputationalPlan(), input);
});
