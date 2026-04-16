import { type Sp1PlonkVk as Sp1PlonkVkJson } from '@nori-zk/proof-conversion-utils';
import { FpC, FrC } from '../towers/index.js';
import vkData from './plonk_vk_sp1_v6.1.0.json' with { type: 'json' };

// Circuit-level VK type with o1js field element wrappers
type Sp1PlonkVk = {
  pub_inputs: FrC;
  domain_size: number[];
  inv_domain_size: FrC;

  g1_gen_x: FpC;
  g1_gen_y: FpC;

  omega: FrC;

  ql_x: FpC;
  ql_y: FpC;

  qr_x: FpC;
  qr_y: FpC;

  qm_x: FpC;
  qm_y: FpC;

  qo_x: FpC;
  qo_y: FpC;

  qk_x: FpC;
  qk_y: FpC;

  qs1_x: FpC;
  qs1_y: FpC;

  qs2_x: FpC;
  qs2_y: FpC;

  qs3_x: FpC;
  qs3_y: FpC;

  coset_shift: FrC;

  qcp_0_x: FpC;
  qcp_0_y: FpC;

  index_commit_api_0: FrC;
  num_custom_gates: FrC;

  // LAGRANGE FOR CUSTOM GATES PUBLIC INPUTS
  omega_pow_i: FrC;
  omega_pow_i_div_n: FrC;
};

const raw = vkData as Sp1PlonkVkJson;
const log2DomainSize = Math.log2(raw.domain_size);

const VK: Sp1PlonkVk = {
  pub_inputs:      FrC.from(BigInt(raw.nb_public_inputs)),
  domain_size:     [1].concat(Array(log2DomainSize).fill(0)),
  inv_domain_size: FrC.from(BigInt(raw.inv_domain_size)),

  g1_gen_x: FpC.from(BigInt(raw.g1_gen_x)),
  g1_gen_y: FpC.from(BigInt(raw.g1_gen_y)),

  omega: FrC.from(BigInt(raw.omega)),

  ql_x: FpC.from(BigInt(raw.ql_x)),
  ql_y: FpC.from(BigInt(raw.ql_y)),

  qr_x: FpC.from(BigInt(raw.qr_x)),
  qr_y: FpC.from(BigInt(raw.qr_y)),

  qm_x: FpC.from(BigInt(raw.qm_x)),
  qm_y: FpC.from(BigInt(raw.qm_y)),

  qo_x: FpC.from(BigInt(raw.qo_x)),
  qo_y: FpC.from(BigInt(raw.qo_y)),

  qk_x: FpC.from(BigInt(raw.qk_x)),
  qk_y: FpC.from(BigInt(raw.qk_y)),

  qs1_x: FpC.from(BigInt(raw.qs1_x)),
  qs1_y: FpC.from(BigInt(raw.qs1_y)),

  qs2_x: FpC.from(BigInt(raw.qs2_x)),
  qs2_y: FpC.from(BigInt(raw.qs2_y)),

  qs3_x: FpC.from(BigInt(raw.qs3_x)),
  qs3_y: FpC.from(BigInt(raw.qs3_y)),

  coset_shift: FrC.from(BigInt(raw.coset_shift)),

  qcp_0_x: FpC.from(BigInt(raw.qcp_0_x)),
  qcp_0_y: FpC.from(BigInt(raw.qcp_0_y)),

  index_commit_api_0: FrC.from(BigInt(raw.index_commit_api_0)),
  num_custom_gates:   FrC.from(BigInt(raw.num_custom_gates)),

  omega_pow_i:       FrC.from(BigInt(raw.omega_pow_i)),
  omega_pow_i_div_n: FrC.from(BigInt(raw.omega_pow_i_div_n)),
};

export { Sp1PlonkVk, VK };
