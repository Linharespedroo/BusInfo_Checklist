// ==================== db.js - VERSÃO SUPER SIMPLES ====================
// Esta versão NÃO USA Dexie para cache, apenas localStorage

console.log("📦 Inicializando sistema de dados...");

// Banco de dados simples com localStorage para cache
const db = {
  // Cache usando localStorage (mais simples, sem erros)
  cache: {
    async set(chave, valor) {
      try {
        const item = {
          valor: valor,
          timestamp: Date.now(),
        };
        localStorage.setItem(`cache_${chave}`, JSON.stringify(item));
        console.log(`💾 Cache set: ${chave}`);
        return true;
      } catch (error) {
        console.error("Erro no cache set:", error);
        return false;
      }
    },

    async get(chave) {
      try {
        const item = localStorage.getItem(`cache_${chave}`);
        if (item) {
          const parsed = JSON.parse(item);
          console.log(`📦 Cache hit: ${chave}`);
          return parsed.valor;
        }
        console.log(`🕳️ Cache miss: ${chave}`);
        return null;
      } catch (error) {
        console.error("Erro no cache get:", error);
        return null;
      }
    },
  },

  // Checklists (usando localStorage por enquanto)
  checklists: {
    async salvar(dados) {
      const id = Date.now();
      const checklist = {
        id,
        ...dados,
        timestamp: id,
        sincronizado: 0,
      };

      const checklists = JSON.parse(localStorage.getItem("checklists") || "[]");
      checklists.push(checklist);
      localStorage.setItem("checklists", JSON.stringify(checklists));

      console.log(`✅ Checklist salvo: ${id}`);
      return id;
    },

    async pendentes() {
      const checklists = JSON.parse(localStorage.getItem("checklists") || "[]");
      return checklists.filter((c) => c.sincronizado === 0);
    },

    async get(id) {
      const checklists = JSON.parse(localStorage.getItem("checklists") || "[]");
      return checklists.find((c) => c.id === id);
    },

    async marcarSincronizado(id) {
      const checklists = JSON.parse(localStorage.getItem("checklists") || "[]");
      const index = checklists.findIndex((c) => c.id === id);
      if (index !== -1) {
        checklists[index].sincronizado = 1;
        localStorage.setItem("checklists", JSON.stringify(checklists));
        return true;
      }
      return false;
    },
  },

  // Fotos (simplificado - só metadados, blob no sessionStorage)
  fotos: {
    async salvar(checklistId, tipo, posicao, blob) {
      const id = Date.now();
      const foto = {
        id,
        checklistId,
        tipo,
        posicao,
        timestamp: id,
      };

      // Salvar blob separadamente
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        sessionStorage.setItem(`foto_${id}`, reader.result);
      };

      const fotos = JSON.parse(localStorage.getItem("fotos") || "[]");
      fotos.push(foto);
      localStorage.setItem("fotos", JSON.stringify(fotos));

      return id;
    },

    async buscarPorChecklist(checklistId) {
      const fotos = JSON.parse(localStorage.getItem("fotos") || "[]");
      return fotos.filter((f) => f.checklistId === checklistId);
    },
  },

  // Irregularidades
  irregulares: {
    async salvar(checklistId, posicao, descricao) {
      const id = Date.now();
      const irregular = {
        id,
        checklistId,
        posicao,
        descricao,
        timestamp: id,
      };

      const irregulares = JSON.parse(
        localStorage.getItem("irregulares") || "[]",
      );
      irregulares.push(irregular);
      localStorage.setItem("irregulares", JSON.stringify(irregulares));

      return id;
    },

    async buscarPorChecklist(checklistId) {
      const irregulares = JSON.parse(
        localStorage.getItem("irregulares") || "[]",
      );
      return irregulares.filter((i) => i.checklistId === checklistId);
    },
  },
};

// Tornar db global
window.db = db;

console.log("✅ Sistema de dados inicializado com localStorage!");
console.log("💡 Dica: Os dados persistem mesmo após recarregar a página");
