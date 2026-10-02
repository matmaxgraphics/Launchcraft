import type { LaunchConfig } from "@/launch/config";
import type { BuildResult } from "@/launch/toDbc";
import type { Issue } from "@/launch/validate";

export interface StepProps {
  config: LaunchConfig;
  update: (mut: (c: LaunchConfig) => void) => void;
  issues: Issue[];
  build: BuildResult;
  solUsd: number;
}
