/* Generatore di codici QR (byte, correzione M, versioni 1-10). Nessuna dipendenza. */
(function (g) {
  var EXP = [], LOG = [], x = 1, i;
  for (i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
  function mul(a, b) { return a && b ? EXP[(LOG[a] + LOG[b]) % 255] : 0; }
  function rs(data, n) {
    var gen = [1], j, k;
    for (i = 0; i < n; i++) { var ng = new Array(gen.length + 1).fill(0); for (j = 0; j < gen.length; j++) { ng[j] ^= gen[j]; ng[j + 1] ^= mul(gen[j], EXP[i]); } gen = ng; }
    var r = new Array(n).fill(0);
    data.forEach(function (d) { var f = d ^ r[0]; r.shift(); r.push(0); for (k = 0; k < n; k++) r[k] ^= mul(gen[k + 1], f); });
    return r;
  }
  // versione: [parole totali, ecc per blocco, [[n blocchi, parole dati], ...]]
  var V = { 1: [26, 10, [[1, 16]]], 2: [44, 16, [[1, 28]]], 3: [70, 26, [[1, 44]]], 4: [100, 18, [[2, 32]]], 5: [134, 24, [[2, 43]]], 6: [172, 16, [[4, 27]]], 7: [196, 18, [[4, 31]]], 8: [242, 22, [[2, 38], [2, 39]]], 9: [292, 22, [[3, 36], [2, 37]]], 10: [346, 26, [[4, 43], [1, 44]]] };
  var AL = { 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50] };
  function bch(v, poly, bits) { var d = v << bits; var top = poly.toString(2).length; while (d.toString(2).length >= top) d ^= poly << (d.toString(2).length - top); return (v << bits) | d; }
  function make(text) {
    var bytes = unescape(encodeURIComponent(text)).split('').map(function (c) { return c.charCodeAt(0); });
    var ver = 0, v;
    for (v = 1; v <= 9; v++) { var cap = V[v][2].reduce(function (a, b) { return a + b[0] * b[1]; }, 0); if (bytes.length + 2 <= cap) { ver = v; break; } }
    if (!ver) return null;
    var info = V[ver], cap = info[2].reduce(function (a, b) { return a + b[0] * b[1]; }, 0), bits = [];
    function put(val, n) { for (var b = n - 1; b >= 0; b--) bits.push((val >> b) & 1); }
    put(4, 4); put(bytes.length, 8); bytes.forEach(function (b) { put(b, 8); });
    put(0, Math.min(4, cap * 8 - bits.length)); while (bits.length % 8) bits.push(0);
    var cw = []; for (i = 0; i < bits.length; i += 8) cw.push(parseInt(bits.slice(i, i + 8).join(''), 2));
    for (var pad = 0; cw.length < cap; pad++) cw.push(pad % 2 ? 0x11 : 0xEC);
    var blocks = [], pos = 0; info[2].forEach(function (g) { for (var n = 0; n < g[0]; n++) { var d = cw.slice(pos, pos + g[1]); pos += g[1]; blocks.push({ d: d, e: rs(d, info[1]) }); } });
    var out = [], maxD = Math.max.apply(null, blocks.map(function (b) { return b.d.length; }));
    for (i = 0; i < maxD; i++) blocks.forEach(function (b) { if (i < b.d.length) out.push(b.d[i]); });
    for (i = 0; i < info[1]; i++) blocks.forEach(function (b) { out.push(b.e[i]); });
    var N = ver * 4 + 17, M = [], F = [], r, c;
    for (r = 0; r < N; r++) { M.push(new Array(N).fill(0)); F.push(new Array(N).fill(false)); }
    function set(r, c, val) { if (r >= 0 && c >= 0 && r < N && c < N) { M[r][c] = val ? 1 : 0; F[r][c] = true; } }
    function finder(r0, c0) { for (var a = -1; a <= 7; a++) for (var b = -1; b <= 7; b++) { var on = a >= 0 && a <= 6 && b >= 0 && b <= 6 && (a === 0 || a === 6 || b === 0 || b === 6 || (a >= 2 && a <= 4 && b >= 2 && b <= 4)); set(r0 + a, c0 + b, on); } }
    finder(0, 0); finder(0, N - 7); finder(N - 7, 0);
    for (i = 8; i < N - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    var al = AL[ver] || [];
    al.forEach(function (a) { al.forEach(function (b) { if ((a < 9 && b < 9) || (a < 9 && b > N - 10) || (a > N - 10 && b < 9)) return; for (var p = -2; p <= 2; p++) for (var q = -2; q <= 2; q++) set(a + p, b + q, Math.max(Math.abs(p), Math.abs(q)) !== 1); }); });
    set(N - 8, 8, true);
    // zone riservate per formato e versione
    var res = []; for (i = 0; i < 9; i++) { res.push([8, i], [i, 8]); } for (i = 0; i < 8; i++) { res.push([8, N - 1 - i], [N - 1 - i, 8]); }
    res.forEach(function (p) { if (!F[p[0]][p[1]]) { F[p[0]][p[1]] = true; } });
    if (ver >= 7) { for (i = 0; i < 6; i++) for (var j = 0; j < 3; j++) { F[i][N - 11 + j] = true; F[N - 11 + j][i] = true; } }
    var dataBits = []; out.forEach(function (b) { for (var k = 7; k >= 0; k--) dataBits.push((b >> k) & 1); });
    var coords = [], up = true; c = N - 1;
    while (c > 0) { if (c === 6) c--; for (var rr = 0; rr < N; rr++) { r = up ? N - 1 - rr : rr; for (var cc = 0; cc < 2; cc++) { var col = c - cc; if (!F[r][col]) coords.push([r, col]); } } up = !up; c -= 2; }
    var MASK = [function (r, c) { return (r + c) % 2 === 0; }, function (r) { return r % 2 === 0; }, function (r, c) { return c % 3 === 0; }, function (r, c) { return (r + c) % 3 === 0; }, function (r, c) { return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; }, function (r, c) { return (r * c) % 2 + (r * c) % 3 === 0; }, function (r, c) { return ((r * c) % 2 + (r * c) % 3) % 2 === 0; }, function (r, c) { return ((r + c) % 2 + (r * c) % 3) % 2 === 0; }];
    function build(mk) {
      var A = M.map(function (row) { return row.slice(); });
      coords.forEach(function (p, idx) { var bit = idx < dataBits.length ? dataBits[idx] : 0; A[p[0]][p[1]] = bit ^ (MASK[mk](p[0], p[1]) ? 1 : 0); });
      var f = bch(0 * 8 + mk, 0x537, 10) ^ 0x5412; // livello M = 00
      function fb(k) { return (f >> k) & 1; }
      for (var k = 0; k < 15; k++) {
        var a = k < 6 ? [k, 8] : k < 8 ? [k + 1, 8] : k < 9 ? [8, 7] : [8, 14 - k];
        A[a[0]][a[1]] = fb(k);
        var b = k < 8 ? [8, N - 1 - k] : [N - 15 + k, 8];
        A[b[0]][b[1]] = fb(k);
      }
      A[N - 8][8] = 1;
      if (ver >= 7) { var vi = bch(ver, 0x1f25, 12); for (var t = 0; t < 18; t++) { var bit = (vi >> t) & 1, ra = Math.floor(t / 3), ca = N - 11 + (t % 3); A[ra][ca] = bit; A[ca][ra] = bit; } }
      return A;
    }
    function pen(A) {
      var s = 0, a, b, run, cnt;
      for (a = 0; a < N; a++) for (var dir = 0; dir < 2; dir++) { run = 1; for (b = 1; b < N; b++) { var cur = dir ? A[b][a] : A[a][b], prev = dir ? A[b - 1][a] : A[a][b - 1]; if (cur === prev) { run++; if (run === 5) s += 3; else if (run > 5) s++; } else run = 1; } }
      for (a = 0; a < N - 1; a++) for (b = 0; b < N - 1; b++) { var v1 = A[a][b]; if (v1 === A[a][b + 1] && v1 === A[a + 1][b] && v1 === A[a + 1][b + 1]) s += 3; }
      cnt = 0; A.forEach(function (row) { row.forEach(function (x) { cnt += x; }); }); s += Math.floor(Math.abs(cnt * 100 / (N * N) - 50) / 5) * 10;
      return s;
    }
    var best = null, bs = 1e9; for (var mk = 0; mk < 8; mk++) { var A = build(mk), p = pen(A); if (p < bs) { bs = p; best = A; } }
    return best;
  }
  // restituisce un elemento <svg> con il codice (4 moduli di bordo bianco)
  g.liaQR = function (text, px) {
    var A = make(text); if (!A) return null; var N = A.length, q = 4, d = '', r, c;
    for (r = 0; r < N; r++) for (c = 0; c < N; c++) if (A[r][c]) d += 'M' + (c + q) + ' ' + (r + q) + 'h1v1h-1z';
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 ' + (N + 2 * q) + ' ' + (N + 2 * q)); s.setAttribute('width', px || 180); s.setAttribute('height', px || 180); s.setAttribute('shape-rendering', 'crispEdges'); s.setAttribute('role', 'img');
    var bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect'); bg.setAttribute('width', N + 2 * q); bg.setAttribute('height', N + 2 * q); bg.setAttribute('fill', '#fff'); s.appendChild(bg);
    var p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d); p.setAttribute('fill', '#000'); s.appendChild(p); return s;
  };
  g.liaQRMatrix = make;
})(typeof window !== 'undefined' ? window : globalThis);
