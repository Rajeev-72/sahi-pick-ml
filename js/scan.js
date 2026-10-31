/* Sahi Pick · scan.js — camera barcode scanning (#/scan) */
(() => {
  'use strict';
  const { $, pageHead } = SP;

  /* ---- Barcode reading: built-in detector, or ZXing as a fallback ---- */
  const ZXING_URL = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
  let zxingPromise = null;
  const loadZXing = () => {
    if (window.ZXing) return Promise.resolve(window.ZXing);
    if (!zxingPromise) {
      zxingPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = ZXING_URL;
        s.onload = () => resolve(window.ZXing);
        s.onerror = () => { zxingPromise = null; reject(new Error('Couldn’t load the barcode reader. Check your connection.')); };
        document.head.appendChild(s);
      });
    }
    return zxingPromise;
  };

  // Returns an async function: (videoElement) => barcode text or null
  async function makeDetector() {
    if ('BarcodeDetector' in window) {
      const d = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
      return async (video) => { const f = await d.detect(video); return f.length ? f[0].rawValue : null; };
    }
    const Z = await loadZXing();
    const hints = new Map();
    hints.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E]);
    hints.set(Z.DecodeHintType.TRY_HARDER, true);
    const reader = new Z.MultiFormatReader();
    reader.setHints(hints);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    return async (video) => {
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      try {
        const bitmap = new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(canvas)));
        return reader.decode(bitmap).getText();
      } catch (_) { return null; }   // no barcode in this frame
    };
  }

  /* ---------------- Scan:  #/scan ---------------- */
  SP.route('/scan', ({ el }) => {
    el.innerHTML = `
      ${pageHead('Scan', 'Scan a barcode', 'Allow camera access, then hold the barcode inside the frame.')}
      <section class="finder">
        <div class="viewfinder"><video id="video" playsinline muted></video><div class="reticle"></div></div>
        <div class="row">
          <button class="btn" id="cam-start" type="button">Start camera</button>
          <button class="btn ghost" id="cam-stop" type="button">Stop</button>
          <button class="btn ghost" id="torch" type="button" disabled>Torch</button>
        </div>
        <p class="hint" id="scan-status" role="status">Hold the barcode inside the frame.</p>
        <p class="hint">No luck? <a href="#/barcode">Type the barcode instead</a>.</p>
      </section>`;

    const video = $('#video'), status = $('#scan-status');
    let stream = null, timer = null, gone = false;

    const stop = () => {
      clearInterval(timer); timer = null;
      if (stream) stream.getTracks().forEach((t) => t.stop());
      stream = null; video.srcObject = null; $('#torch').disabled = true;
    };

    $('#cam-stop').onclick = () => { stop(); status.textContent = 'Camera stopped.'; };

    $('#cam-start').onclick = async () => {
      stop();
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        status.textContent = 'Camera access needs a secure page (https or localhost). Use the Barcode page instead.';
        return;
      }
      try {
        status.textContent = 'Starting…';
        const detect = await makeDetector();
        if (gone) return;
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (gone) { stop(); return; }   // left the page while the permission prompt was open
        video.srcObject = stream;
        await video.play();

        const track = stream.getVideoTracks()[0];
        const caps = track.getCapabilities ? track.getCapabilities() : {};
        if (caps.torch) {
          let on = false;
          $('#torch').disabled = false;
          $('#torch').onclick = () => { on = !on; track.applyConstraints({ advanced: [{ torch: on }] }); };
        }
        status.textContent = 'Looking for a barcode…';

        let busy = false;
        timer = setInterval(async () => {
          if (busy || !video.videoWidth) return;
          busy = true;
          try {
            const code = await detect(video);
            if (!code || !timer) return;
            stop();
            status.textContent = `Found ${code}.`;
            SP.go('/product/' + code);
          } catch (_) { /* missed frame, try again */ }
          finally { busy = false; }
        }, 250);
      } catch (err) {
        stop();
        status.textContent = `Camera unavailable: ${err.message}. Use the Barcode page instead.`;
      }
    };

    // The router calls this when you leave, so the camera light always turns off.
    return { title: 'Scan a barcode', nav: 'scan', cleanup: () => { gone = true; stop(); } };
  });

})();
