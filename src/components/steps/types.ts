import type { LaunchConfig } from "@/launch/config";
import type { BuildResult } from "@/launch/toDbc";
import type { Issue } from "@/launch/validate";

export interface StepProps {
  config: LaunchConfig;
  update: (mut: (c: LaunchConfig) => void) => void;
  issues: Issue[];
  build: BuildResult;
  solUsd: number;
  /** Logo chosen in the Token step. Held in memory only (a File can't be saved in the draft); uploaded at deploy time. */
  logo: File | null;
  setLogo: (f: File | null) => void;
}
