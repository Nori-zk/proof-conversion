import { Groth16ComputationalPlan } from '../../compute/plans/groth16/index.js';
import { Logger } from '../../logging/logger.js';
import { ApiMethod } from '../methodDecorator.js';
import { Risc0ToGroth16Input } from './types.js';

const logger = new Logger('API');

const risc0ArgsKeys = ['risc0_proof', 'raw_vk'] as const;
const risc0ObjKeys = ['risc0_proof', 'raw_vk'] as const;

const fromRisc0Object = (obj: Risc0ToGroth16Input): Risc0ToGroth16Input => ({
  risc0_proof: obj.risc0_proof,
  raw_vk: obj.raw_vk,
});

export const performRisc0ToGroth16 = ApiMethod<
  Risc0ToGroth16Input, // TInput (what executor expects)
  typeof risc0ArgsKeys, // TKeys (what arguments mode expects to be provided) performRisc0ToGroth16.fromArgs(risc0_proof, raw_vk)
  Risc0ToGroth16Input // TObject (what object mode expects as a single object) performRisc0ToGroth16.fromObject({} as Risc0ToGroth16Input)
>(
  risc0ArgsKeys,
  fromRisc0Object,
  risc0ObjKeys
)(async (executor, input) => {
  logger.log('Performing Risc0 to Groth16 conversion...');
  return executor.execute(new Groth16ComputationalPlan(), input);
});
