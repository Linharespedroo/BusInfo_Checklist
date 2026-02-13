// Aguardar DOM carregar
document.addEventListener("DOMContentLoaded", async () => {
  console.log("🚀 Iniciando aplicação...");

  // Verificar se db está disponível
  if (typeof db === "undefined") {
    console.error("❌ Banco de dados não inicializado");
    return;
  }

  // Registrar Service Worker
  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      console.log("✅ Service Worker registrado", registration);
    } catch (error) {
      console.warn("⚠️ Service Worker não registrado:", error);
    }
  }

  // Inicializar timer se existir
  if (document.getElementById("timerDisplay")) {
    inicializarTimer();
  }

  // Carregar dados conforme página
  const pagina = window.location.pathname;

  if (pagina.includes("index.html") || pagina === "/") {
    await initLogin();
  } else if (pagina.includes("empresa.html")) {
    await initEmpresa();
  } else if (pagina.includes("documentos.html")) {
    await initDocumentos();
  } else if (pagina.includes("inspecao.html")) {
    await initInspecao();
  } else if (pagina.includes("conclusao.html")) {
    await initConclusao();
  } else if (pagina.includes("historico.html")) {
    await initHistorico();
  }
});

// Timer global
function inicializarTimer() {
  let tempoRestante = sessionStorage.getItem("timerChecklist");
  if (!tempoRestante) {
    tempoRestante = CONFIG?.TIMER_DURACAO || 300;
    sessionStorage.setItem("timerChecklist", tempoRestante);
  } else {
    tempoRestante = parseInt(tempoRestante);
  }

  function atualizarDisplay() {
    const minutos = Math.floor(tempoRestante / 60);
    const segundos = tempoRestante % 60;
    const display = `${minutos}:${segundos.toString().padStart(2, "0")}`;

    const timerEl = document.getElementById("timerDisplay");
    if (timerEl) timerEl.textContent = display;
    sessionStorage.setItem("timerChecklist", tempoRestante);

    if (tempoRestante === 60) {
      const header = document.querySelector(".timer-header");
      if (header) header.classList.add("urgente");
    }
  }

  atualizarDisplay();

  setInterval(() => {
    tempoRestante--;
    if (tempoRestante >= 0) {
      atualizarDisplay();
    }
  }, 1000);
}

// LOGIN CORRIGIDO
async function initLogin() {
  console.log("Inicializando login...");

  const cpfInput = document.getElementById("cpf");
  const btnAcessar = document.getElementById("btnAcessar");
  const cpfFeedback = document.getElementById("cpfFeedback");

  if (!cpfInput || !btnAcessar) {
    console.error("Elementos de login não encontrados");
    return;
  }

  // Carregar motoristas
  let motoristasData = { cpfs: [], motoristas: [] };

  try {
    // Tentar do cache primeiro
    const cached = await db.cache.get("motoristas");
    if (cached) {
      motoristasData = cached;
      console.log(
        "Motoristas carregados do cache:",
        motoristasData.cpfs.length,
      );
    } else {
      console.log("Buscando motoristas da API...");
      const response = await fetch(CONFIG.CPFS_URL);
      const data = await response.json();
      motoristasData = DataParser.parseMotoristas(data);
      await db.cache.set("motoristas", motoristasData);
      console.log("Motoristas salvos no cache:", motoristasData.cpfs.length);
    }

    // Mostrar status offline se não tiver dados
    if (motoristasData.cpfs.length === 0) {
      document.getElementById("offlineStatus").style.display = "block";
    }
  } catch (error) {
    console.error("Erro ao carregar motoristas:", error);
    document.getElementById("offlineStatus").style.display = "block";
  }

  // Evento de input do CPF
  cpfInput.addEventListener("input", (e) => {
    let value = e.target.value.replace(/\D/g, "");

    // Aplicar máscara
    if (value.length <= 11) {
      value = value.replace(/(\d{3})(\d)/, "$1.$2");
      value = value.replace(/(\d{3})(\d)/, "$1.$2");
      value = value.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
      e.target.value = value;
    }

    const cpfLimpo = value.replace(/\D/g, "");

    // Buscar motorista
    const motorista = motoristasData.motoristas.find((m) => m.cpf === cpfLimpo);

    if (motorista) {
      cpfFeedback.textContent = `✓ ${motorista.nome}`;
      cpfFeedback.className = "status-sucesso";
      btnAcessar.disabled = false;
      sessionStorage.setItem("cpfMotorista", motorista.cpf);
      sessionStorage.setItem("nomeMotorista", motorista.nome);
      sessionStorage.setItem("matriculaMotorista", motorista.matricula);
    } else {
      btnAcessar.disabled = true;
      if (cpfLimpo.length === 11) {
        cpfFeedback.textContent = "✗ CPF não autorizado";
        cpfFeedback.className = "status-pendente";
      } else {
        cpfFeedback.textContent = "";
      }
    }
  });

  btnAcessar.addEventListener("click", () => {
    sessionStorage.setItem("timerChecklist", CONFIG.TIMER_DURACAO);
    window.location.href = "empresa.html";
  });
}

