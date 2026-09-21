import { BundledReferenceRepository } from "./BundledReferenceRepository";
import { HybridRepository } from "./HybridRepository";
import { StaticShardRepository } from "./StaticShardRepository";

export const repository = new HybridRepository(
  new StaticShardRepository("/HK-ELE-Teacher-App/hkele-data", "remote-full"),
  new BundledReferenceRepository(),
);
