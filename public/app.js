// ================================================
//  YT MP3 Converter — Frontend Logic
// ================================================

const API_BASE = '';

// DOM References
const urlInput = document.getElementById('youtube-url');
const convertBtn = document.getElementById('convert-btn');
const pasteBtn = document.getElementById('paste-btn');
const videoPreview = document.getElementById('video-preview');
const progressSection = document.getElementById('progress-section');
const downloadReady = document.getElementById('download-ready');
const errorSection = document.getElementById('error-section');
const newBtn = document.getElementById('new-btn');
const retryBtn = document.getElementById('retry-btn');
const downloadLink = document.getElementById('download-link');

// State
let currentUrl = '';
let currentTitle = '';

// ====== PARTICLES ======
(function initParticles() {
  const canvas = document.getElementById('particles-canvas');
  const ctx = canvas.getContext('2d');
  let W = window.innerWidth, H = window.innerHeight;
  canvas.width = W; canvas.height = H;

  const particles = Array.from({ length: 60 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: Math.random() * 1.5 + 0.3,
    dx: (Math.random() - 0.5) * 0.3,
    dy: (Math.random() - 0.5) * 0.3,
    alpha: Math.random() * 0.5 + 0.1,
  }));

  function draw() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(168, 85, 247, ${p.alpha})`;
      ctx.fill();
      p.x += p.dx; p.y += p.dy;
      if (p.x < 0 || p.x > W) p.dx *= -1;
      if (p.y < 0 || p.y > H) p.dy *= -1;
    });
    requestAnimationFrame(draw);
  }
  draw();

  window.addEventListener('resize', () => {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  });
})();

// ====== PASTE BUTTON ======
pasteBtn.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    urlInput.value = text;
    urlInput.dispatchEvent(new Event('input'));
  } catch { urlInput.focus(); }
});

// ====== FORMAT HELPERS ======
function formatDuration(seconds) {
  if (!seconds) return 'Desconocido';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}
function formatViews(n) {
  if (!n) return '';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B vistas';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M vistas';
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K vistas';
  return n + ' vistas';
}

// ====== UI STATE HELPERS ======
function hideAll() {
  videoPreview.style.display = 'none';
  progressSection.style.display = 'none';
  downloadReady.style.display = 'none';
  errorSection.style.display = 'none';
}
function showError(msg) {
  hideAll();
  document.getElementById('error-message').textContent = msg;
  errorSection.style.display = 'flex';
  setConvertBtn('normal');
}
function setConvertBtn(state) {
  const btn = convertBtn;
  const btnText = btn.querySelector('.btn-text');
  const btnIcon = btn.querySelector('.btn-icon');
  btn.disabled = state === 'loading';
  btn.classList.toggle('loading', state === 'loading');

  if (state === 'loading') {
    btnText.textContent = 'Buscando...';
  } else if (state === 'downloading') {
    btnText.textContent = 'Procesando...';
    btn.disabled = true;
  } else {
    btnText.textContent = 'Buscar Video';
    btn.disabled = false;
  }
}
function setProgress(percent, label) {
  document.getElementById('progress-bar').style.width = `${percent}%`;
  document.getElementById('progress-percent').textContent = `${Math.round(percent)}%`;
  document.getElementById('progress-label').textContent = label;
}
function setStep(step) {
  document.getElementById('step-download').className = 'step';
  document.getElementById('step-convert').className = 'step';
  document.getElementById('step-ready').className = 'step';

  if (step === 'download') {
    document.getElementById('step-download').className = 'step active';
  } else if (step === 'convert') {
    document.getElementById('step-download').className = 'step done';
    document.getElementById('step-convert').className = 'step active';
  } else if (step === 'done') {
    document.getElementById('step-download').className = 'step done';
    document.getElementById('step-convert').className = 'step done';
    document.getElementById('step-ready').className = 'step done';
  }
}

// ====== FETCH VIDEO INFO ======
async function fetchVideoInfo(url) {
  setConvertBtn('loading');
  hideAll();

  try {
    const res = await fetch(`/api/info?url=${encodeURIComponent(url)}`);

    let data;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      // The server returned HTML or something else — probably not running
      const text = await res.text();
      console.error('Respuesta inesperada del servidor:', text.substring(0, 200));
      throw new Error('El servidor no devolvió una respuesta válida. Asegúrate de que el servidor Node.js esté corriendo (npm start).');
    }

    if (!res.ok) throw new Error(data.error || 'Error desconocido');

    currentUrl = url;
    currentTitle = data.title;

    // Populate preview
    document.getElementById('preview-thumbnail').src = data.thumbnail || '';
    document.getElementById('preview-title').textContent = data.title;
    document.querySelector('#preview-uploader span').textContent = data.uploader || '';
    document.querySelector('#preview-duration span').textContent = formatDuration(data.duration);
    document.querySelector('#preview-views span').textContent = formatViews(data.view_count);

    videoPreview.style.display = 'flex';
    setConvertBtn('normal');
    convertBtn.querySelector('.btn-text').textContent = 'Convertir a MP3';

  } catch (err) {
    if (err instanceof TypeError && err.message.includes('fetch')) {
      showError('No se pudo conectar con el servidor. Asegúrate de que esté corriendo con "npm start" y accede desde http://localhost:3000');
    } else {
      showError(err.message || 'No se pudo obtener la información del video.');
    }
  }
}

// ====== START CONVERSION via SSE ======
async function startConversion(url) {
  hideAll();
  progressSection.style.display = 'flex';
  setConvertBtn('downloading');
  setProgress(0, 'Iniciando...');
  setStep('download');

  return new Promise((resolve, reject) => {
    const evtSrc = new EventSource(`/api/progress?url=${encodeURIComponent(url)}`);

    evtSrc.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);

        if (data.status === 'starting') {
          setProgress(2, 'Iniciando descarga...');
          setStep('download');
        } else if (data.status === 'downloading') {
          setProgress(data.progress * 0.8, data.message);
          setStep('download');
        } else if (data.status === 'converting') {
          setProgress(data.progress, data.message);
          setStep('convert');
        } else if (data.status === 'done') {
          setProgress(100, '¡Listo!');
          setStep('done');
          evtSrc.close();

          // Build download URL
          const downloadId = data.downloadId;
          const fileName = encodeURIComponent(currentTitle || 'audio') + '.mp3';
          const href = `/downloads/${downloadId}?title=${fileName}`;
          downloadLink.href = href;
          downloadLink.setAttribute('download', (currentTitle || 'audio') + '.mp3');

          setTimeout(() => {
            progressSection.style.display = 'none';
            downloadReady.style.display = 'flex';
            setConvertBtn('normal');
            convertBtn.querySelector('.btn-text').textContent = 'Buscar Video';
          }, 600);

          resolve(downloadId);

        } else if (data.status === 'error') {
          evtSrc.close();
          showError(data.message || 'Error al convertir el video.');
          reject(new Error(data.message));
        }
      } catch (_) {}
    };

    evtSrc.onerror = () => {
      evtSrc.close();
      showError('Se perdió la conexión con el servidor. Verifica que el servidor esté corriendo.');
      reject(new Error('SSE error'));
    };
  });
}

// ====== MAIN BUTTON CLICK ======
let phase = 'search'; // 'search' or 'convert'

convertBtn.addEventListener('click', async () => {
  const url = urlInput.value.trim();
  if (!url) { urlInput.focus(); return; }

  if (!isYouTubeUrl(url)) {
    showError('Por favor ingresa una URL válida de YouTube.');
    return;
  }

  if (phase === 'search' || currentUrl !== url) {
    phase = 'search';
    await fetchVideoInfo(url);
    if (videoPreview.style.display !== 'none') {
      phase = 'convert';
    }
  } else if (phase === 'convert') {
    phase = 'search';
    try {
      await startConversion(url);
    } catch (_) {}
  }
});

// ====== URL VALIDATION ======
function isYouTubeUrl(url) {
  return /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/)|youtu\.be\/)[\w\-]+/.test(url);
}

// ====== INPUT EVENTS ======
urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') convertBtn.click();
});

urlInput.addEventListener('input', () => {
  // Reset phase if URL changed
  if (urlInput.value.trim() !== currentUrl) {
    phase = 'search';
    convertBtn.querySelector('.btn-text').textContent = 'Buscar Video';
    hideAll();
  }
});

// ====== NEW / RETRY BUTTONS ======
newBtn.addEventListener('click', () => {
  urlInput.value = '';
  currentUrl = '';
  currentTitle = '';
  phase = 'search';
  hideAll();
  convertBtn.querySelector('.btn-text').textContent = 'Buscar Video';
  urlInput.focus();
});

retryBtn.addEventListener('click', () => {
  phase = 'search';
  hideAll();
  convertBtn.click();
});

// ====== DOWNLOAD LINK (with title header fix) ======
downloadLink.addEventListener('click', async (e) => {
  e.preventDefault();
  const href = downloadLink.getAttribute('href');
  if (!href || href === '#') return;

  try {
    const response = await fetch(href);
    if (!response.ok) throw new Error('Error al descargar');

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (currentTitle || 'audio') + '.mp3';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch (err) {
    showError('Error al descargar el archivo: ' + err.message);
  }
});
