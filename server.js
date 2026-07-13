const express = require('express');
const cors = require('cors');
const path = require('path');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Paths — detect yt-dlp binary based on OS
const isWindows = process.platform === 'win32';
const ytDlpBinary = isWindows ? 'yt-dlp.exe' : 'yt-dlp';
let ytDlpPath = path.join(__dirname, ytDlpBinary);
let ffmpegPath = '';

// Cookies file path (for YouTube bot detection bypass)
const COOKIES_FILE = process.env.COOKIES_FILE || path.join(__dirname, 'cookies.txt');

// Try to install yt-dlp automatically on Linux (for cloud deployments like Render)
function ensureYtDlp() {
  if (fs.existsSync(ytDlpPath)) return true;

  // On Linux/cloud, try to install via pip or download directly
  if (!isWindows) {
    console.log('📦 yt-dlp no encontrado localmente, intentando instalar...');

    // Try pip install
    try {
      execSync('pip install --upgrade yt-dlp', { stdio: 'inherit', timeout: 120000 });
      // Find where pip installed it
      const pipPath = execSync('which yt-dlp 2>/dev/null || echo ""', { timeout: 5000 }).toString().trim();
      if (pipPath && fs.existsSync(pipPath)) {
        ytDlpPath = pipPath;
        console.log('✅ yt-dlp instalado via pip:', ytDlpPath);
        return true;
      }
    } catch (_) {
      console.log('⚠️  pip install falló, intentando descarga directa...');
    }

    // Try direct download
    try {
      execSync(
        'curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o ./yt-dlp && chmod +x ./yt-dlp',
        { stdio: 'inherit', timeout: 60000, cwd: __dirname }
      );
      if (fs.existsSync(ytDlpPath)) {
        console.log('✅ yt-dlp descargado directamente:', ytDlpPath);
        return true;
      }
    } catch (_) {
      console.log('⚠️  Descarga directa de yt-dlp falló');
    }
  }

  return fs.existsSync(ytDlpPath);
}

// Detect ffmpeg
function detectFfmpeg() {
  // 1. Try ffmpeg-static package
  try {
    const staticPath = require('ffmpeg-static');
    if (staticPath && fs.existsSync(staticPath)) {
      console.log('✅ ffmpeg encontrado (ffmpeg-static):', staticPath);
      return staticPath;
    }
  } catch (_) {}

  // 2. Try system ffmpeg
  const candidates = isWindows
    ? ['ffmpeg', 'C:\\ffmpeg\\bin\\ffmpeg.exe', 'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe']
    : ['ffmpeg', '/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg'];
  for (const c of candidates) {
    try {
      const result = require('child_process').execSync(`"${c}" -version 2>&1`, { timeout: 3000 });
      if (result) {
        console.log('✅ ffmpeg del sistema encontrado:', c);
        return c;
      }
    } catch (_) {}
  }
  console.warn('⚠️  ffmpeg no encontrado — la conversión a MP3 puede fallar');
  return 'ffmpeg';
}

// Build common yt-dlp args to bypass bot detection
function getCommonArgs() {
  const args = [
    '--no-check-certificates',
    '--prefer-insecure',
    '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    '--extractor-args', 'youtube:player_client=web',
  ];

  // Add cookies if available
  if (fs.existsSync(COOKIES_FILE)) {
    args.push('--cookies', COOKIES_FILE);
    console.log('🍪 Usando cookies desde:', COOKIES_FILE);
  } else if (process.env.YT_COOKIES) {
    // Support cookies via environment variable (base64 encoded)
    const tmpCookies = path.join(os.tmpdir(), 'yt-cookies.txt');
    try {
      const cookieContent = Buffer.from(process.env.YT_COOKIES, 'base64').toString('utf-8');
      fs.writeFileSync(tmpCookies, cookieContent);
      args.push('--cookies', tmpCookies);
      console.log('🍪 Usando cookies desde variable de entorno YT_COOKIES');
    } catch (e) {
      console.warn('⚠️  Error al decodificar YT_COOKIES:', e.message);
    }
  }

  return args;
}

