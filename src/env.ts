const CREDENTIAL_NAME = /TOKEN|SECRET|PASSWORD|API_KEY/i;

/**
 * Environment for every child process the harness spawns. Any of them can end
 * up running model-written code — the bash tool and lint/test directly, and
 * the harness's own git calls via hooks or `core.fsmonitor` the model set up —
 * so the harness's credentials (ANTHROPIC_API_KEY, GH_TOKEN, ...) are
 * withheld by name. A repo whose tests need such a variable must supply it
 * some other way.
 */
export function childEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(env).filter(([name]) => !CREDENTIAL_NAME.test(name)));
}
