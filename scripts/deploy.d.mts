export interface DeploymentPlan {
  readonly mode: "check" | "deploy" | "rollback" | string;
  readonly ready: boolean;
  readonly blockers: string[];
  readonly version: string | null;
  readonly workerName: string | null;
  readonly healthUrl: string | null;
  readonly sourceConfigPath: string;
  readonly generatedConfigPath: string;
  readonly generatedEntryPath: string;
  readonly rollbackVersionId: string | null;
  readonly expectedHealthVersion: string | null;
  expectedDeploymentId: string | null;
  readonly expectedAssetState: "locked" | "open" | string | null;
  assetProbePath: string | null;
}

export interface CommandResult {
  readonly status: number | null;
  readonly stdout?: string;
  readonly stderr?: string;
  readonly error?: Error;
}

export type CommandRunner = (
  command: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv; inherit?: boolean },
) => CommandResult;

export interface DeploymentOptions {
  readonly cwd?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly mode?: "check" | "deploy" | "rollback" | string;
  readonly versionId?: string | null;
  readonly runner?: CommandRunner;
  readonly fetcher?: typeof fetch;
  readonly waiter?: (milliseconds: number) => Promise<void>;
}

export interface DeploymentResult {
  readonly status: "blocked" | "failed" | "ready" | "verified";
  readonly plan: DeploymentPlan;
  readonly reason?: string;
  readonly evidence?: string;
  readonly recovery?: string;
}

export function createDeploymentPlan(options?: DeploymentOptions): DeploymentPlan;
export function runDeployment(options?: DeploymentOptions): Promise<DeploymentResult>;
