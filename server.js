const express = require('express');
const cors = require('cors');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Paths — use the native binary for the current operating system
const isWindows = process.platform === 'win32';
const ytDlpBinary = isWindows ? 'yt-dlp.exe' : 'yt-dlp';
const localYtDlpPath = path.join(__dirname, ytDlpBinary);
let ytDlpPath = localYtDlpPath;
let ffmpegPath = '';

function resolveYtDlp() {
  if (fs.existsSync(localYtDlpPath)) {
    if (!isWindows) {
      try {
        fs.accessSync(localYtDlpPath, fs.constants.X_OK);
      } catch (_) {
        console.warn(`⚠️ ${localYtDlpPath} existe pero no es ejecutable`);
      }
    } else {
      return localYtDlpPath;
    }
    if (isWindows) return localYtDlpPath;
  }

  try {
    require('child_process').execFileSync(isWindows ? 'where' : 'which', [ytDlpBinary], {
      stdio: 'ignore',
      timeout: 3000,
    });
    return ytDlpBinary;
  } catch (_) {
    return null;
  }
}

const DOWNLOAD_PRESETS = {
  mp3: {
    kind: 'audio',
    extension: 'mp3',
    format: null,
    message: 'Convirtiendo a MP3 320kbps...',
  },
  'video-best': {
    kind: 'video',
    extension: 'mp4',
    format: 'bestvideo+bestaudio/best',
    message: 'Procesando vídeo en la máxima calidad disponible...',
  },
  'video-2160': {
    kind: 'video',
    extension: 'mp4',
    format: 'bestvideo[height<=2160]+bestaudio/best[height<=2160]',
    message: 'Procesando vídeo hasta 4K...',
  },
  'video-1440': {
    kind: 'video',
    extension: 'mp4',
    format: 'bestvideo[height<=1440]+bestaudio/best[height<=1440]',
    message: 'Procesando vídeo hasta 1440p...',
  },
  'video-1080': {
    kind: 'video',
    extension: 'mp4',
    format: 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
    message: 'Procesando vídeo hasta 1080p...',
  },
  'video-720': {
    kind: 'video',
    extension: 'mp4',
    format: 'bestvideo[height<=720]+bestaudio/best[height<=720]',
    message: 'Procesando vídeo hasta 720p...',
  },
};

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
      const proc = spawn(ytDlpPath, [
        '--dump-json',
        '--no-playlist',
        '--no-warnings',
        url,
      ], { windowsHide: true });

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
  const preset = DOWNLOAD_PRESETS[req.query.preset || 'mp3'];
  if (!preset) return res.status(400).json({ error: 'Opción de descarga no válida' });

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

  sendEvent({ status: 'starting', message: 'Iniciando...', progress: 2, kind: preset.kind });

  try {
    const args = [url, '--output', outputTemplate, '--no-playlist', '--newline', '--progress'];

    if (preset.kind === 'audio') {
      args.push('--extract-audio', '--audio-format', 'mp3', '--audio-quality', '0');
    } else {
      args.push('--format', preset.format, '--merge-output-format', 'mp4');
    }

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
        sendEvent({ status: 'converting', progress: 90, message: preset.message });
      }
    });

    sendEvent({ status: 'converting', progress: 95, message: 'Finalizando archivo...' });

    const files = fs.readdirSync(tmpDir)
      .filter(file => file.startsWith(`${fileId}.`))
      .map(file => path.join(tmpDir, file));
    const finalFile = files.find(file => fs.statSync(file).isFile());

    if (!finalFile || !fs.existsSync(finalFile)) {
      sendEvent({ status: 'error', message: `No se generó el archivo ${preset.kind === 'audio' ? 'MP3' : 'de vídeo'}. Verifica que ffmpeg esté instalado.` });
      return res.end();
    }

    // Move to public/downloads
    const publicTmpDir = path.join(__dirname, 'public', 'downloads');
    if (!fs.existsSync(publicTmpDir)) fs.mkdirSync(publicTmpDir, { recursive: true });
    const extension = path.extname(finalFile).toLowerCase().replace('.', '') || preset.extension;
    const publicFile = path.join(publicTmpDir, `${fileId}.${extension}`);
    fs.renameSync(finalFile, publicFile);

    sendEvent({ status: 'done', progress: 100, message: '¡Listo!', downloadId: fileId, extension, kind: preset.kind });
    console.log(`✅ Descarga completada: ${fileId}.${extension}`);

  } catch (err) {
    console.error('Error en /api/progress:', err.message);
    sendEvent({ status: 'error', message: 'Error: ' + err.message });
  }

  res.end();
});

// Serve the generated file for download
app.get('/downloads/:id', (req, res) => {
  const { id } = req.params;
  // Sanitize id
  if (!/^[a-f0-9\-]+$/i.test(id)) return res.status(400).json({ error: 'ID inválido' });

  const downloadsDir = path.join(__dirname, 'public', 'downloads');
  const fileName = fs.readdirSync(downloadsDir).find(file => file.startsWith(`${id}.`));
  if (!fileName) return res.status(404).json({ error: 'Archivo no encontrado o ya fue descargado' });
  const filePath = path.join(downloadsDir, fileName);

  const stat = fs.statSync(filePath);
  const extension = path.extname(fileName).toLowerCase();
  const isAudio = extension === '.mp3';
  const contentTypes = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mkv': 'video/x-matroska',
  };
  const title = req.query.title || `${id}${extension}`;

  res.setHeader('Content-Type', isAudio ? 'audio/mpeg' : (contentTypes[extension] || 'application/octet-stream'));
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
    ytDlp: Boolean(ytDlpPath),
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
ytDlpPath = resolveYtDlp();

if (!ytDlpPath) {
  console.error(`❌ ${ytDlpBinary} no encontrado localmente ni en el PATH`);
  console.error('Descarga yt-dlp desde: https://github.com/yt-dlp/yt-dlp/releases');
  if (isWindows) {
    console.error('  -> Descarga yt-dlp.exe y colócalo en la carpeta del proyecto');
  } else {
    console.error('  -> Instálalo con tu gestor de paquetes o coloca yt-dlp en la carpeta del proyecto y ejecuta: chmod +x yt-dlp');
  }
  process.exit(1);
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