// Empresa e veículo
async function initEmpresa() {
  const selectBandeira = document.getElementById("bandeira");
  const inputPlaca = document.getElementById("placa");
  const btnContinuar = document.getElementById("btnContinuar");

  // Carregar veículos
  let veiculos = [];

  try {
    const cached = await db.cache.get("veiculos");
    if (cached) {
      veiculos = cached;
    } else {
      const response = await fetch(CONFIG.VEICULOS_URL);
      const data = await response.json();
      veiculos = DataParser.parseVeiculos(data);
      await db.cache.set("veiculos", veiculos);
    }

    console.log(`${veiculos.length} veículos carregados`);

    // Preencher datalist com placas
    const datalist = document.getElementById("sugestoesVeiculos");
    datalist.innerHTML = "";

    // Agrupar por empresa para melhor organização
    const cometa = veiculos.filter((v) => v.empresa === "COMETA");
    const outros = veiculos.filter((v) => v.empresa !== "COMETA");

    [...cometa, ...outros].forEach((v) => {
      const option = document.createElement("option");
      option.value = v.placaFormatada;
      option.textContent = `${v.prefixo} - ${v.placaFormatada} - ${v.modelo.substring(0, 30)}...`;
      datalist.appendChild(option);
    });
  } catch (error) {
    console.error("Erro ao carregar veículos:", error);
  }

  function validarForm() {
    const bandeiraOk = selectBandeira.value !== "";
    const placaOk = inputPlaca.value.length >= 7;

    if (placaOk) {
      // Verificar se placa existe na frota
      const veiculo = veiculos.find(
        (v) => v.placaFormatada === inputPlaca.value.toUpperCase(),
      );

      if (veiculo) {
        // Auto-select bandeira baseada no veículo
        if (veiculo.empresa === "COMETA") {
          selectBandeira.value = "Cometa";
        }
        inputPlaca.setCustomValidity("");
      } else {
        inputPlaca.setCustomValidity("Placa não encontrada na frota");
      }
    }

    btnContinuar.disabled = !(
      bandeiraOk &&
      placaOk &&
      !inputPlaca.validationMessage
    );
  }

  selectBandeira.addEventListener("change", validarForm);
  inputPlaca.addEventListener("input", validarForm);

  btnContinuar.addEventListener("click", () => {
    const veiculo = veiculos.find(
      (v) => v.placaFormatada === inputPlaca.value.toUpperCase(),
    );

    sessionStorage.setItem("bandeira", selectBandeira.value);
    sessionStorage.setItem("placa", inputPlaca.value.toUpperCase());
    sessionStorage.setItem("prefixo", veiculo?.prefixo || "");
    sessionStorage.setItem("modeloVeiculo", veiculo?.modelo || "");

    window.location.href = "documentos.html";
  });
}

// Documentos e fotos
async function initDocumentos() {
  const btnFotoCNH = document.getElementById("btnFotoCNH");
  const btnFotoCRLV = document.getElementById("btnFotoCRLV");
  const btnSalvar = document.getElementById("btnSalvarDocs");

  let cnhFoto = null;
  let crlvFoto = null;

  function verificarPreenchimento() {
    const cnhNumero = document.getElementById("cnh").value.length > 0;
    const crlvNumero = document.getElementById("crlv").value.length > 0;
    btnSalvar.disabled = !(cnhNumero && crlvNumero && cnhFoto && crlvFoto);
  }

  // Configurar botões de câmera
  btnFotoCNH.addEventListener("click", () => abrirCamera("cnh"));
  btnFotoCRLV.addEventListener("click", () => abrirCamera("crlv"));

  async function abrirCamera(tipo) {
    const modal = document.getElementById("modalCamera");
    const video = document.getElementById("videoCamera");

    modal.style.display = "flex";

    if (await cameraService.iniciar(video)) {
      const btnCapturar = document.getElementById("btnCapturar");
      const btnFechar = document.getElementById("btnFecharCamera");

      btnCapturar.onclick = async () => {
        const blob = await cameraService.capturar();

        if (tipo === "cnh") {
          cnhFoto = blob;
          document.getElementById("statusCNH").className = "status-sucesso";
          document.getElementById("statusCNH").textContent = "✓ Foto capturada";
        } else {
          crlvFoto = blob;
          document.getElementById("statusCRLV").className = "status-sucesso";
          document.getElementById("statusCRLV").textContent =
            "✓ Foto capturada";
        }

        cameraService.parar();
        modal.style.display = "none";
        verificarPreenchimento();
      };

      btnFechar.onclick = () => {
        cameraService.parar();
        modal.style.display = "none";
      };
    }
  }

  document
    .getElementById("cnh")
    .addEventListener("input", verificarPreenchimento);
  document
    .getElementById("crlv")
    .addEventListener("input", verificarPreenchimento);

  btnSalvar.addEventListener("click", async () => {
    // Salvar no IndexedDB
    const checklistId = await db.checklists.salvar({
      cpfMotorista: sessionStorage.getItem("cpfMotorista"),
      placa: sessionStorage.getItem("placa"),
      bandeira: sessionStorage.getItem("bandeira"),
      cnh: document.getElementById("cnh").value,
      crlv: document.getElementById("crlv").value,
    });

    if (cnhFoto) {
      await db.fotos.salvar(checklistId, "cnh", "frente", cnhFoto);
    }

    if (crlvFoto) {
      await db.fotos.salvar(checklistId, "crlv", "frente", crlvFoto);
    }

    sessionStorage.setItem("checklistId", checklistId);
    window.location.href = "inspecao.html";
  });
}

