// Inicializar banco de dados
const db = new Dexie('ChecklistDB');

db.version(1).stores({
    // Checklists pendentes/sincronizados
    checklists: '++id, timestamp, placa, cpfMotorista, sincronizado',
    
    // Fotos dos documentos e inspeção
    fotos: '++id, checklistId, tipo, posicao, blob, timestamp',
    
    // Irregularidades encontradas
    irregulares: '++id, checklistId, posicao, descricao',
    
    // Cache dos JSONs do Drive
    cache: 'chave, valor, timestamp'
});

// Criar índices
db.version(2).stores({
    checklists: '++id, timestamp, placa, cpfMotorista, sincronizado, [placa+timestamp]',
    fotos: '++id, checklistId, tipo, posicao',
    irregulares: '++id, checklistId, posicao',
    cache: 'chave, timestamp'
});

// Métodos auxiliares
db.checklists = {
    // Salvar novo checklist
    async salvar(dados) {
        const id = await db.checklists.add({
            ...dados,
            timestamp: Date.now(),
            sincronizado: 0 // 0 = pendente, 1 = sincronizado
        });
        return id;
    },
    
    // Listar checklists pendentes
    async pendentes() {
        return await db.checklists
            .where('sincronizado')
            .equals(0)
            .reverse()
            .toArray();
    },
    
    // Buscar por placa
    async buscarPorPlaca(placa) {
        return await db.checklists
            .where('placa')
            .equals(placa)
            .reverse()
            .toArray();
    },
    
    // Marcar como sincronizado
    async marcarSincronizado(id) {
        return await db.checklists.update(id, { sincronizado: 1 });
    }
};

// Métodos para fotos
db.fotos = {
    async salvar(checklistId, tipo, posicao, blob) {
        return await db.fotos.add({
            checklistId,
            tipo, // 'cnh', 'crlv', 'inspecao'
            posicao, // 'frente', 'direita', etc
            blob,
            timestamp: Date.now()
        });
    },
    
    async buscarPorChecklist(checklistId) {
        return await db.fotos
            .where('checklistId')
            .equals(checklistId)
            .toArray();
    }
};

// Métodos para cache dos JSONs
db.cache = {
    async set(chave, valor) {
        await db.cache.put({
            chave,
            valor,
            timestamp: Date.now()
        });
    },
    
    async get(chave) {
        const item = await db.cache
            .where('chave')
            .equals(chave)
            .first();
        return item?.valor;
    },
    
    async limparVelho(maxAge = 24 * 60 * 60 * 1000) { // 24h
        const limite = Date.now() - maxAge;
        await db.cache
            .where('timestamp')
            .below(limite)
            .delete();
    }
};