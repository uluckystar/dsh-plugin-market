/** Restart command safety helpers. Pure functions for smoke tests. */
/**
 * DSH currently refuses --host 0.0.0.0 for safety. If an external launcher or
 * agent accidentally starts DSH with that flag and the market later performs an
 * auto-restart, preserving argv verbatim would put DSH into a restart loop.
 * Keep all other args intact, but strip the fatal host binding.
 */
export function sanitizeDshRestartArgs(args) {
    const out = [];
    let removedUnsafeHost = false;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === undefined)
            continue;
        if (arg === '--host' && args[i + 1] === '0.0.0.0') {
            removedUnsafeHost = true;
            i++;
            continue;
        }
        if (arg === '--host=0.0.0.0') {
            removedUnsafeHost = true;
            continue;
        }
        out.push(arg);
    }
    return { args: out, removedUnsafeHost };
}
