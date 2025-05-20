// ===== public/electron.js =====
// Este archivo configura Electron para poder guardar archivos localmente

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = require('electron-is-dev');
const os = require('os');

// Configurar ruta de guardado específica
let savePath = 'C:\\Users\\Adrian\\Desktop\\reyi\\inesdataset_final\\data';

function createWindow() {
  // Crear ventana de la aplicación
  const mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, '../src/preload.js')
    }
  });

  // Cargar la app de React
  mainWindow.loadURL(
    isDev
      ? 'http://localhost:3000'
      : `file://${path.join(__dirname, '../build/index.html')}`
  );

  // Abrir DevTools en desarrollo
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

// Crear la carpeta de guardado si no existe
function ensureSaveDirectory() {
  if (!fs.existsSync(savePath)) {
    fs.mkdirSync(savePath, { recursive: true });
  }
}

// Iniciar la aplicación
app.whenReady().then(() => {
  createWindow();
  ensureSaveDirectory();
});

// Manejar cierre de la aplicación
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Manejar la selección de ruta de guardado
ipcMain.handle('set-save-path', async (event, newPath) => {
  if (newPath && fs.existsSync(newPath)) {
    savePath = newPath;
    ensureSaveDirectory();
    return { success: true, path: savePath };
  }
  return { success: false, error: 'La ruta no existe' };
});

// Obtener la ruta de guardado actual
ipcMain.handle('get-save-path', async (event) => {
  return savePath;
});

// Guardar la imagen en la ruta configurada
ipcMain.handle('save-image', async (event, imageData) => {
  try {
    ensureSaveDirectory();
    
    // Obtener el siguiente número de archivo
    const files = fs.readdirSync(savePath).filter(file => 
      file.match(/^\d{3}\.jpg$/)
    );
    
    // Encontrar el número más alto
    let maxNumber = 0;
    files.forEach(file => {
      const fileNumber = parseInt(file.substring(0, 3));
      if (fileNumber > maxNumber) {
        maxNumber = fileNumber;
      }
    });
    
    // Crear el siguiente número
    const nextNumber = maxNumber + 1;
    const fileName = `${nextNumber.toString().padStart(3, '0')}.jpg`;
    
    // Guardar la imagen
    const base64Data = imageData.replace(/^data:image\/jpeg;base64,/, '');
    const filePath = path.join(savePath, fileName);
    
    fs.writeFileSync(filePath, base64Data, 'base64');
    
    return {
      success: true,
      fileName,
      fullPath: filePath,
      nextIndex: nextNumber
    };
  } catch (error) {
    console.error('Error al guardar:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Listar imágenes guardadas y obtener el siguiente número a usar
ipcMain.handle('get-next-image-number', async () => {
  try {
    ensureSaveDirectory();
    
    const files = fs.readdirSync(savePath)
      .filter(file => file.match(/^\d{3}\.jpg$/));
      
    // Encontrar el número más alto
    let maxNumber = 0;
    files.forEach(file => {
      const fileNumber = parseInt(file.substring(0, 3));
      if (fileNumber > maxNumber) {
        maxNumber = fileNumber;
      }
    });
    
    // El siguiente número será el más alto + 1
    return {
      success: true,
      nextNumber: maxNumber + 1,
      count: files.length
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      nextNumber: 1,
      count: 0
    };
  }
});
