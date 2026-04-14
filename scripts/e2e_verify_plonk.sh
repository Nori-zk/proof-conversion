#!/bin/bash

set -e

source ./scripts/.env

NODE_SCRIPT="./build/src/plonk/e2e_verify.js"

AUX_WITNESS_RELATIVE_PATH="../$AUX_WITNESS_PATH"
# SP1 v5: args were HEX_PROOF PROGRAM_VK HEX_PI AUX_WITNESS_PATH.
# SP1 v6: PI2 PI3 PI4 inserted before AUX_WITNESS_PATH (public_inputs[2..4]).
node --max-old-space-size=16384 $NODE_SCRIPT $HEX_PROOF $PROGRAM_VK $HEX_PI $PI2 $PI3 $PI4 $AUX_WITNESS_RELATIVE_PATH &

node_pid=$!
wait $node_pid
exit_status=$?

if [ $exit_status -eq 0 ]; then
  echo "Verification successfuly proven"
else
  echo "Verification failed"
  exit 1
fi

echo "Success"