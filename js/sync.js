class SyncService {
    constructor() {
        this.isSyncing = false;
    }

    // Registrar sync periódico
    registrarBackgroundSync() {
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
            navigator.serviceWorker.ready.then(reg => {
                // Registrar sync para quando voltar online
                reg.sync.register('sync-checklists').catch(() => {
                    // Fallback: sincronização manual quando online
                    window.addEventListener('online', () => this.sincronizar());
                });
            });
        }
    }

    // Sincronizar checklists pendentes
    async sincronizar() {
        if (this.isSyncing) return;
        
        try {
            this.isSyncing = true;
            this.atualizarStatus('Sincronizando...');
            
            const pendentes = await db.checklists.pendentes();
            
            for (const checklist of pendentes) {
                await this.enviarChecklist(checklist);
                await db.checklists.marcarSincronizado(checklist.id);
            }
            
            this.atualizarStatus('Sincronizado com sucesso!', 'success');
            
        } catch (error) {
            console.error('Erro na sincronização:', error);
            this.atualizarStatus('Falha na sincronização', 'error');
        } finally {
            this.isSyncing = false;
        }
    }

    // Enviar checklist completo para R2
    async enviarChecklist(checklist) {
        // Buscar fotos associadas
        const fotos = await db.fotos.buscarPorChecklist(checklist.id);
        const irregulares = await db.irregulares
            .where('checklistId')
            .equals(checklist.id)
            .toArray();

        // Preparar FormData
        const formData = new FormData();
        formData.append('checklist', JSON.stringify({
            id: checklist.id,
            timestamp: checklist.timestamp,
            placa: checklist.placa,
            cpfMotorista: checklist.cpfMotorista,
            bandeira: checklist.bandeira,
            irregulares: irregulares
        }));

        // Adicionar fotos
        fotos.forEach((foto, index) => {
            formData.append(`foto_${index}`, foto.blob, 
                `${foto.tipo}_${foto.posicao}_${Date.now()}.jpg`);
        });

        // Enviar para o Worker R2
        const response = await fetch(CONFIG.R2_UPLOAD_URL, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Erro ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    }

    // Atualizar status na UI
    atualizarStatus(mensagem, tipo = 'info') {
        const statusEl = document.getElementById('statusSincronizacao');
        if (statusEl) {
            statusEl.textContent = mensagem;
            statusEl.className = `status-${tipo}`;
        }
    }
}

const syncService = new SyncService();