(() => {
  'use strict';

  const QUIET = 4;          // margem em módulos
  const ICON_RATIO = 0.22;  // largura do ícone em relação ao código
  const PNG_SIZE = 1024;
  const DARK = '#0a0a0a';
  const LIGHT = '#ffffff';

  const $ = (id) => document.getElementById(id);
  const input = $('url');
  const preview = $('preview');
  const qrBox = $('qr');
  const hint = $('hint');
  const withIcon = $('withIcon');
  const buttons = { png: $('png'), svg: $('svg'), copy: $('copy') };

  qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

  let iconPath = null;
  let current = null; // { svg, url }

  fetch('icon.svg')
    .then((r) => r.text())
    .then((text) => {
      const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
      const svg = doc.querySelector('svg');
      const path = doc.querySelector('path');
      if (!svg || !path) return;
      const [, , w, h] = svg.getAttribute('viewBox').split(/\s+/).map(Number);
      iconPath = { d: path.getAttribute('d'), w, h };
      render();
    })
    .catch(() => {});

  function normalize(raw) {
    const value = raw.trim();
    if (!value) return null;
    const withScheme = /^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`;
    try {
      const url = new URL(withScheme);
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.') && url.hostname !== 'localhost') {
        return null;
      }
      return withScheme;
    } catch {
      return null;
    }
  }

  function buildSvg(text, icon) {
    const qr = qrcode(0, icon ? 'H' : 'M');
    qr.addData(text, 'Byte');
    qr.make();

    const count = qr.getModuleCount();
    const size = count + QUIET * 2;
    let d = '';
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) d += `M${c + QUIET} ${r + QUIET}h1v1h-1z`;
      }
    }

    let overlay = '';
    if (icon) {
      // área limpa (em módulos inteiros) centralizada para o ícone
      let box = Math.ceil(count * ICON_RATIO);
      if ((count - box) % 2) box += 1;
      const start = QUIET + (count - box) / 2;
      const pad = box * 0.14;
      const inner = box - pad * 2;
      const scale = inner / Math.max(icon.w, icon.h);
      const tx = start + pad + (inner - icon.w * scale) / 2;
      const ty = start + pad + (inner - icon.h * scale) / 2;
      overlay =
        `<rect x="${start}" y="${start}" width="${box}" height="${box}" fill="${LIGHT}"/>` +
        `<path fill="${DARK}" fill-rule="evenodd" transform="translate(${tx} ${ty}) scale(${scale})" d="${icon.d}"/>`;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">` +
      `<rect width="${size}" height="${size}" fill="${LIGHT}"/>` +
      `<path fill="${DARK}" d="${d}"/>` +
      overlay.replace('<path', '<path shape-rendering="geometricPrecision"') +
      `</svg>`;
  }

  function setEnabled(on) {
    Object.values(buttons).forEach((b) => { b.disabled = !on; });
  }

  function render() {
    const raw = input.value;
    const url = normalize(raw);

    if (!url) {
      current = null;
      preview.toggleAttribute('data-empty', true);
      qrBox.innerHTML = '';
      hint.textContent = raw.trim() ? 'url inválida' : '';
      setEnabled(false);
      return;
    }

    try {
      const svg = buildSvg(url, withIcon.checked && iconPath);
      current = { svg, url };
      qrBox.innerHTML = svg;
      preview.toggleAttribute('data-empty', false);
      hint.textContent = url;
      setEnabled(true);
    } catch {
      current = null;
      preview.toggleAttribute('data-empty', true);
      hint.textContent = 'url longa demais';
      setEnabled(false);
    }
  }

  function filename(ext) {
    try {
      const host = new URL(current.url).hostname.replace(/^www\./, '');
      return `qr-${host}.${ext}`;
    } catch {
      return `qr.${ext}`;
    }
  }

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function toPng(svg) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = PNG_SIZE;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, PNG_SIZE, PNG_SIZE);
        URL.revokeObjectURL(src);
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png');
      };
      img.onerror = () => { URL.revokeObjectURL(src); reject(new Error('svg')); };
      img.src = src;
    });
  }

  function flash(button, text) {
    const original = button.dataset.label || button.textContent;
    button.dataset.label = original;
    button.textContent = text;
    clearTimeout(button._t);
    button._t = setTimeout(() => { button.textContent = original; }, 1400);
  }

  buttons.svg.addEventListener('click', () => {
    if (!current) return;
    download(new Blob([current.svg], { type: 'image/svg+xml' }), filename('svg'));
  });

  buttons.png.addEventListener('click', async () => {
    if (!current) return;
    download(await toPng(current.svg), filename('png'));
  });

  buttons.copy.addEventListener('click', async () => {
    if (!current) return;
    try {
      const png = toPng(current.svg);
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
      flash(buttons.copy, 'copiado');
    } catch {
      flash(buttons.copy, 'falhou');
    }
  });

  input.addEventListener('input', render);
  withIcon.addEventListener('change', render);
  $('form').addEventListener('submit', (e) => { e.preventDefault(); input.blur(); });

  const initial = new URLSearchParams(location.search).get('url');
  if (initial) input.value = initial;
  render();
})();
