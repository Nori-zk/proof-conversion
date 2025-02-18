#!/bin/bash

build_contracts() {
  if [ ! -d "./contracts/build" ]; then
    pushd ./contracts || exit 1
    [ ! -d "node_modules" ] && npm ci
    npm run build
    popd || exit 1
  fi
}

setup_env() {
  cd ./scripts || exit 1

  export WORK_DIR=conversion
  export RUN_DIR=$(pwd)/$WORK_DIR
  export PROOF_DIR=../example-proofs

  mkdir -p "$RUN_DIR"
}

process_proof_files() {
  for proof_file in "$PROOF_DIR"/*.json; do
    if [[ -f "$proof_file" ]]; then
      filename=$(basename "$proof_file" .json)

      if node ../contracts/build/src/blobstream/sp1_to_env.js \
          "$proof_file" \
          "$RUN_DIR" \
          "$WORK_DIR" \
          "$filename"; then
          echo "Processing $filename..."
          PROOF_START=$SECONDS
        ./e2e_plonk.sh "$RUN_DIR/env.$filename"
        PROOF_DURATION=$(( SECONDS - PROOF_START ))
        echo "Processed $filename successfully, it took ${PROOF_DURATION}s"
      else
        echo "Error executing sp1_to_env.js for $proof_file."
      fi
    else
      echo "No JSON files found in $PROOF_DIR."
    fi
  done
}

build_contracts
setup_env
process_proof_files
