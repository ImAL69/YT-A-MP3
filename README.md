# 🎵 YT MP3 — Convertidor de YouTube a MP3

Convierte videos de YouTube a MP3 en máxima calidad (320kbps). Aplicación web local con interfaz moderna.

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![License](https://img.shields.io/badge/License-MIT-blue)

## ✨ Características

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
git clone https://github.com/TU-USUARIO/yt-mp3-converter.git
cd yt-mp3-converter
```

### 2. Instala las dependencias

```bash
npm install
```

### 3. Descarga yt-dlp

Descarga el binario de yt-dlp desde [las releases oficiales](https://github.com/yt-dlp/yt-dlp/releases) y colócalo en la carpeta raíz del proyecto:

- **Windows**: descarga `yt-dlp.exe`
- **macOS/Linux**: descarga `yt-dlp` y hazlo ejecutable:
  ```bash
  chmod +x yt-dlp
  ```

### 4. Inicia la aplicación

```bash
npm start
```

### 5. Abre tu navegador

Ve a [http://localhost:3000](http://localhost:3000) y empieza a convertir videos.

## 🎯 Uso

1. Pega la URL de un video de YouTube
2. Haz clic en **Buscar Video** para ver la información
3. Haz clic en **Convertir a MP3** para iniciar la conversión
4. Descarga el archivo MP3 cuando esté listo

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
| `yt-dlp no encontrado` | Descarga yt-dlp y colócalo en la carpeta del proyecto |
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
├── yt-dlp.exe         # Binario de yt-dlp (no incluido, descargar)
└── README.md
```

## 📄 Licencia

MIT — Uso personal y educativo.

## ⚠️ Aviso legal

Esta herramienta es solo para uso personal. Asegúrate de respetar los derechos de autor y los términos de servicio de YouTube al descargar contenido.
