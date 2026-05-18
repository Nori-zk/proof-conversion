import { rmSync } from 'fs';
import { Bool, Cache, Field } from 'o1js';
import { ZkpProofLeft, ZkpProofRight } from '../structs.js';
import { layer1 } from './layer1node.js';

const CACHE_DIR = './cache_b1114';

describe('regression_b1114_disabled_subtree_identity', () => {
  let layer1Vk: Awaited<ReturnType<typeof layer1.compile>>['verificationKey'];

  beforeAll(async () => {
    const compiled = await layer1.compile({
      cache: Cache.FileSystem(CACHE_DIR),
    });
    layer1Vk = compiled.verificationKey;
  });

  afterAll(() => {
    rmSync(CACHE_DIR, { recursive: true, force: true });
  });

  test('both sides disabled must reject non-identity dummy proofs', async () => {
    const A = Field(111n);
    const M = Field(222n);
    const C = Field(333n);

    const piLeft = await ZkpProofLeft.dummy(A, M, 0);
    const piRight = await ZkpProofRight.dummy(M, C, 0);

    await expect(
      layer1.compute(
        piLeft,
        layer1Vk,
        Bool(false),
        piRight,
        layer1Vk,
        Bool(false)
      )
    ).rejects.toThrow();
  });

  test('left disabled must reject piLeft.publicInput != piLeft.publicOutput', async () => {
    const A = Field(111n);
    const M = Field(222n);

    const piLeft = await ZkpProofLeft.dummy(A, M, 0);
    const piRight = await ZkpProofRight.dummy(M, M, 0);

    await expect(
      layer1.compute(
        piLeft,
        layer1Vk,
        Bool(false),
        piRight,
        layer1Vk,
        Bool(false)
      )
    ).rejects.toThrow();
  });

  test('right disabled must reject piRight.publicInput != piRight.publicOutput', async () => {
    const M = Field(222n);
    const C = Field(333n);

    const piLeft = await ZkpProofLeft.dummy(M, M, 0);
    const piRight = await ZkpProofRight.dummy(M, C, 0);

    await expect(
      layer1.compute(
        piLeft,
        layer1Vk,
        Bool(false),
        piRight,
        layer1Vk,
        Bool(false)
      )
    ).rejects.toThrow();
  });
});
