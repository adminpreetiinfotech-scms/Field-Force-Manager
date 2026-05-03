/**
 * docProcessorHtml.ts
 *
 * Inline HTML loaded inside a 1×1 hidden WebView.
 * Performs real document image processing:
 *  1. Grayscale → Gaussian blur → Sobel edge detection
 *  2. Threshold + dilation → document quad detection (projection profiles + corner search)
 *  3. Perspective correction via homography (DLT + Gaussian elimination)
 *  4. Enhancement: brightness, contrast, unsharp-mask sharpening
 *
 * Message protocol (strings, JSON):
 *  RN → WV : { id, action:'process', imageBase64, docType, guideCorners?, enhance?, brightness?, contrast?, sharpness? }
 *  WV → RN : { id, type:'processed', imageDataUri, autoDetected, corners }
 *  WV → RN : { id, type:'error', error }
 *  WV → RN : { type:'ready' }
 */

export const DOC_PROCESSOR_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>* { margin:0; padding:0; } body { background:#000; overflow:hidden; }</style>
</head>
<body>
<canvas id="c" style="display:none;position:absolute;left:0;top:0;"></canvas>
<script>
(function () {
'use strict';

var canvas = document.getElementById('c');
var ctx    = canvas.getContext('2d');

// ── Utilities ────────────────────────────────────────────────────────────────

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

// ── Image loader ─────────────────────────────────────────────────────────────

function loadImage(src) {
  return new Promise(function (resolve, reject) {
    var img = new Image();
    img.onload  = function () { resolve(img); };
    img.onerror = function () { reject(new Error('img load failed')); };
    img.src = (src.indexOf('data:') === 0) ? src : ('data:image/jpeg;base64,' + src);
  });
}

// ── Grayscale ────────────────────────────────────────────────────────────────

function toGray(data, n) {
  var g = new Float32Array(n);
  for (var i = 0; i < n; i++) {
    var j = i << 2;
    g[i] = data[j] * 0.299 + data[j + 1] * 0.587 + data[j + 2] * 0.114;
  }
  return g;
}

// ── Separable Gaussian blur (5-tap: [1,4,6,4,1]/16) ─────────────────────────

function gaussBlur(src, w, h) {
  var K   = [0.0625, 0.25, 0.375, 0.25, 0.0625];
  var tmp = new Float32Array(w * h);
  var dst = new Float32Array(w * h);
  var x, y, k, xx, yy, s;

  for (y = 0; y < h; y++) {
    for (x = 0; x < w; x++) {
      s = 0;
      for (k = -2; k <= 2; k++) {
        xx = clamp(x + k, 0, w - 1);
        s += src[y * w + xx] * K[k + 2];
      }
      tmp[y * w + x] = s;
    }
  }

  for (y = 0; y < h; y++) {
    for (x = 0; x < w; x++) {
      s = 0;
      for (k = -2; k <= 2; k++) {
        yy = clamp(y + k, 0, h - 1);
        s += tmp[yy * w + x] * K[k + 2];
      }
      dst[y * w + x] = s;
    }
  }
  return dst;
}

// ── Sobel edge magnitude ─────────────────────────────────────────────────────

function sobelMag(src, w, h) {
  var mag    = new Float32Array(w * h);
  var maxMag = 0;
  var y, x, i, gx, gy, m;

  for (y = 1; y < h - 1; y++) {
    for (x = 1; x < w - 1; x++) {
      i  = y * w + x;
      gx = -src[i - w - 1] - 2 * src[i - 1] - src[i + w - 1]
           +src[i - w + 1] + 2 * src[i + 1] + src[i + w + 1];
      gy = -src[i - w - 1] - 2 * src[i - w] - src[i - w + 1]
           +src[i + w - 1] + 2 * src[i + w] + src[i + w + 1];
      m = Math.sqrt(gx * gx + gy * gy);
      mag[i] = m;
      if (m > maxMag) maxMag = m;
    }
  }
  return { mag: mag, maxMag: maxMag };
}

// ── Threshold + 3×3 morphological dilation ───────────────────────────────────

function threshDilate(mag, maxMag, w, h) {
  var thresh = maxMag * 0.13;
  var bin    = new Uint8Array(w * h);
  var dil    = new Uint8Array(w * h);
  var i, y, x;

  for (i = 0; i < w * h; i++) { if (mag[i] > thresh) bin[i] = 1; }

  for (y = 1; y < h - 1; y++) {
    for (x = 1; x < w - 1; x++) {
      i = y * w + x;
      if (bin[i] || bin[i-1] || bin[i+1] ||
          bin[i-w] || bin[i+w] ||
          bin[i-w-1] || bin[i-w+1] ||
          bin[i+w-1] || bin[i+w+1]) {
        dil[i] = 1;
      }
    }
  }
  return dil;
}

// ── Polygon area (shoelace) ───────────────────────────────────────────────────

function polyArea4(pts) {
  var a = 0;
  for (var i = 0; i < 4; i++) {
    var j = (i + 1) % 4;
    a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(a) * 0.5;
}

// ── Best corner in a quadrant region ─────────────────────────────────────────

function bestCorner(edges, w, h, x1, y1, x2, y2, mode) {
  var best = null, bestS = -Infinity;
  var xa = Math.max(0, Math.round(x1)), xb = Math.min(w - 1, Math.round(x2));
  var ya = Math.max(0, Math.round(y1)), yb = Math.min(h - 1, Math.round(y2));
  var x, y, s;

  for (y = ya; y <= yb; y++) {
    for (x = xa; x <= xb; x++) {
      if (!edges[y * w + x]) continue;
      if      (mode === 'tl') s = -(x + y);
      else if (mode === 'tr') s =   x - y;
      else if (mode === 'br') s =   x + y;
      else                    s =   y - x;   // bl
      if (s > bestS) { bestS = s; best = { x: x, y: y }; }
    }
  }
  return best;
}

// ── Document quad detection ───────────────────────────────────────────────────

function detectQuad(edges, w, h) {
  var rowSum = new Int32Array(h);
  var colSum = new Int32Array(w);
  var x, y, i;

  for (y = 0; y < h; y++) {
    for (x = 0; x < w; x++) {
      if (edges[y * w + x]) { rowSum[y]++; colSum[x]++; }
    }
  }

  var maxR = 0, maxC = 0;
  for (i = 0; i < h; i++) { if (rowSum[i] > maxR) maxR = rowSum[i]; }
  for (i = 0; i < w; i++) { if (colSum[i] > maxC) maxC = colSum[i]; }
  if (maxR === 0 || maxC === 0) return null;

  var rT = maxR * 0.12, cT = maxC * 0.12;
  var top    = Math.floor(h * 0.05),  bottom = Math.floor(h * 0.95);
  var left   = Math.floor(w * 0.05),  right  = Math.floor(w * 0.95);

  for (y = Math.floor(h * 0.05); y < h * 0.5;  y++) { if (rowSum[y] > rT) { top    = y; break; } }
  for (y = Math.floor(h * 0.95); y > h * 0.5;  y--) { if (rowSum[y] > rT) { bottom = y; break; } }
  for (x = Math.floor(w * 0.05); x < w * 0.5;  x++) { if (colSum[x] > cT) { left   = x; break; } }
  for (x = Math.floor(w * 0.95); x > w * 0.5;  x--) { if (colSum[x] > cT) { right  = x; break; } }

  // Reject if detected region is too small
  if ((bottom - top) < h * 0.15 || (right - left) < w * 0.15) return null;

  // Tiny inward margin
  var mt = Math.round(Math.min(w, h) * 0.008);
  top    += mt; bottom -= mt; left  += mt; right -= mt;

  // Corner search in each quadrant
  var qw = Math.round((right  - left)   * 0.28);
  var qh = Math.round((bottom - top)    * 0.28);

  var tl = bestCorner(edges, w, h, left - qw, top - qh,    left + qw * 2, top + qh * 2, 'tl') || { x: left,  y: top    };
  var tr = bestCorner(edges, w, h, right - qw * 2, top - qh, right + qw, top + qh * 2, 'tr') || { x: right, y: top    };
  var br = bestCorner(edges, w, h, right - qw * 2, bottom - qh * 2, right + qw, bottom + qh, 'br') || { x: right, y: bottom };
  var bl = bestCorner(edges, w, h, left - qw, bottom - qh * 2, left + qw * 2, bottom + qh, 'bl') || { x: left,  y: bottom };

  // Validate area >= 8 % of image
  var area = polyArea4([tl, tr, br, bl]);
  if (area < w * h * 0.08) return null;

  return [tl, tr, br, bl];
}

// ── Gaussian elimination (8×8) ────────────────────────────────────────────────

function gaussElim8(A, b) {
  var n = 8, i, j, row, col, piv, f, tmp;
  var M = [];
  for (i = 0; i < n; i++) {
    M.push(A[i].slice());
    M[i].push(b[i]);
  }

  for (col = 0; col < n; col++) {
    // Partial pivot
    var maxRow = col, maxV = Math.abs(M[col][col]);
    for (row = col + 1; row < n; row++) {
      var v = Math.abs(M[row][col]);
      if (v > maxV) { maxV = v; maxRow = row; }
    }
    tmp = M[col]; M[col] = M[maxRow]; M[maxRow] = tmp;
    if (Math.abs(M[col][col]) < 1e-12) return null;

    piv = M[col][col];
    for (j = col; j <= n; j++) M[col][j] /= piv;

    for (row = 0; row < n; row++) {
      if (row === col) continue;
      f = M[row][col];
      for (j = col; j <= n; j++) M[row][j] -= f * M[col][j];
    }
  }
  return M.map(function (r) { return r[n]; });
}

// ── Homography (DLT): srcPts[4] → dstPts[4], returns 9-element H ─────────────

function computeH(srcPts, dstPts) {
  var A = [], b = [], i, xs, ys, xd, yd;

  for (i = 0; i < 4; i++) {
    xs = srcPts[i].x; ys = srcPts[i].y;
    xd = dstPts[i].x; yd = dstPts[i].y;
    A.push([xs, ys, 1, 0, 0, 0, -xd * xs, -xd * ys]); b.push(xd);
    A.push([0, 0, 0, xs, ys, 1, -yd * xs, -yd * ys]); b.push(yd);
  }

  var h = gaussElim8(A, b);
  if (!h) return null;
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

// ── Perspective warp (inverse mapping + bilinear interpolation) ───────────────

function warpPerspective(srcPixels, srcW, srcH, corners, outW, outH) {
  // Inverse H: maps each output pixel → source pixel
  var dstPts = [
    { x: 0,       y: 0       },
    { x: outW - 1, y: 0       },
    { x: outW - 1, y: outH - 1 },
    { x: 0,       y: outH - 1 }
  ];
  var H = computeH(dstPts, corners);
  if (!H) return null;

  var h0=H[0], h1=H[1], h2=H[2],
      h3=H[3], h4=H[4], h5=H[5],
      h6=H[6], h7=H[7], h8=H[8];

  var oc   = document.createElement('canvas');
  oc.width  = outW;
  oc.height = outH;
  var octx = oc.getContext('2d');
  var outImg = octx.createImageData(outW, outH);
  var out    = outImg.data;
  var src    = srcPixels;
  var rowStride = srcW << 2;

  var ox, oy, ww, sx, sy, x0, y0, x1, y1, fx, fy;
  var w00, w10, w01, w11, i00, i10, i01, i11, oi;

  for (oy = 0; oy < outH; oy++) {
    for (ox = 0; ox < outW; ox++) {
      ww = h6 * ox + h7 * oy + h8;
      sx = (h0 * ox + h1 * oy + h2) / ww;
      sy = (h3 * ox + h4 * oy + h5) / ww;

      x0 = sx | 0;  y0 = sy | 0;
      x1 = x0 + 1; y1 = y0 + 1;
      oi = (oy * outW + ox) << 2;

      if (x0 >= 0 && y0 >= 0 && x1 < srcW && y1 < srcH) {
        fx = sx - x0;  fy = sy - y0;
        w00 = (1 - fx) * (1 - fy);
        w10 = fx       * (1 - fy);
        w01 = (1 - fx) * fy;
        w11 = fx       * fy;

        i00 = (y0 * srcW + x0) << 2;
        i10 = i00 + 4;
        i01 = i00 + rowStride;
        i11 = i01 + 4;

        out[oi]     = (src[i00]     * w00 + src[i10]     * w10 + src[i01]     * w01 + src[i11]     * w11) | 0;
        out[oi + 1] = (src[i00 + 1] * w00 + src[i10 + 1] * w10 + src[i01 + 1] * w01 + src[i11 + 1] * w11) | 0;
        out[oi + 2] = (src[i00 + 2] * w00 + src[i10 + 2] * w10 + src[i01 + 2] * w01 + src[i11 + 2] * w11) | 0;
        out[oi + 3] = 255;
      } else {
        out[oi] = out[oi + 1] = out[oi + 2] = out[oi + 3] = 255;
      }
    }
  }

  octx.putImageData(outImg, 0, 0);
  return oc;
}

// ── Image enhancement: brightness, contrast, unsharp-mask ────────────────────

function enhance(ctx, w, h, brightness, contrast, sharpness) {
  var imgData = ctx.getImageData(0, 0, w, h);
  var data = imgData.data;
  var n = w * h * 4;
  var i, c, v;

  // Brightness + contrast per channel
  for (i = 0; i < n; i += 4) {
    for (c = 0; c < 3; c++) {
      v = data[i + c];
      v = (v - 128) * contrast + 128;   // contrast (centered at mid-grey)
      v = v * brightness;                // brightness (multiplicative)
      data[i + c] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
  }

  // Unsharp mask when sharpness > 1
  if (sharpness > 1.0) {
    var amount = Math.min((sharpness - 1.0) * 1.5, 1.0);
    var blurred = new Uint8Array(n);
    var yi, xi, base, kb;

    // BUG FIX: pre-fill blurred with original values so border pixels (which
    // the box blur skips) have blurred[i] == data[i] → zero sharpening at borders,
    // avoiding white-fringe / contrast-blow-out artifacts on the image edges.
    for (kb = 0; kb < n; kb++) blurred[kb] = data[kb];

    // 3×3 box blur into blurred[] — interior pixels only
    for (yi = 1; yi < h - 1; yi++) {
      for (xi = 1; xi < w - 1; xi++) {
        base = (yi * w + xi) << 2;
        for (c = 0; c < 3; c++) {
          blurred[base + c] = ((
            data[base + c] +
            data[base - 4 + c] + data[base + 4 + c] +
            data[base - (w << 2) + c] + data[base + (w << 2) + c] +
            data[base - (w << 2) - 4 + c] + data[base - (w << 2) + 4 + c] +
            data[base + (w << 2) - 4 + c] + data[base + (w << 2) + 4 + c]
          ) / 9) | 0;
        }
        blurred[base + 3] = 255;
      }
    }

    // Apply: output = original + amount * (original - blurred)
    for (i = 0; i < n; i += 4) {
      for (c = 0; c < 3; c++) {
        v = data[i + c] + amount * (data[i + c] - blurred[i + c]);
        data[i + c] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

// ── Output size per docType (pixels) ─────────────────────────────────────────

var DOC_SIZES = {
  aadhaar_front:  { w: 1012, h: 638  },
  aadhaar_back:   { w: 1012, h: 638  },
  bank_passbook:  { w: 874,  h: 1240 },
  education_cert: { w: 1240, h: 1754 },
  caste_cert:     { w: 1240, h: 1754 },
  other:          { w: 1240, h: 1754 },
  card:           { w: 1012, h: 638  },
  page:           { w: 1240, h: 1754 }
};

// ── Concurrency guard — one request at a time, last-in-wins queue ────────────
// If a second request arrives while the first is still running, we queue it
// and discard any previously-queued (but not yet started) request.

var _busy   = false;
var _queued = null;

function _onDone() {
  _busy = false;
  if (_queued) {
    var next = _queued;
    _queued = null;
    _runProcess(next);
  }
}

function processDoc(msg) {
  if (_busy) {
    // Supersede any previously queued (not-yet-started) request
    if (_queued) {
      post({ id: _queued.id, type: 'error', error: 'Superseded by newer request' });
    }
    _queued = msg;
    return;
  }
  _runProcess(msg);
}

// ── Core processing (called by processDoc, serialised via _busy flag) ─────────

function _runProcess(msg) {
  _busy = true;

  var id           = msg.id;
  var docType      = msg.docType      || 'page';
  var brightness   = msg.brightness   != null ? msg.brightness  : 1.08;
  var contrast     = msg.contrast     != null ? msg.contrast    : 1.12;
  var sharpness    = msg.sharpness    != null ? msg.sharpness   : 1.35;
  var doEnhance    = msg.enhance      !== false;
  var guideCorners = msg.guideCorners || null;

  loadImage(msg.imageBase64).then(function (img) {
    var fullW = img.naturalWidth  || img.width;
    var fullH = img.naturalHeight || img.height;

    // ── Step 1: Edge detection at reduced resolution ──────────────────────────
    var dW    = Math.min(700, fullW);
    var dH    = Math.round(dW * fullH / fullW);
    var scale = fullW / dW;

    canvas.width  = dW;
    canvas.height = dH;
    ctx.drawImage(img, 0, 0, dW, dH);

    var dImgData     = ctx.getImageData(0, 0, dW, dH);
    var gray         = toGray(dImgData.data, dW * dH);
    var blurredGray  = gaussBlur(gray, dW, dH);
    var sm           = sobelMag(blurredGray, dW, dH);
    var edges        = threshDilate(sm.mag, sm.maxMag, dW, dH);
    var quad         = detectQuad(edges, dW, dH);
    var autoDetected = !!quad;

    // ── Step 2: Source corners in full-resolution image space ─────────────────
    var srcCorners;
    if (quad) {
      srcCorners = quad.map(function (p) {
        return { x: Math.round(p.x * scale), y: Math.round(p.y * scale) };
      });
    } else if (guideCorners && guideCorners.length === 4) {
      srcCorners   = guideCorners;
      autoDetected = false;
    } else {
      var mx = Math.round(fullW * 0.03), my = Math.round(fullH * 0.03);
      srcCorners = [
        { x: mx,         y: my         },
        { x: fullW - mx, y: my         },
        { x: fullW - mx, y: fullH - my },
        { x: mx,         y: fullH - my }
      ];
      autoDetected = false;
    }

    // ── Step 3: Output dimensions for docType ─────────────────────────────────
    var sz   = DOC_SIZES[docType] || DOC_SIZES.page;
    var outW = sz.w, outH = sz.h;

    // ── Step 4: Draw full-resolution image for warping ────────────────────────
    canvas.width  = fullW;
    canvas.height = fullH;
    ctx.drawImage(img, 0, 0, fullW, fullH);
    var fullData = ctx.getImageData(0, 0, fullW, fullH);

    // ── Step 5: Perspective warp at 68 % scale (then canvas upscales) ─────────
    var wW = Math.round(outW * 0.68);
    var wH = Math.round(outH * 0.68);
    var warped = warpPerspective(fullData.data, fullW, fullH, srcCorners, wW, wH);
    if (!warped) {
      post({ id: id, type: 'error', error: 'Perspective transform failed — singular matrix' });
      _onDone();
      return;
    }

    // ── Step 6: Draw warped canvas at final output resolution ─────────────────
    canvas.width  = outW;
    canvas.height = outH;
    ctx.drawImage(warped, 0, 0, outW, outH);

    // ── Step 7: Enhancement ───────────────────────────────────────────────────
    if (doEnhance) {
      enhance(ctx, outW, outH, brightness, contrast, sharpness);
    }

    // ── Step 8: Export as JPEG data URI ──────────────────────────────────────
    var dataUri = canvas.toDataURL('image/jpeg', 0.93);
    post({
      id:           id,
      type:         'processed',
      imageDataUri: dataUri,
      autoDetected: autoDetected,
      corners:      srcCorners
    });
    _onDone();

  }).catch(function (err) {
    post({ id: id, type: 'error', error: err.message || 'Unknown processing error' });
    _onDone();
  });
}

// ── Message bridge ────────────────────────────────────────────────────────────

function post(data) {
  var s = JSON.stringify(data);
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(s);
  } else {
    window.parent.postMessage(s, '*');
  }
}

function onMsg(e) {
  if (!e.data) return;
  var msg;
  try { msg = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; }
  catch (_) { return; }
  if (msg.action === 'process') processDoc(msg);
  else if (msg.action === 'ping') post({ id: msg.id, type: 'pong' });
}

document.addEventListener('message', onMsg);   // Android
window.addEventListener('message', onMsg);     // iOS

// Signal readiness
post({ type: 'ready' });

})();
</script>
</body>
</html>`;
