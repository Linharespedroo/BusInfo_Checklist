class CameraService {
    constructor() {
        this.stream = null;
        this.video = null;
        this.canvas = null;
    }

    // Iniciar câmera
    async iniciar(videoElement) {
        try {
            this.video = videoElement;
            this.canvas = document.getElementById('canvasFoto');
            
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment', // Câmera traseira
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            });
            
            this.video.srcObject = this.stream;
            await this.video.play();
            
            return true;
        } catch (error) {
            console.error('Erro ao acessar câmera:', error);
            return false;
        }
    }

    // Capturar e comprimir foto
    async capturar() {
        if (!this.video || !this.canvas) return null;

        const context = this.canvas.getContext('2d');
        
        // Redimensionar se necessário
        let width = this.video.videoWidth;
        let height = this.video.videoHeight;
        
        if (width > CONFIG.MAX_LARGURA_FOTO) {
            height = Math.round(height * CONFIG.MAX_LARGURA_FOTO / width);
            width = CONFIG.MAX_LARGURA_FOTO;
        }
        
        this.canvas.width = width;
        this.canvas.height = height;
        
        context.drawImage(this.video, 0, 0, width, height);
        
        // Converter para blob com compressão
        return new Promise((resolve) => {
            this.canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/jpeg', CONFIG.QUALIDADE_IMAGEM);
        });
    }

    // Parar câmera
    parar() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
    }

    // Converter Blob para Base64 (para preview)
    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }
}

const cameraService = new CameraService();