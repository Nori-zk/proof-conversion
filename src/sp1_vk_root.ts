import { FrC } from './towers/index.js';
import data from './sp1_vk_root_v6.1.0.json' with { type: 'json' };

const SP1_VK_ROOT: FrC = FrC.from(BigInt(data.sp1_vk_root));

export { SP1_VK_ROOT };
