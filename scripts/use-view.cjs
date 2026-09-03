#!/usr/bin/env node
// Usage: npm run use -- <view>
const { setActiveKey, resolveView, viewKeys } = require('./view-context.cjs');

const key = process.argv[2];
if (!key) {
  console.error(`Usage: npm run use -- <view>\nKnown views: ${viewKeys().join(', ')}`);
  process.exit(1);
}
setActiveKey(key);
const v = resolveView(key);
console.log(`Active view: ${v.key}  (${v.instId}:${v.viewId} — ${v.label})`);
