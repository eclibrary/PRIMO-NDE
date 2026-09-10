# Settings step 2 — the UI (updated)

Drop on the REPO ROOT (merge, replace when asked), on top of step 1.

## Added
- scripts/settings-ui/server.cjs            local HTTP server (no dependencies)
- scripts/settings-ui/public/{index.html,app.js,style.css}
- package.json: "settings": "node scripts/settings-ui/server.cjs"
- docs/SETTINGS.md: UI section
- data/return-labels.json: the full 19-library list restored (from the CSV)

## Changed
- config/schema.json: `required` on libchat and printReturnLabel
- app.js: confirmation before removing a return label or a view

## Run
    npm run settings
