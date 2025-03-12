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
  domain_size: [1].concat(Array(26).fill(0)), // 67108864 = 2^26,
  inv_domain_size:
    FrC.from(
      21888242545679039938882419398440172875981108180010270949818755658014750055173n
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
      7419588552507395652481651088034484897579724952953562618697845598160172257810n
    ),

  ql_x: FpC.from(
    11453021816558077199587453448133554449717227349905110102377551937287065432844n
  ),
  ql_y: FpC.from(
    9109454861639227276420512127158153200309304123653914732354951393328030738490n
  ),

  qr_x: FpC.from(
    7821644493905086061243882786350714717685134318611500828127397521557784035499n
  ),
  qr_y: FpC.from(
    13041052004552404684631357942397749930688211338192136370697682907414153685909n
  ),

  qm_x: FpC.from(
    1736617282271757071221168350710970296482875652045937117438551712909537507658n
  ),
  qm_y: FpC.from(
    5345542319716290612762422434959528912635502292626234402933058385633964347549n
  ),

  qo_x: FpC.from(
    18014979952384567403919168968189231706227326297377482789091451813310066870667n
  ),
  qo_y: FpC.from(
    3708432301267678677786506706811217632085917639583680393547668223045541307479n
  ),

  qk_x: FpC.from(
    865219285821188524465935330081001805464204673171276609279513133008346933102n
  ),
  qk_y: FpC.from(
    18703726972600526633323567676728586120328686581664702366183492539017488518098n
  ),

  qs1_x:
    FpC.from(
      15838704022916757697514152719576664453825928657894015885754578605399919756856n
    ),
  qs1_y:
    FpC.from(
      13387218978462600937448147418911963779105027838559913842027032523066810277894n
    ),

  qs2_x:
    FpC.from(
      8305448485555792443785892674312793099639480632975263652331649209215498687903n
    ),
  qs2_y:
    FpC.from(
      10616560339600329516818280331708877801874279040952666458845297443257568678018n
    ),

  qs3_x:
    FpC.from(
      5758551426093048145915996102270540307839916135212724540929869593580613639236n
    ),
  qs3_y:
    FpC.from(
      8329248325292414275499503861965434456596681093250791731115342865906364573529n
    ),

  coset_shift: FrC.from(5n),

  qcp_0_x:
    FpC.from(
      17635741098095958263934242315624493230424349111255370147390685295718328991108n
    ),
  qcp_0_y:
    FpC.from(
      2694645204534071204078571296638854522310743386863537396039207026993856963119n
    ),

  index_commit_api_0: FrC.from(28657845n),
  num_custom_gates: FrC.from(1n),

  // LAGRANGE FOR CUSTOM GATES PUBLIC INPUTS
  omega_pow_i:
    FrC.from(
      20851657076871152154652997671243282328863683580458794315692937248207821198598n
    ),
  omega_pow_i_div_n:
    FrC.from(
      17830536533350963034362710153181430138248154761837449025764773462980574339885n
    ),
};

export { Sp1PlonkVk, VK };
