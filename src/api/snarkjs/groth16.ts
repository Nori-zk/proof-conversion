import { Logger } from 'esm-iso-logger';
import { ApiMethod } from '../methodDecorator.js';
import { assertExactStructure } from '../validation/validation.js';
import {
  type SnarkjsGroth16Input,
  snarkjsGroth16ArgsKeys,
  snarkjsGroth16ObjKeys,
  snarkjsGroth16InputSchema,
} from '../validation/snarkjs/schema.js';
import { SnarkjsGroth16ComputationalPlan } from '../../compute/plans/snarkjs/groth16.js';

const logger = new Logger('API');

const fromSnarkjsObject = (obj: unknown) => {
  assertExactStructure(obj, snarkjsGroth16InputSchema, 'SnarkjsGroth16Input');
  return obj;
};

export const performSnarkjsGroth16 = ApiMethod<
  SnarkjsGroth16Input, // TInput (what executor expects)
  typeof snarkjsGroth16ArgsKeys, // TKeys (what arguments mode expects to be provided) performSnarkjsGroth16.fromArgs(proof, vk, publicInputs)
  SnarkjsGroth16Input // TObject (what object mode expects as a single object) performSnarkjsGroth16.fromObject({} as SnarkjsGroth16Input)
>(
  snarkjsGroth16ArgsKeys,
  fromSnarkjsObject,
  snarkjsGroth16ObjKeys
)(async (executor, input) => {
  assertExactStructure(input, snarkjsGroth16InputSchema, 'SnarkjsGroth16Input');
  logger.log('Performing Snarkjs Groth16 conversion...');
  return executor.execute(new SnarkjsGroth16ComputationalPlan(), input);
});
