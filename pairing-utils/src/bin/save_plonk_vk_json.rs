use std::fs;

use ark_bn254::{Fr, G1Affine};
use ark_ff::{Field, PrimeField};
use pairing_utils::gnark::decompress_g1;
use pairing_utils::sp1::Sp1PlonkVk;
use sp1_verifier::PLONK_VK_BYTES;

fn parse_fr(bytes: &[u8]) -> Fr {
    Fr::from_be_bytes_mod_order(bytes)
}

fn fr_to_str(fr: Fr) -> String {
    fr.into_bigint().to_string()
}

fn g1_xy(g1: G1Affine) -> (String, String) {
    (g1.x.into_bigint().to_string(), g1.y.into_bigint().to_string())
}

fn read_g1(buf: &[u8]) -> G1Affine {
    decompress_g1(buf.try_into().expect("expected 32 bytes"))
        .expect("failed to decompress G1 point")
}

fn main() {
    let buf: &[u8] = *PLONK_VK_BYTES;

    // Binary layout from sp1-verifier converter.rs
    let domain_size      = u64::from_be_bytes(buf[0..8].try_into().unwrap());
    let size_inv         = parse_fr(&buf[8..40]);
    let omega            = parse_fr(&buf[40..72]);
    let nb_public_inputs = u64::from_be_bytes(buf[72..80].try_into().unwrap());
    let coset_shift      = parse_fr(&buf[80..112]);

    let qs1 = read_g1(&buf[112..144]);
    let qs2 = read_g1(&buf[144..176]);
    let qs3 = read_g1(&buf[176..208]);
    let ql  = read_g1(&buf[208..240]);
    let qr  = read_g1(&buf[240..272]);
    let qm  = read_g1(&buf[272..304]);
    let qo  = read_g1(&buf[304..336]);
    let qk  = read_g1(&buf[336..368]);

    let num_qcp = u32::from_be_bytes(buf[368..372].try_into().unwrap());
    assert_eq!(num_qcp, 1, "expected exactly 1 custom gate");

    let mut offset = 372;
    let qcp_0  = read_g1(&buf[offset..offset + 32]); offset += 32;
    let g1_gen = read_g1(&buf[offset..offset + 32]); offset += 32;

    // skip g2_0 (64 bytes), g2_1 (64 bytes), SRS data (33788 bytes)
    offset += 64 + 64 + 33788;

    let num_cci = u64::from_be_bytes(buf[offset..offset + 8].try_into().unwrap());
    assert_eq!(num_cci, 1, "expected exactly 1 commitment constraint index");
    offset += 8;

    let index_commit_api_0 = u64::from_be_bytes(buf[offset..offset + 8].try_into().unwrap());

    // omega_pow_i = omega^(nb_public_inputs + index_commit_api_0)
    let exponent = nb_public_inputs + index_commit_api_0;
    let omega_pow_i = omega.pow([exponent]);
    let omega_pow_i_div_n = omega_pow_i * size_inv;

    let (qs1_x, qs1_y)       = g1_xy(qs1);
    let (qs2_x, qs2_y)       = g1_xy(qs2);
    let (qs3_x, qs3_y)       = g1_xy(qs3);
    let (ql_x, ql_y)         = g1_xy(ql);
    let (qr_x, qr_y)         = g1_xy(qr);
    let (qm_x, qm_y)         = g1_xy(qm);
    let (qo_x, qo_y)         = g1_xy(qo);
    let (qk_x, qk_y)         = g1_xy(qk);
    let (qcp_0_x, qcp_0_y)   = g1_xy(qcp_0);
    let (g1_gen_x, g1_gen_y) = g1_xy(g1_gen);

    let vk = Sp1PlonkVk {
        nb_public_inputs,
        domain_size,
        inv_domain_size: fr_to_str(size_inv),
        omega: fr_to_str(omega),
        coset_shift: fr_to_str(coset_shift),
        g1_gen_x, g1_gen_y,
        ql_x, ql_y,
        qr_x, qr_y,
        qm_x, qm_y,
        qo_x, qo_y,
        qk_x, qk_y,
        qs1_x, qs1_y,
        qs2_x, qs2_y,
        qs3_x, qs3_y,
        qcp_0_x, qcp_0_y,
        index_commit_api_0,
        num_custom_gates: num_qcp as u64,
        omega_pow_i: fr_to_str(omega_pow_i),
        omega_pow_i_div_n: fr_to_str(omega_pow_i_div_n),
    };

    let json = serde_json::to_string_pretty(&vk).expect("serialization failed");
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../src/plonk/plonk_vk_v6.0.0.json");
    fs::write(path, &json).expect("failed to write JSON");
    println!("Written to {}", path);
}
