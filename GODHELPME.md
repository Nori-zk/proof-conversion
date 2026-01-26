plonk=============

sp1 -> get_mlo -> computeauxwitness -> o1js


groth16==============

risc0 -> makeAlphaBeta -> serilise_mlo -> computeauxwitness -> o1js (MUST ENFORCE 6 PI/IC)

sp1 -> compute_and_serialize_aux_witness  ->  convert_sp1_groth16_to_o1js_js -> o1js circirty (UP TO 7 CI but must have 1, 6 public inputs (exludes pi0 which is the vk - "maybe" ic0 is pi0) starts from pi1 but ALL optional)

snarkjs -> convert_snarkjs_groth16_to_o1js_js [vk mlo] -> o1js proof+vk
(UP TO 7 CI but must have 1, 6 public inputs (exludes pi0 which is the vk - "maybe" ic0 is pi0) starts from pi1 but ALL optional)

And the for types 

=====================================================================================================


snarkjs wtns calculate circuit_js/circuit.wasm input.json witness.wtns to get witness (WE DONT HAVE THIS)

INPUT circuit_js/circuit.wasm
INPUT input.json
so THIS witness.wtns is an ouput


 "snarkjs": "build/cli.cjs"
 
 https://github.com/iden3/snarkjs/blob/master/cli.js
 
 // We need to provide circuit  circuit.wasmand witness.wtns
 
 async function wtnsCalculate(params, options) {
    const wasmName = params[0] || "circuit.wasm";
    const inputName = params[1] || "input.json";
    const witnessName = params[2] || "witness.wtns";

    if (options.verbose) Logger.setLogLevel("DEBUG");

    const input = JSON.parse(await fs.promises.readFile(inputName, "utf8"));

    await wtns.calculate(input, wasmName, witnessName, {});

    return 0;
}