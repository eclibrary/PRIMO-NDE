const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
require('dotenv').config({ path: './build-settings.env' });

// [nde-views] INST_ID / VIEW_ID come from views.config.json + the active view
// (NDE_VIEW env or .active-view). build-settings.env is kept only for ADDON_NAME / ASSET_BASE_URL.
const { resolveView } = require('./scripts/view-context.cjs');
const view = resolveView();

const distPath = path.join(__dirname, 'dist', 'custom-module');
const targetPath = view.distDir;
const zipPath = `${view.distDir}.zip`;

function removeDirectory(directory, callback) {
    fs.rm(directory, { recursive: true, force: true }, callback);
}

/**
 * CACHE-BUSTING for the static pages' own stylesheets/scripts (Oct 29 2026).
 *
 * Problem: the compiled JS chunks get a new hashed name on every build, but the
 * files the landing page / header / footer HTML link to — e.g.
 *     <link href="./homepage.css" rel="stylesheet">
 * — keep the same name. Browsers then reuse their cached copy, even after a
 * Ctrl+F5 (the HTML is fetched and injected by NDE, so the hard reload does not
 * reach those links). Result seen by Björn: new JS (guest account-count pills)
 * with OLD homepage.css → unstyled, misaligned pills.
 *
 * Fix: in the PACKAGE copy only (dist/, never src/), every relative href/src to
 * a .css or .js file in the HTML files under assets/ gets ?v=<build stamp>,
 * e.g. ./homepage.css?v=202610291545. A link that already has a query string,
 * or points to another site (http…, //…), is left alone.
 */
function addCacheBusting(dir) {
    const p = (n) => String(n).padStart(2, '0');
    const d = new Date();
    const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}`;
    // (href|src)="<relative path>.css|.js" — no scheme, no leading //, no "?" yet.
    const ref = /\b(href|src)=(["'])(?![a-z][a-z0-9+.-]*:|\/\/|#)([^"'?#]+\.(?:css|js))\2/gi;
    let changed = 0;
    const walk = (folder) => {
        for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
            const full = path.join(folder, entry.name);
            if (entry.isDirectory()) { walk(full); continue; }
            if (!/\.html?$/i.test(entry.name)) continue;
            const before = fs.readFileSync(full, 'utf8');
            const after = before.replace(ref, (_, attr, q, url) => `${attr}=${q}${url}?v=${stamp}${q}`);
            if (after !== before) { fs.writeFileSync(full, after); changed++; }
        }
    };
    const assets = path.join(dir, 'assets');
    if (fs.existsSync(assets)) walk(assets);
    console.log(`Cache-busting: ?v=${stamp} added to stylesheet/script links in ${changed} HTML file(s) under assets/`);
}

function renameAndArchive() {
    fs.rename(distPath, targetPath, (err) => {
        if (err) throw err;
        console.log(`Renamed directory to ${targetPath}`);
        // Before zipping: version-stamp the static pages' own CSS/JS links.
        addCacheBusting(targetPath);

        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
            console.log(`Archive completed: ${archive.pointer()} total bytes`);
            console.log(`Zip file created at: ${zipPath}`);
            console.log('Please upload the zip file to Alma BO custom package section to deploy your custom module.');
        });

        archive.on('warning', (err) => {
            if (err.code === 'ENOENT') {
                console.log('Warning:', err);
            } else {
                throw err;
            }
        });

        archive.on('error', (err) => {
            throw err;
        });

        archive.pipe(output);
        archive.directory(targetPath, path.basename(targetPath)); // This ensures the directory itself is included
        archive.finalize();
    });
}

// Check if target directory exists and remove it if it does
if (fs.existsSync(targetPath)) {
    removeDirectory(targetPath, (err) => {
        if (err) throw err;
        renameAndArchive();
    });
} else {
    renameAndArchive();
}
