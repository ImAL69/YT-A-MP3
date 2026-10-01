# 🎵 YT MP3 — Descargador de YouTube

Descarga vídeos de YouTube en la máxima calidad disponible —incluidos 4K y 60 FPS cuando existen— o extrae el audio en MP3 a 320 kbps. Aplicación web local con interfaz moderna.

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![License](https://img.shields.io/badge/License-MIT-blue)

## ✨ Características

- 📺 Descarga de vídeo en máxima calidad (incluye 4K y 60+ FPS cuando el vídeo lo ofrece)
- 🎚️ Presets de vídeo hasta 4K, 1440p, 1080p y 720p
- 🎧 Conversión a MP3 en calidad 320kbps
- 📺 Vista previa del video antes de convertir
- 📊 Barra de progreso en tiempo real
- 🚀 Rápido y sin límites
- 🔒 100% local — no se envían datos a terceros
- 🖥️ Compatible con Windows, macOS y Linux

## 📋 Requisitos

- [Node.js](https://nodejs.org/) v18 o superior
- [yt-dlp](https://github.com/yt-dlp/yt-dlp/releases) — descarga el binario para tu sistema operativo
- [ffmpeg](https://ffmpeg.org/download.html) — necesario para la conversión de audio (se incluye automáticamente vía `ffmpeg-static`, o puedes instalarlo en tu sistema)

## 🚀 Instalación

### 1. Clona el repositorio

```bash
git clone https://github.com/TU-USUARIO/YT-A-MP3.git
cd YT-A-MP3
```

### 2. Instala las dependencias

```bash
npm install
```

### 3. Instala yt-dlp y ffmpeg

La aplicación detecta automáticamente `yt-dlp` instalado en el `PATH` o un binario colocado en la raíz del proyecto. En Linux puedes instalar ambos con:

```bash
sudo apt update
sudo apt install -y yt-dlp ffmpeg
```

En otras distribuciones, instala los paquetes equivalentes. Como alternativa, descarga el binario oficial:

Descarga el binario de yt-dlp desde [las releases oficiales](https://github.com/yt-dlp/yt-dlp/releases) y colócalo en la carpeta raíz del proyecto:

- **Windows**: descarga `yt-dlp.exe`
- **macOS/Linux**: descarga `yt-dlp` y hazlo ejecutable:
  ```bash
  chmod +x yt-dlp
  ```

`ffmpeg` es necesario para unir las pistas de vídeo y audio de alta calidad. También se usa para convertir a MP3.

### 4. Inicia la aplicación

```bash
npm start
```

### 5. Abre tu navegador

Ve a [http://localhost:3000](http://localhost:3000) y empieza a convertir videos.

## 🎯 Uso

1. Pega la URL de un video de YouTube.
2. Haz clic en **Buscar Video** para ver la información.
3. Elige **MP3** o **Vídeo**. Para vídeo puedes escoger máxima calidad, 4K, 1440p, 1080p o 720p.
4. Haz clic en el botón de conversión y descarga el archivo cuando esté listo.

La calidad final depende de las pistas que YouTube tenga disponibles para ese vídeo. Para combinar vídeo y audio de alta calidad se necesita `ffmpeg`, incluido por `ffmpeg-static` al ejecutar `npm install`.

## ⚙️ Configuración

### Puerto personalizado

Por defecto la app corre en el puerto 3000. Puedes cambiarlo con la variable de entorno `PORT`:

```bash
PORT=8080 npm start
```

En Windows (PowerShell):
```powershell
$env:PORT=8080; npm start
```

## 🐛 Solución de problemas

| Problema | Solución |
|----------|----------|
| `EADDRINUSE: address already in use` | El puerto ya está ocupado. Cierra la otra instancia o usa otro puerto: `$env:PORT=3001; npm start` (PowerShell) o `PORT=3001 npm start` (Linux/Mac) |
| `yt-dlp no encontrado` | Instálalo (`sudo apt install yt-dlp`) o coloca el binario Linux `yt-dlp` en la raíz y ejecuta `chmod +x yt-dlp` |
| `ffmpeg no encontrado` | Se instala automáticamente con `npm install`. Si falla, instala ffmpeg manualmente |
| `Error al obtener info del video` | Verifica que la URL sea válida y que yt-dlp esté actualizado |
| La página no carga | Asegúrate de acceder desde `http://localhost:3000`, no abriendo el HTML directamente |

## 📁 Estructura del proyecto

```
yt-mp3-converter/
├── server.js          # Servidor Express (backend)
├── package.json       # Dependencias y scripts
├── public/
│   ├── index.html     # Página principal
│   ├── style.css      # Estilos
│   └── app.js         # Lógica del frontend
├── yt-dlp[.exe]       # Binario opcional; también se puede usar desde el PATH
└── README.md
```

## 📄 Licencia

MIT — Uso personal y educativo.

## ⚠️ Aviso legal

Esta herramienta es solo para uso personal. Asegúrate de respetar los derechos de autor y los términos de servicio de YouTube al descargar contenido.