// Run yt-dlp and return a promise with stdout/stderr
function runYtDlp(args, onData) {
  return new Promise((resolve, reject) => {
    console.log('▶ yt-dlp', args.join(' '));
    const proc = spawn(ytDlpPath, args, { windowsHide: true });

    let stderr = '';
    proc.stdout.on('data', (d) => {
      const line = d.toString();
      if (onData) onData(line, 'stdout');
    });
    proc.stderr.on('data', (d) => {
      const line = d.toString();
      stderr += line;
      if (onData) onData(line, 'stderr');
    });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `yt-dlp salió con código ${code}`));
    });
    proc.on('error', reject);
  });
}

// GET /api/info?url=...
app.get('/api/info', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL requerida' });

  try {
    const data = await new Promise((resolve, reject) => {
      const infoArgs = [
        ...getCommonArgs(),
        '--dump-json',
        '--no-playlist',
        '--no-warnings',
        url,
      ];
      console.log('▶ yt-dlp info:', infoArgs.join(' '));
      const proc = spawn(ytDlpPath, infoArgs, { windowsHide: true });

      let out = '';
      let err = '';
      proc.stdout.on('data', d => out += d.toString());
      proc.stderr.on('data', d => err += d.toString());
      proc.on('close', code => {
        if (code === 0) {
          try { resolve(JSON.parse(out)); }
          catch (e) { reject(new Error('No se pudo parsear la info del video')); }
        } else {
          reject(new Error(err.trim() || 'Error obteniendo info'));
        }
      });
      proc.on('error', reject);
    });

    res.json({
      title: data.title,
      duration: data.duration,
      thumbnail: data.thumbnail,
      uploader: data.uploader || data.channel,
      view_count: data.view_count,
      upload_date: data.upload_date,
    });
  } catch (err) {
    console.error('Error /api/info:', err.message);
    res.status(500).json({ error: 'No se pudo obtener información del video: ' + err.message });
  }
});

// GET /api/progress — SSE for real-time progress and conversion
app.get('/api/progress', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'URL requerida' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendEvent = (data) => {
    try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch (_) {}
  };

  const tmpDir = os.tmpdir();
  const fileId = uuidv4();
  const outputTemplate = path.join(tmpDir, `${fileId}.%(ext)s`);
  const outputMp3 = path.join(tmpDir, `${fileId}.mp3`);

  sendEvent({ status: 'starting', message: 'Iniciando...', progress: 2 });

  try {
    // Build args — pass ffmpeg path only if we have it
    const args = [
      ...getCommonArgs(),
      url,
      '--extract-audio',
      '--audio-format', 'mp3',
      '--audio-quality', '0',
      '--output', outputTemplate,
      '--no-playlist',
      '--newline',
      '--progress',
    ];

    if (ffmpegPath && ffmpegPath !== 'ffmpeg') {
      // Pass directory containing ffmpeg, not the full path
      const ffmpegDir = path.dirname(ffmpegPath);
      args.push('--ffmpeg-location', ffmpegDir);
    }

    await runYtDlp(args, (line, type) => {
      // Parse progress lines like: [download]  45.2% of ...
      const dlMatch = line.match(/\[download\]\s+([\d.]+)%/);
      if (dlMatch) {
        const pct = parseFloat(dlMatch[1]);
        sendEvent({ status: 'downloading', progress: Math.min(pct * 0.85, 84), message: `Descargando: ${pct.toFixed(1)}%` });
        return;
      }
      // ffmpeg post-processing
      if (line.includes('[ExtractAudio]') || line.includes('Destination:')) {
        sendEvent({ status: 'converting', progress: 90, message: 'Convirtiendo a MP3 320kbps...' });
      }
    });

    sendEvent({ status: 'converting', progress: 95, message: 'Finalizando conversión...' });

    // Find the output file
    let finalFile = null;
    if (fs.existsSync(outputMp3)) {
      finalFile = outputMp3;
    } else {
      // Look for any file starting with fileId
      const files = fs.readdirSync(tmpDir).filter(f => f.startsWith(fileId));
      if (files.length > 0) {
        finalFile = path.join(tmpDir, files[0]);
      }
    }

    if (!finalFile || !fs.existsSync(finalFile)) {
      sendEvent({ status: 'error', message: 'No se generó el archivo MP3. Verifica que ffmpeg esté instalado.' });
      return res.end();
    }

    // Move to public/downloads
    const publicTmpDir = path.join(__dirname, 'public', 'downloads');
    if (!fs.existsSync(publicTmpDir)) fs.mkdirSync(publicTmpDir, { recursive: true });
    const publicFile = path.join(publicTmpDir, `${fileId}.mp3`);
    fs.renameSync(finalFile, publicFile);

    sendEvent({ status: 'done', progress: 100, message: '¡Listo!', downloadId: fileId });
    console.log(`✅ Conversión completada: ${fileId}.mp3`);

  } catch (err) {
    console.error('Error en /api/progress:', err.message);
    sendEvent({ status: 'error', message: 'Error: ' + err.message });
  }

  res.end();
});

