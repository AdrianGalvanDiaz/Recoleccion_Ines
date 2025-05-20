// ===== src/App.js =====
// Componente principal de la aplicación React

import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import './App.css';

function App() {
  // Estado para la cámara
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [imgSrc, setImgSrc] = useState(null);
  const [resolution, setResolution] = useState({ width: 0, height: 0 });
  const [resolutionStatus, setResolutionStatus] = useState('checking');
  
  // Lista de resoluciones
  const [availableResolutions] = useState([
    { width: 1920, height: 1080, label: "Full HD (1920x1080)" },
    { width: 1280, height: 720, label: "HD (1280x720)" },
    { width: 640, height: 480, label: "VGA (640x480)" }
  ]);
  
  // Iniciar con la resolución Full HD por defecto
  const [selectedResolution, setSelectedResolution] = useState(
    { width: 1920, height: 1080, label: "Full HD (1920x1080)" }
  );
  
  // Referencia al componente webcam
  const webcamRef = useRef(null);
  
  // Estado para el guardado de imágenes
  const [savePath, setSavePath] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [totalImages, setTotalImages] = useState(0);
  
  // Función para obtener los dispositivos disponibles
  const handleDevices = useCallback(
    mediaDevices => {
      // Filtrar solo videoinputs (webcams)
      const videoDevices = mediaDevices.filter(({ kind }) => kind === "videoinput");
      setDevices(videoDevices);
    },
    [setDevices]
  );

  // Cargar la lista de dispositivos
  const loadDevices = () => {
    navigator.mediaDevices.enumerateDevices().then(handleDevices);
  };

  // Intentar diferentes resoluciones
  const tryNextResolution = useCallback(async (currentResolutionIndex = 0) => {
    if (currentResolutionIndex >= availableResolutions.length) {
      console.error('No se pudo establecer ninguna resolución');
      return;
    }

    const targetResolution = availableResolutions[currentResolutionIndex];
    
    try {
      // Intentar obtener el stream con la resolución específica
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: selectedDeviceId,
          width: { ideal: targetResolution.width },
          height: { ideal: targetResolution.height }
        }
      });
      
      // Si llegamos aquí, el stream se obtuvo exitosamente
      setSelectedResolution(targetResolution);
      
      // Verificar si es la resolución óptima (1920x1080)
      if (targetResolution.width === 1920 && targetResolution.height === 1080) {
        setResolutionStatus('good');
      } else {
        setResolutionStatus('suboptimal');
      }
      
      // Detener el stream de prueba (react-webcam manejará el stream real)
      stream.getTracks().forEach(track => track.stop());
      
    } catch (error) {
      console.log(`No se pudo establecer ${targetResolution.label}, intentando siguiente...`);
      // Intentar con la siguiente resolución
      tryNextResolution(currentResolutionIndex + 1);
    }
  }, [selectedDeviceId, availableResolutions]);

  // Seleccionar un dispositivo y habilitar la cámara
  const enableCamera = (deviceId) => {
    setSelectedDeviceId(deviceId);
    setIsCameraEnabled(true);
    setResolutionStatus('checking');
    
    // Iniciar el proceso de búsqueda de resolución óptima
    setTimeout(() => {
      tryNextResolution(0);
    }, 100);
  };

  // Capturar imagen con Canvas a resolución completa
  const captureWithCanvas = () => {
    const video = webcamRef.current.video;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
  
    // Usar la resolución nativa del video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    console.log(`Capturando imagen: ${canvas.width}x${canvas.height}`);
  
    // Dibujar el frame actual del video en el canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
  
    // Convertir a base64 como JPEG para menor tamaño
    const imageSrc = canvas.toDataURL('image/jpeg', 0.9);
    
    return imageSrc;
  };

  // Efecto para cargar la ruta de guardado al inicio
  useEffect(() => {
    const loadSavePath = async () => {
      if (window.electronAPI) {
        try {
          const path = await window.electronAPI.getSavePath();
          setSavePath(path);
          
          // Cargar conteo de imágenes
          const imageList = await window.electronAPI.listImages();
          if (imageList.success) {
            setTotalImages(imageList.count);
          }
        } catch (error) {
          console.error('Error al cargar la ruta:', error);
        }
      } else {
        console.warn('No se detectó Electron, la app funcionará en modo navegador sin guardado local');
      }
    };
    
    loadSavePath();
  }, []);
  
  // Renderizar la información de resolución
  const renderResolutionInfo = () => {
    if (resolution.width > 0) {
      return (
        <div className="resolution-info">
          {resolution.width} x {resolution.height}
          
          {resolutionStatus === 'good' && (
            <div className="resolution-check">
              <span className="check-icon">✓</span> ¡Todo bien!
            </div>
          )}
          
          {resolutionStatus === 'suboptimal' && (
            <div className="resolution-warning">
              ⚠️ Resolución no óptima
            </div>
          )}
        </div>
      );
    }
    
    return null;
  };

  // Actualizar efecto para detectar cuando la resolución real esté disponible
  useEffect(() => {
    if (isCameraEnabled && webcamRef.current && webcamRef.current.video) {
      const checkVideoReady = setInterval(() => {
        const video = webcamRef.current.video;
        if (video.readyState === 4) {
          const actualWidth = video.videoWidth;
          const actualHeight = video.videoHeight;
          
          setResolution({
            width: actualWidth,
            height: actualHeight
          });
          
          // Verificar si la resolución real coincide con la esperada
          if (actualWidth === 1920 && actualHeight === 1080) {
            setResolutionStatus('good');
          } else {
            setResolutionStatus('suboptimal');
          }
          
          clearInterval(checkVideoReady);
        }
      }, 100);

      return () => clearInterval(checkVideoReady);
    }
  }, [isCameraEnabled, webcamRef]);

  // Función para capturar y guardar la imagen
  const captureAndSave = async () => {
    try {
      // Capturar la imagen
      const imageSrc = captureWithCanvas();
      setImgSrc(imageSrc);
      
      // Activar estado de guardado
      setSaving(true);
      setErrorMessage(null);
      
      if (window.electronAPI) {
        // Guardar la imagen usando Electron
        const result = await window.electronAPI.saveImage(imageSrc);
        
        if (result.success) {
          setLastSaved({
            fileName: result.fileName,
            path: result.fullPath,
            index: result.nextIndex
          });
          setTotalImages(prev => prev + 1);
        } else {
          setErrorMessage(`Error al guardar: ${result.error}`);
        }
      } else {
        // Modo web (sin guardado local)
        // Simular guardado con descarga
        const link = document.createElement('a');
        const nextIndex = totalImages + 1;
        const fileName = `${nextIndex.toString().padStart(3, '0')}.jpg`;
        
        link.href = imageSrc;
        link.download = fileName;
        link.click();
        
        setLastSaved({
          fileName: fileName,
          path: 'Descargada en su navegador',
          index: nextIndex
        });
        setTotalImages(prev => prev + 1);
      }
      
      // Desactivar estado de guardado
      setSaving(false);
    } catch (error) {
      console.error('Error al capturar/guardar:', error);
      setErrorMessage(`Error: ${error.message}`);
      setSaving(false);
    }
  };

  return (
    <div className="App">
      <div className="capture-page">
        <h1>Captura de Imágenes</h1>
        
        {/* Contador de imágenes */}
        <div className="image-counter">
          Total de imágenes capturadas: <strong>{totalImages}</strong>
        </div>
        
        {/* Muestra la ruta de guardado */}
        {savePath && (
          <div className="save-path-info">
            Guardando en: <strong>{savePath}</strong>
          </div>
        )}
        
        {/* Botón para listar dispositivos */}
        {!isCameraEnabled && (
          <div className="devices-container">
            <button onClick={loadDevices} className="btn">
              Iniciar captura
            </button>
            
            <div className="device-list">
              {devices.map((device, key) => (
                <div key={key} className="device-item">
                  <span>{device.label || `Dispositivo ${key + 1}`}</span>
                  <button onClick={() => enableCamera(device.deviceId)} className="btn">
                    Seleccionar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cámara */}
        {isCameraEnabled && (
          <div className="camera-container">
            <div className="webcam-wrapper">
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{
                  deviceId: selectedDeviceId,
                  width: { ideal: selectedResolution.width },
                  height: { ideal: selectedResolution.height }
                }}
                className="webcam"
              />
              
              {/* Mostrar la información de resolución actualizada */}
              {renderResolutionInfo()}
            </div>

            {/* Información de guardado */}
            {saving && (
              <div className="saving-indicator">
                <p>Guardando imagen...</p>
              </div>
            )}

            {lastSaved && (
              <div className="saved-info">
                <p>Última imagen guardada: <strong>{lastSaved.fileName}</strong></p>
                <p>Ruta: {lastSaved.path}</p>
              </div>
            )}

            {errorMessage && (
              <div className="error-message">
                <p>{errorMessage}</p>
              </div>
            )}

            {/* Controles principales */}
            <div className="camera-controls">
              <button 
                onClick={captureAndSave} 
                className="btn"
                disabled={saving}
              >
                {saving ? 'Guardando...' : 'Capturar y Guardar'}
              </button>
              <button 
                onClick={() => setIsCameraEnabled(false)} 
                className="btn"
                disabled={saving}
              >
                Cambiar cámara
              </button>
            </div>
          </div>
        )}
        
        {/* Vista previa de la imagen */}
        {imgSrc && (
          <div className="preview-container">
            <h2>Última captura</h2>
            <img src={imgSrc} alt="Captura" className="preview-image" />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;