// Dev-proxy target = the Primo host of the active view (views.config.json: per-view "host",
// falling back to "defaultHost"). Override for one run with PROXY_TARGET=https://... in the env.
import viewContext from '../scripts/view-context.cjs';

function resolveTarget() {
    if (process.env.PROXY_TARGET) return process.env.PROXY_TARGET.replace(/\/+$/, '');
    if (viewContext.readActiveKey()) return viewContext.resolveView().host;
    return viewContext.loadConfig().defaultHost;
}

export const PROXY_TARGET = resolveTarget();
console.log(`[proxy] Active proxy target: ${PROXY_TARGET}`);
