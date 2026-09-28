import { accessSync, constants, readFileSync, rmSync } from "node:fs";

const CREDENTIAL_NAME = /TOKEN|SECRET|PASSWORD|API_KEY/i;

/**
 * Environment for every child process the harness spawns (bash tool,
 * lint/test, the harness's own git calls): credential-like variables are
 * dropped so they are not handed to model-written code by inheritance.
 *
 * This is hygiene, not isolation. A same-user child can still read an
 * ancestor's environment from /proc/<pid>/environ, and files (~/.ssh,
 * ~/.config/gh, ...) and agents (SSH_AUTH_SOCK) stay reachable. CI mode
 * therefore also keeps the API key out of every environment
 * (takeApiKeyFile) and checks isolationProblems(); local CLI mode offers no
 * isolation from model-written code at all.
 */
export function childEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(env).filter(([name]) => !CREDENTIAL_NAME.test(name)));
}

/**
 * Reads the API key from `path` and deletes the file before any child process
 * exists, so the key lives only in this process's memory — never in an
 * environment block that children could read via /proc.
 */
export function takeApiKeyFile(path: string): string {
  const key = readFileSync(path, "utf-8").trim();
  rmSync(path);
  return key;
}

function readOptional(path: string): string | undefined {
  try {
    return readFileSync(path, "utf-8").trim();
  } catch {
    return undefined;
  }
}

function isWritable(path: string): boolean {
  try {
    accessSync(path, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

type ProcessFacts = {
  env: NodeJS.ProcessEnv;
  execArgv: string[];
  ptraceScope: string | undefined;
  /** Contents of /proc/self/status. */
  status: string | undefined;
  dockerSocketWritable: boolean;
};

function statusField(status: string | undefined, name: string): string | undefined {
  return status?.match(new RegExp(`^${name}:\\s*(\\S+)`, "m"))?.[1];
}

/**
 * Reasons model-written child processes could still reach the API key held in
 * this process's memory: via the environment, the inspector, ptrace, or by
 * becoming root first (passwordless sudo and docker-group access both exist on
 * GitHub-hosted runners). CI refuses to run unless this is empty.
 */
export function isolationProblems(
  facts: ProcessFacts = {
    env: process.env,
    execArgv: process.execArgv,
    ptraceScope: readOptional("/proc/sys/kernel/yama/ptrace_scope"),
    status: readOptional("/proc/self/status"),
    dockerSocketWritable: isWritable("/var/run/docker.sock"),
  },
): string[] {
  const problems: string[] = [];
  if (facts.env.ANTHROPIC_API_KEY) {
    problems.push("ANTHROPIC_API_KEY is in the environment (children can read it via /proc) — pass ANTHROPIC_API_KEY_FILE instead");
  }
  if (!facts.execArgv.includes("--disable-sigusr1")) {
    problems.push("node was started without --disable-sigusr1 (a child could open the inspector with SIGUSR1)");
  }
  if (facts.ptraceScope === undefined || Number(facts.ptraceScope) < 1) {
    problems.push("kernel.yama.ptrace_scope is not >= 1 (a child could read this process's memory)");
  }
  if (statusField(facts.status, "NoNewPrivs") !== "1") {
    problems.push("no_new_privs is not set (a child could become root via sudo/setuid) — run under `setpriv --no-new-privs`");
  }
  const capEff = statusField(facts.status, "CapEff");
  if (capEff === undefined || BigInt(`0x${capEff}`) !== 0n) {
    problems.push("the process holds Linux capabilities");
  }
  if (facts.dockerSocketWritable) {
    problems.push("/var/run/docker.sock is writable (docker access is root access) — stop docker first");
  }
  return problems;
}