// Inspeção do veículo
async function initInspecao() {
  const checklistId = parseInt(sessionStorage.getItem("checklistId"));
  const botoesFoto = document.querySelectorAll(".btn-foto-pequeno");
  const radioRegular = document.querySelector('input[value="regular"]');
  const radioIrregular = document.querySelector('input[value="irregular"]');
  const painelIrregularidades = document.getElementById(
    "painelIrregularidades",
  );
  const btnFinalizar = document.getElementById("btnFinalizarInspecao");

  let fotosCapturadas = {};
  let irregularidades = [];

  // Carregar irregularidades
  try {
    const irregularesJSON = (await db.cache.get("irregulares")) || [];
    if (irregularesJSON.length === 0) {
      const response = await fetch(CONFIG.IRREGULARIDADES_URL);
      const data = await response.json();
      await db.cache.set("irregulares", data);
    }
  } catch (error) {
    console.error("Erro ao carregar irregularidades:", error);
  }

  // Configurar botões de foto
  botoesFoto.forEach((btn, index) => {
    const item = btn.closest(".item-inspecao");
    const posicao = item.dataset.posicao;

    btn.addEventListener("click", async () => {
      const modal = document.getElementById("modalCamera");
      const video = document.getElementById("videoCamera");

      modal.style.display = "flex";

      if (await cameraService.iniciar(video)) {
        const btnCapturar = document.getElementById("btnCapturar");
        const btnFechar = document.getElementById("btnFecharCamera");

        btnCapturar.onclick = async () => {
          const blob = await cameraService.capturar();

          // Salvar foto
          await db.fotos.salvar(checklistId, "inspecao", posicao, blob);

          fotosCapturadas[posicao] = blob;
          item.classList.add("com-foto");
          item.querySelector(".status-foto").textContent = "✓";

          cameraService.parar();
          modal.style.display = "none";
          verificarFinalizacao();
        };

        btnFechar.onclick = () => {
          cameraService.parar();
          modal.style.display = "none";
        };
      }
    });
  });

  // Radio buttons condição
  radioIrregular.addEventListener("change", () => {
    painelIrregularidades.style.display = "block";
    carregarMenuIrregularidades();
  });

  radioRegular.addEventListener("change", () => {
    painelIrregularidades.style.display = "none";
    irregularidades = [];
    verificarFinalizacao();
  });

  function carregarMenuIrregularidades() {
    const container = document.getElementById("listaIrregularidades");
    container.innerHTML = "";

    // Criar um select para cada irregularidade
    irregularidades.forEach((irr, index) => {
      adicionarLinhaIrregularidade(index, irr.posicao, irr.descricao);
    });

    // Botão adicionar nova
    document.getElementById("btnAdicionarIrregularidade").onclick = () => {
      irregularidades.push({ posicao: "", descricao: "" });
      adicionarLinhaIrregularidade(irregularidades.length - 1);
      verificarFinalizacao();
    };
  }

  function adicionarLinhaIrregularidade(
    index,
    posicaoSalva = "",
    descSalva = "",
  ) {
    const container = document.getElementById("listaIrregularidades");
    const div = document.createElement("div");
    div.className = "linha-irregularidade";
    div.innerHTML = `
            <select class="select-posicao">
                <option value="">Posição</option>
                <option value="frente">Frente</option>
                <option value="direita">Direita</option>
                <option value="esquerda">Esquerda</option>
                <option value="traseira">Traseira</option>
                <option value="topo">Topo</option>
            </select>
            <input type="text" class="input-descricao" placeholder="Descrição" value="${descSalva}">
            <button class="btn-remover">🗑️</button>
        `;

    const select = div.querySelector(".select-posicao");
    select.value = posicaoSalva;

    select.onchange = () => {
      irregularidades[index].posicao = select.value;
      verificarFinalizacao();
    };

    const input = div.querySelector(".input-descricao");
    input.oninput = () => {
      irregularidades[index].descricao = input.value;
      verificarFinalizacao();
    };

    div.querySelector(".btn-remover").onclick = () => {
      irregularidades.splice(index, 1);
      carregarMenuIrregularidades();
      verificarFinalizacao();
    };

    container.appendChild(div);
  }

  function verificarFinalizacao() {
    // Verificar se todas as 5 fotos foram capturadas
    const temTodasFotos = [
      "frente",
      "direita",
      "esquerda",
      "traseira",
      "topo",
    ].every((pos) => fotosCapturadas[pos]);

    // Verificar condição selecionada
    const condicaoSelecionada = document.querySelector(
      'input[name="condicao"]:checked',
    );

    // Se for irregular, precisa ter pelo menos uma irregularidade preenchida
    let irregularidadesValidas = true;
    if (condicaoSelecionada?.value === "irregular") {
      irregularidadesValidas =
        irregularidades.length > 0 &&
        irregularidades.every((irr) => irr.posicao && irr.descricao);
    }

    btnFinalizar.disabled = !(
      temTodasFotos &&
      condicaoSelecionada &&
      irregularidadesValidas
    );
  }

  btnFinalizar.addEventListener("click", async () => {
    // Salvar irregularidades
    for (const irr of irregularidades) {
      await db.irregulares.add({
        checklistId,
        posicao: irr.posicao,
        descricao: irr.descricao,
      });
    }

    window.location.href = "conclusao.html";
  });
}

