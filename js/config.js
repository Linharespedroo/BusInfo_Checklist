// Configurações globais
const CONFIG = {
    // URLs dos JSONs no Google Drive (substitua pelos seus links)
    CPFS_URL: 'https://drive.google.com/uc?export=download&id=SEU_ID_AQUI',
    VEICULOS_URL: 'https://drive.google.com/uc?export=download&id=SEU_ID_AQUI',
    IRREGULARIDADES_URL: 'https://drive.google.com/uc?export=download&id=SEU_ID_AQUI',
    
    // Configuração do timer (5 minutos = 300 segundos)
    TIMER_DURACAO: 300,
    
    // Configurações de câmera
    QUALIDADE_IMAGEM: 0.7, // 70% de qualidade
    MAX_LARGURA_FOTO: 1280,
    
    // Configurações R2 (substitua pelo seu Worker)
    R2_UPLOAD_URL: 'https://seu-worker.workers.dev/upload',
    
    // Versão do app
    VERSAO: '1.0.0'
};

// Tornando configurável via localStorage (para testes)
if (localStorage.getItem('CONFIG')) {
    try {
        const userConfig = JSON.parse(localStorage.getItem('CONFIG'));
        Object.assign(CONFIG, userConfig);
    } catch (e) {}
}