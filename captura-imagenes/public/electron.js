// ===== public/electron.js =====
// Este archivo configura Electron para poder guardar archivos localmente

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = require('electron-is-dev');
const url = require('url');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 680,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    }
  });

  const startUrl = isDev
    ? 'http://localhost:3000'
    : url.format({
        pathname: path.join(__dirname, '../build/index.html'),
        protocol: 'file:',
        slashes: true,
      });

  mainWindow.loadURL(startUrl);

  // Abre DevTools si está en desarrollo
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => (mainWindow = null));
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Función para obtener archivos en la carpeta por su extensión
function getNextSequentialNumber(folder, extension = '.jpg') {
  try {
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
      return 1;
    }

    const files = fs.readdirSync(folder)
      .filter(file => file.endsWith(extension))
      .filter(file => /^\d+\.jpg$/.test(file))
      .map(file => parseInt(file.split('.')[0], 10))
      .filter(num => !isNaN(num));

    if (files.length === 0) {
      return 1;
    }

    return Math.max(...files) + 1;
  } catch (error) {
    console.error('Error al obtener el siguiente número de archivo:', error);
    return 1;
  }
}

// Manejar el evento para guardar imagen
ipcMain.on('save-photo', (event, imageData) => {
  try {
    const folder = 'C:\\Users\\Adrian\\Desktop\\reyi\\inesdataset_final\\data';
    
    // Asegurarse de que la carpeta existe
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }

    // Obtener el siguiente número secuencial
    const nextNumber = getNextSequentialNumber(folder);
    
    // Formatear el número con ceros a la izquierda
    const formattedNumber = String(nextNumber).padStart(3, '0');
    const fileName = `${formattedNumber}.jpg`;
    const filePath = path.join(folder, fileName);

    // Convertir la imagen base64 a un buffer
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Guardar el archivo
    fs.writeFileSync(filePath, buffer);

    event.reply('photo-saved', { success: true, fileName });
  } catch (error) {
    console.error('Error al guardar la foto:', error);
    event.reply('photo-saved', { success: false, error: error.message });
  }
});