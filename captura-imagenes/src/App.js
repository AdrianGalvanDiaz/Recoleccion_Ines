import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import './App.css';

// Obtenemos acceso al IPC de Electron
const { ipcRenderer } = window.require('electron');

function App() {
  // Estados para la cámara
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [isCameraEnabled, setIsCameraEnabled] = useState(false);
  const [imgSrc, setImgSrc] = useState(null);
  const [resolution, setResolution] = useState({ width: 0, height: 0 });
  const [resolutionStatus, setResolutionStatus] = useState('checking');
  const [saveStatus, setSaveStatus] = useState({ message: '', type: '' });
  const [captureCount, setCaptureCount] = useState(0);
  
  // Lista de resoluciones en orden descendente (de mejor a peor)
  const [availableResolutions] = useState([
    { width: 1920, height: 1080, label: "Full HD (1920x1080)" },
    { width: 1280, height: 720, label: "HD (1280x720)" },
    { width: 640, height: 480, label: "VGA (640x480)" }
  ]);
  
  // Iniciar con la resolución Full HD por defecto
  const [selectedResolution, setSelectedResolution] = useState({ width: 1920, height: 1080, label: "Full HD (1920x1080)" });
  
  const webcamRef = useRef(null);
  
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

  // Nueva función para intentar diferentes resoluciones
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

  // Función para capturar imagen con Canvas a resolución completa
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
  
    // Convertir a base64
    const imageSrc = canvas.toDataURL('image/jpeg', 0.95); // Alta calidad
    
    return imageSrc;
  };

  // Capturar imagen y guardarla
  const capture = useCallback(() => {
    try {
      const imageSrc = captureWithCanvas();
      setImgSrc(imageSrc);
      
      // Enviar la imagen a través de IPC para guardarla
      ipcRenderer.send('save-photo', imageSrc);
      
      // Actualizar el estado para mostrar que se está guardando
      setSaveStatus({ message: 'Guardando imagen...', type: 'loading' });
    } catch (error) {
      console.error('Error al capturar la imagen:', error);
      setSaveStatus({ message: `Error: ${error.message}`, type: 'error' });
    }
  }, [webcamRef]);
  
  // Función para renderizar la información de resolución
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

  // Escuchar la respuesta del proceso de guardado
  useEffect(() => {
    ipcRenderer.on('photo-saved', (event, result) => {
      if (result.success) {
        setSaveStatus({ 
          message: `Imagen ${result.fileName} guardada correctamente`, 
          type: 'success'
        });
        setCaptureCount(prev => prev + 1);
      } else {
        setSaveStatus({ 
          message: `Error al guardar la imagen: ${result.error}`, 
          type: 'error'
        });
      }
    });

    return () => {
      ipcRenderer.removeAllListeners('photo-saved');
    };
  }, []);

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

  return (
    <div className="App">
      <h1>Captura de Fotos para Dataset</h1>
      
      {/* Botón para listar dispositivos */}
      {!isCameraEnabled && (
        <div className="devices-container">
          <button onClick={loadDevices} className="btn">
            Iniciar Nueva Captura
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

          {/* Mostrar estado de guardado */}
          {saveStatus.message && (
            <div className={`save-status ${saveStatus.type}`}>
              <p>{saveStatus.message}</p>
            </div>
          )}

          {/* Contador de capturas */}
          {captureCount > 0 && (
            <div className="capture-count">
              <p>Imágenes capturadas: {captureCount}</p>
            </div>
          )}

          {/* Controles principales */}
          <div className="camera-controls">
            <button 
              onClick={capture} 
              className="btn"
              disabled={saveStatus.type === 'loading'}
            >
              {saveStatus.type === 'loading' ? 'Guardando...' : 'Capturar Foto'}
            </button>
            <button 
              onClick={() => setIsCameraEnabled(false)} 
              className="btn btn-secondary"
              disabled={saveStatus.type === 'loading'}
            >
              Cambiar cámara
            </button>
          </div>
        </div>
      )}

      {/* Vista previa de la última imagen capturada */}
      {imgSrc && (
        <div className="preview-container">
          <h2>Última captura</h2>
          <div className="image-preview">
            <img src={imgSrc} alt="Última captura" />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;