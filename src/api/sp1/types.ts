export interface Sp1Proof {
  Plonk: {
    encoded_proof: string;
    plonk_vkey_hash: number[];
    public_inputs: string[];
    raw_proof: string;
  };
}

export interface Sp1PublicValues {
  buffer: {
    data: number[];
  };
}

export interface Sp1 {
  proof: Sp1Proof;
  public_values: Sp1PublicValues;
  sp1_version: string;
}
