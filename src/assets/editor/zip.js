/*
  zip.js — read and write .zip files in the browser, without any library.

  Used by the package maker of the noob zip (the settings editor in "maker"
  mode, see index.html next to this file): it opens the customization package
  downloaded from Alma, swaps our code in, and writes the zip to upload again.
  Everything happens in the browser's memory; nothing is sent anywhere.

  WHY OUR OWN (about 200 lines) AND NOT A LIBRARY: the browser already does the
  hard part — the compression inside a zip ("deflate") is built in as
  CompressionStream / DecompressionStream('deflate-raw') (Chrome/Edge 103+,
  Firefox 113+, Safari 16.4+). What remains is the zip "container": a header
  per file, a table of contents at the end (the "central directory") and a
  CRC-32 checksum per file. No third-party code to vet or update.

  SUPPORTED: the zips Alma produces and the ones Windows/macOS/7-Zip make:
  "stored" (method 0) and "deflate" (method 8) entries, UTF-8 or plain ASCII
  names, folders. NOT supported (clear error instead): encrypted zips, Zip64
  (files over 4 GB — a customization package is a few MB), split archives.

  API (plain script, no modules):
      const files = await EcZip.read(arrayBufferOrBlob);   // [{ name, data: Uint8Array }]
      const blob  = await EcZip.write(files);               // files as above → Blob (application/zip)
  Folder entries are not returned by read() and not needed by write(): a path
  like "INST-VIEW/assets/settings.js" implies its folders.

  Format reference: PKWARE APPNOTE.TXT, sections 4.3.7 (local file header),
  4.3.12 (central directory header) and 4.3.16 (end of central directory).
*/
(function () {
  'use strict';

  const SIG_LOCAL = 0x04034b50;   // "PK\3\4"
  const SIG_CENTRAL = 0x02014b50; // "PK\1\2"
  const SIG_END = 0x06054b50;     // "PK\5\6"
  const FLAG_ENCRYPTED = 0x0001;
  const FLAG_UTF8 = 0x0800;       // bit 11: file names are UTF-8

  /* ------------------------------------------------------------- helpers */

  /** True when this browser has the built-in deflate streams we rely on. */
  function supported() {
    return typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
  }

  /** Run bytes through a (De)CompressionStream and collect the output. */
  async function pipe(bytes, stream) {
    const out = await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer();
    return new Uint8Array(out);
  }
  const inflate = (bytes) => pipe(bytes, new DecompressionStream('deflate-raw'));
  const deflate = (bytes) => pipe(bytes, new CompressionStream('deflate-raw'));

  /** CRC-32 (the zip checksum), table-driven. */
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  /** MS-DOS date and time (what zip headers store), local time, 2-second precision. */
  function dosDateTime(d) {
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
    const date = ((Math.max(d.getFullYear(), 1980) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    return { time, date };
  }

  /* ---------------------------------------------------------------- read */

  /**
   * All files of a zip, in archive order.
   * @param {ArrayBuffer|Blob|Uint8Array} input
   * @returns {Promise<Array<{name: string, data: Uint8Array}>>}
   */
  async function read(input) {
    if (!supported()) throw new Error('This browser cannot open zip files. Please use a recent Edge, Chrome or Firefox.');
    const buf = input instanceof Blob ? await input.arrayBuffer() : input instanceof Uint8Array ? input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) : input;
    const bytes = new Uint8Array(buf);
    const view = new DataView(buf);

    // 1. The "end of central directory" record: the last 22+ bytes (it can be
    //    followed by a comment of up to 65535 bytes), found by its signature.
    let end = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
      if (view.getUint32(i, true) === SIG_END) { end = i; break; }
    }
    if (end < 0) throw new Error('This is not a zip file (or it is damaged).');
    const count = view.getUint16(end + 10, true);
    let p = view.getUint32(end + 16, true); // offset of the central directory
    if (count === 0xffff || p === 0xffffffff) throw new Error('This zip uses the Zip64 format, which is not supported.');

    // 2. The central directory: one header per entry, with sizes and where its data is.
    const utf8 = new TextDecoder('utf-8');
    const files = [];
    for (let n = 0; n < count; n++) {
      if (view.getUint32(p, true) !== SIG_CENTRAL) throw new Error('The zip file is damaged (table of contents).');
      const flags = view.getUint16(p + 8, true);
      const method = view.getUint16(p + 10, true);
      const compSize = view.getUint32(p + 20, true);
      const size = view.getUint32(p + 24, true);
      const nameLen = view.getUint16(p + 28, true);
      const extraLen = view.getUint16(p + 30, true);
      const commentLen = view.getUint16(p + 32, true);
      const localOffset = view.getUint32(p + 42, true);
      // Names: UTF-8 when flagged; otherwise usually plain ASCII (package paths
      // are), which UTF-8 decodes identically. Windows' backslashes normalised.
      const name = utf8.decode(bytes.subarray(p + 46, p + 46 + nameLen)).replace(/\\/g, '/');
      p += 46 + nameLen + extraLen + commentLen;

      if (name.endsWith('/')) continue; // folder entry
      if (flags & FLAG_ENCRYPTED) throw new Error(`"${name}" is password-protected; the package must not be encrypted.`);

      // 3. The data sits after the entry's LOCAL header, whose name/extra
      //    lengths can differ from the central copy — read them there.
      if (view.getUint32(localOffset, true) !== SIG_LOCAL) throw new Error(`The zip file is damaged (entry "${name}").`);
      const start = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
      const raw = bytes.subarray(start, start + compSize);

      let data;
      if (method === 0) data = raw.slice();
      else if (method === 8) data = await inflate(raw);
      else throw new Error(`"${name}" uses an unsupported compression method (${method}).`);
      if (data.length !== size) throw new Error(`"${name}" could not be unpacked correctly.`);
      files.push({ name, data });
    }
    return files;
  }

  /* --------------------------------------------------------------- write */

  /**
   * A zip containing `files`, compressed with deflate (stored when that is not
   * smaller, e.g. images that are compressed already).
   * @param {Array<{name: string, data: Uint8Array|string}>} files  strings are written as UTF-8
   * @returns {Promise<Blob>}
   */
  async function write(files) {
    if (!supported()) throw new Error('This browser cannot create zip files. Please use a recent Edge, Chrome or Firefox.');
    const enc = new TextEncoder();
    const { time, date } = dosDateTime(new Date());
    const parts = [];      // local headers + data, in order
    const central = [];    // central directory headers
    let offset = 0;

    for (const f of files) {
      const name = enc.encode(f.name);
      const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
      const crc = crc32(data);
      const packed = await deflate(data);
      const method = packed.length < data.length ? 8 : 0;
      const body = method === 8 ? packed : data;

      // Local file header (30 bytes + name).
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, SIG_LOCAL, true);
      local.setUint16(4, 20, true);            // version needed: 2.0 (deflate)
      local.setUint16(6, FLAG_UTF8, true);
      local.setUint16(8, method, true);
      local.setUint16(10, time, true);
      local.setUint16(12, date, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, body.length, true);
      local.setUint32(22, data.length, true);
      local.setUint16(26, name.length, true);
      local.setUint16(28, 0, true);            // no extra field
      parts.push(new Uint8Array(local.buffer), name, body);

      // Central directory header (46 bytes + name), pointing back at the local one.
      const cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, SIG_CENTRAL, true);
      cd.setUint16(4, 20, true);               // made by: version 2.0
      cd.setUint16(6, 20, true);               // version needed
      cd.setUint16(8, FLAG_UTF8, true);
      cd.setUint16(10, method, true);
      cd.setUint16(12, time, true);
      cd.setUint16(14, date, true);
      cd.setUint32(16, crc, true);
      cd.setUint32(20, body.length, true);
      cd.setUint32(24, data.length, true);
      cd.setUint16(28, name.length, true);
      // 30 extra len, 32 comment len, 34 disk no., 36 internal attrs, 38 external attrs: all 0
      cd.setUint32(42, offset, true);
      central.push(new Uint8Array(cd.buffer), name);

      offset += 30 + name.length + body.length;
    }

    const cdSize = central.reduce((n, b) => n + b.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, SIG_END, true);
    end.setUint16(8, files.length, true);      // entries on this disk
    end.setUint16(10, files.length, true);     // entries in total
    end.setUint32(12, cdSize, true);
    end.setUint32(16, offset, true);           // where the central directory starts
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
  }

  window.EcZip = { read, write, supported, crc32 };
})();
