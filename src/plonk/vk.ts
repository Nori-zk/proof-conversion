import { FpC, FrC } from '../towers/index.js';

// taken from: https://github.com/succinctlabs/sp1-contracts/blob/ratan/v1.0.5-testnet/contracts/src/PlonkVerifier.sol

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

const VK: Sp1PlonkVk = {
  pub_inputs: FrC.from(2n),
  domain_size: [1].concat(Array(24).fill(0)), // 16777216 = 2^24,
  inv_domain_size:
    FrC.from(
      21888241567198334088790460357988866238279339518792980768180410072331574733841n
    ),

  g1_gen_x:
    FpC.from(
      14312776538779914388377568895031746459131577658076416373430523308756343304251n
    ),
  g1_gen_y:
    FpC.from(
      11763105256161367503191792604679297387056316997144156930871823008787082098465n
    ),

  omega:
    FrC.from(
      5709868443893258075976348696661355716898495876243883251619397131511003808859n
    ),

  ql_x: FpC.from(
    17984004271810887111892332882651374483612811613160171882231530673955342124072n
  ),
  ql_y: FpC.from(
    13277994607875064672295433418223618455646015691912141325106751561841646085822n
  ),

  qr_x: FpC.from(
    16336286973672788525637509231329701034039020185740400021577697914995487271901n
  ),
  qr_y: FpC.from(
    88284377293612431075210969180485407669835075356048788125030179865751136579n
  ),

  qm_x: FpC.from(
    10856514239855788242760873537198968126773773371401212930763195728908952457266n
  ),
  qm_y: FpC.from(
    9275209459688740642101488227886989724826404626746083670876354123229317070279n
  ),

  qo_x: FpC.from(
    11483266664351462882096699260743761962335837409017508503826409502538996076321n
  ),
  qo_y: FpC.from(
    17394959804451514544078291653193154652690985857122468223674247897665667008225n
  ),

  qk_x: FpC.from(
    6378083169737830823085597784511445554718388062388953364429190548392020833332n
  ),
  qk_y: FpC.from(
    12423874058816725405347015291038805106767729770869142043443023930694783565135n
  ),

  qs1_x:
    FpC.from(
      8432363989348148399267595343996871949745756313266171098803972147558566645391n
    ),
  qs1_y:
    FpC.from(
      21830041218908693046173167152196424202345484683169853420596524951634570306585n
    ),

  qs2_x:
    FpC.from(
      2889872191603241225798623124219684248629415321428218534303823116357979417612n
    ),
  qs2_y:
    FpC.from(
      8446598484540146291961338772594737249603462456099116591415979984815127389111n
    ),

  qs3_x:
    FpC.from(
      12894021857927799668653295424700631150139887020229360316861211114803005826079n
    ),
  qs3_y:
    FpC.from(
      5332155988317853016248818837542073627058808403298822656476772250044723938116n
    ),

  coset_shift: FrC.from(5n),

  qcp_0_x:
    FpC.from(
      16113316688614670925300831064391815772431716488200414163545127725991745431527n
    ),
  qcp_0_y:
    FpC.from(
      18613967203673816695007264416375047840688367875268537453854528850830700989951n
    ),

  index_commit_api_0: FrC.from(10853426n),
  num_custom_gates: FrC.from(1n),

  // LAGRANGE FOR CUSTOM GATES PUBLIC INPUTS
  omega_pow_i:
    FrC.from(
      16795388596092443350911124054549624656429669904415213062532227558052741320483n
    ),
  omega_pow_i_div_n:
    FrC.from(
      251448363590645499459062065459771451310267945865111825607839138491086563559n
    ),
};

export { Sp1PlonkVk, VK };