// Serve the MP3 file for download
app.get('/downloads/:id', (req, res) => {
  const { id } = req.params;
  // Sanitize id
  if (!/^[a-f0-9\-]+$/i.test(id)) return res.status(400).json({ error: 'ID inválido' });

  const filePath = path.join(__dirname, 'public', 'downloads', `${id}.mp3`);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo no encontrado o ya fue descargado' });

  const stat = fs.statSync(filePath);
  const title = req.query.title ? decodeURIComponent(req.query.title) : `${id}.mp3`;

  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(title)}`);

  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
  stream.on('end', () => {
    setTimeout(() => fs.unlink(filePath, () => {}), 10000);
  });
  stream.on('error', () => res.end());
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    ytDlp: fs.existsSync(ytDlpPath),
    ffmpeg: ffmpegPath || 'not found',
  });
});

// Catch-all for unknown API routes — return JSON 404 instead of HTML
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Ruta API no encontrada' });
});

// SPA fallback — serve index.html for non-file routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start
ffmpegPath = detectFfmpeg();

if (!ensureYtDlp()) {
  console.error(`❌ ${ytDlpBinary} no encontrado en: ${__dirname}`);
  console.error('Descarga yt-dlp desde: https://github.com/yt-dlp/yt-dlp/releases');
  if (isWindows) {
    console.error('  -> Descarga yt-dlp.exe y colócalo en la carpeta del proyecto');
  } else {
    console.error('  -> Descarga yt-dlp, hazlo ejecutable (chmod +x yt-dlp) y colócalo en la carpeta del proyecto');
  }
  process.exit(1);
}

console.log(`✅ yt-dlp encontrado: ${ytDlpPath}`);
if (fs.existsSync(COOKIES_FILE)) {
  console.log(`🍪 Archivo de cookies encontrado: ${COOKIES_FILE}`);
} else {
  console.log('ℹ️  Sin cookies configuradas — si YouTube bloquea las descargas, configura cookies (ver README)');
}

const server = app.listen(PORT, () => {
  console.log(`\n🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`🎵 YouTube to MP3 Converter listo\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ El puerto ${PORT} ya está en uso.`);
    console.error('Opciones para solucionarlo:');
    console.error(`  1. Cierra la otra instancia del servidor que está usando el puerto ${PORT}`);
    if (isWindows) {
      console.error(`  2. Busca el proceso: netstat -ano | findstr :${PORT}`);
      console.error('     Y termínalo con: taskkill /PID <numero> /F');
    } else {
      console.error(`  2. Busca el proceso: lsof -i :${PORT}`);
      console.error('     Y termínalo con: kill <PID>');
    }
    console.error(`  3. Usa otro puerto: ${isWindows ? '$env:PORT=3001; npm start' : 'PORT=3001 npm start'}\n`);
  } else {
    console.error('❌ Error al iniciar el servidor:', err.message);
  }
  process.exit(1);
});
