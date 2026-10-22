import { BundledReferenceRepository } from "./BundledReferenceRepository";
import { HybridRepository } from "./HybridRepository";
import { StaticShardRepository } from "./StaticShardRepository";
import { CompoundRepository } from "./CompoundRepository";

export const repository = new CompoundRepository(
  new HybridRepository(
    new StaticShardRepository("/HK-ELE-Teacher-App/hkele-data", "remote-full"),
    new BundledReferenceRepository(),
  ),
);