// Conclusão
async function initConclusao() {
  const checklistId = parseInt(sessionStorage.getItem("checklistId"));
  const resumoDiv = document.getElementById("resumoDados");

  // Buscar dados do checklist
  const checklist = await db.checklists.get(checklistId);
  const fotos = await db.fotos.buscarPorChecklist(checklistId);
  const irregulares = await db.irregulares
    .where("checklistId")
    .equals(checklistId)
    .toArray();

  // Exibir resumo
  resumoDiv.innerHTML = `
        <div class="resumo-item">
            <strong>Placa:</strong> ${checklist.placa}
        </div>
        <div class="resumo-item">
            <strong>Bandeira:</strong> ${checklist.bandeira}
        </div>
        <div class="resumo-item">
            <strong>Motorista:</strong> CPF ***${checklist.cpfMotorista.slice(-3)}
        </div>
        <div class="resumo-item">
            <strong>Fotos:</strong> ${fotos.length} capturadas
        </div>
        <div class="resumo-item">
            <strong>Irregularidades:</strong> ${irregulares.length} reportada(s)
        </div>
    `;

  // Verificar conectividade
  if (navigator.onLine) {
    syncService.sincronizar();
  } else {
    syncService.registrarBackgroundSync();
  }

  document.getElementById("btnNovoChecklist").onclick = () => {
    sessionStorage.clear();
    window.location.href = "index.html";
  };

  document.getElementById("btnVerHistorico").onclick = () => {
    window.location.href = "historico.html";
  };
}

// Histórico
async function initHistorico() {
  const container = document.getElementById("listaChecklists");

  // Buscar checklists
  const checklists = await db.checklists
    .orderBy("timestamp")
    .reverse()
    .toArray();

  if (checklists.length === 0) {
    container.innerHTML =
      '<div class="vazio">Nenhum checklist encontrado</div>';
    return;
  }

  container.innerHTML = checklists
    .map(
      (c) => `
        <div class="item-checklist ${c.sincronizado ? "" : "pendente"}">
            <div style="display: flex; justify-content: space-between;">
                <strong>${c.placa}</strong>
                <span>${new Date(c.timestamp).toLocaleDateString("pt-BR")}</span>
            </div>
            <div style="margin-top: 8px;">
                <span>${c.bandeira}</span>
                <span style="float: right;">
                    ${c.sincronizado ? "✅ Sincronizado" : "⏳ Pendente"}
                </span>
            </div>
        </div>
    `,
    )
    .join("");

  document.getElementById("btnVoltar").onclick = () => {
    window.location.href = "conclusao.html";
  };

  // Filtros
  document.getElementById("buscaPlaca").addEventListener("input", filtrar);
  document.getElementById("filtroStatus").addEventListener("change", filtrar);
}
