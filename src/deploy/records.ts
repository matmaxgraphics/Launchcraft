/** Deployed launches, remembered in this browser so LaunchLens (next step) can list them. */
export interface DeployRecord {
  id: string;
  createdAt: number;
  cluster: "devnet";
  name: string;
  symbol: string;
  creator: string;
  config: string;
  baseMint: string;
  pool: string;
  configSig: string;
  poolSig: string;
  /** Graduation threshold we computed before deploying, in lamports (string for JSON). */
  expectedGraduationLamports: string;
  /** Graduation threshold read back from the on-chain config, in lamports. */
  onChainGraduationLamports: string;
  verified: boolean;
}

const KEY = "launchcraft:deployments:v1";

export function loadDeployments(): DeployRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DeployRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveDeployment(r: DeployRecord) {
  try {
    const all = loadDeployments().filter((x) => x.pool !== r.pool);
    localStorage.setItem(KEY, JSON.stringify([r, ...all].slice(0, 50)));
  } catch {
    /* storage unavailable: the on-chain launch is unaffected */
  }
}
