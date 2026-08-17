/** Restart command safety helpers. Pure functions for smoke tests. */
export interface RestartArgSanitizeResult {
    readonly args: string[];
    readonly removedUnsafeHost: boolean;
}
/**
 * DSH currently refuses --host 0.0.0.0 for safety. If an external launcher or
 * agent accidentally starts DSH with that flag and the market later performs an
 * auto-restart, preserving argv verbatim would put DSH into a restart loop.
 * Keep all other args intact, but strip the fatal host binding.
 */
export declare function sanitizeDshRestartArgs(args: readonly string[]): RestartArgSanitizeResult;
