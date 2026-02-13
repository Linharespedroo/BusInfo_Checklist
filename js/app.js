// Aguardar DOM carregar
document.addEventListener("DOMContentLoaded", async () => {
  if (typeof db === "undefined") {
    console.error("Banco de dados nao inicializado");
    return;
  }

  // Registrar Service Worker
  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("/sw.js");
    } catch (error) {
      console.warn("Service Worker nao registrado:", error);
    }
  }

  // Inicializar timer se existir
  if (document.getElementById("timerDisplay")) {
    inicializarTimer();
  }

  // Carregar dados conforme pagina
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

// ========== TIMER ==========
function inicializarTimer() {
  const headerEl = document.getElementById("timerHeader");
  // Hide timer on login page
  if (
    window.location.pathname.includes("index.html") ||
    window.location.pathname === "/"
  ) {
    if (headerEl) headerEl.style.display = "none";
    return;
  }

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
    const display = minutos + ":" + segundos.toString().padStart(2, "0");

    const timerEl = document.getElementById("timerDisplay");
    if (timerEl) timerEl.textContent = display;
    sessionStorage.setItem("timerChecklist", tempoRestante);

    if (tempoRestante <= 60) {
      const header = document.querySelector(".app-header");
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

// ========== FETCH HELPERS ==========
async function fetchDriveData(driveUrl, fallbackUrl, cacheKey) {
  // Try cache first
  const cached = await db.cache.get(cacheKey);
  if (cached) {
    console.log("[" + cacheKey + "] Dados carregados do cache");
    return cached;
  }

  // Try Drive URL
  try {
    console.log("[" + cacheKey + "] Buscando do Drive...");
    const response = await fetch(driveUrl);
    console.log("[" + cacheKey + "] Drive status:", response.status);
    if (response.ok) {
      const text = await response.text();
      // Validate that it's actually JSON (Drive may return HTML login/confirm page)
      if (text.trim().startsWith("{") || text.trim().startsWith("[")) {
        const data = JSON.parse(text);
        await db.cache.set(cacheKey, data);
        console.log("[" + cacheKey + "] Dados do Drive carregados com sucesso");
        return data;
      } else {
        console.warn("[" + cacheKey + "] Drive retornou conteudo nao-JSON");
      }
    }
  } catch (e) {
    console.warn("[" + cacheKey + "] Drive fetch falhou:", e.message);
  }

  // Fallback to local file
  try {
    console.log("[" + cacheKey + "] Buscando arquivo local:", fallbackUrl);
    const response = await fetch(fallbackUrl);
    console.log("[" + cacheKey + "] Local status:", response.status);
    if (response.ok) {
      const data = await response.json();
      await db.cache.set(cacheKey, data);
      console.log("[" + cacheKey + "] Dados locais carregados com sucesso");
      return data;
    }
  } catch (e) {
    console.warn("[" + cacheKey + "] Fallback fetch falhou:", e.message);
  }

  console.error("[" + cacheKey + "] Nenhuma fonte de dados disponivel");
  return null;
}

// ========== LOGIN ==========
async function initLogin() {
  const cpfInput = document.getElementById("cpf");
  const btnAcessar = document.getElementById("btnAcessar");
  const cpfFeedback = document.getElementById("cpfFeedback");
  const offlineStatus = document.getElementById("offlineStatus");

  if (!cpfInput || !btnAcessar) return;

  // Load employee data (quadro)
  let motoristasData = { cpfs: [], motoristas: [] };

  try {
    // Clear stale cache to force fresh load (remove after debugging)
    // await db.cache.clear("motoristas");

    const data = await fetchDriveData(
      CONFIG.DRIVE_QUADRO_URL,
      CONFIG.CPFS_URL,
      "motoristas",
    );

    if (data) {
      motoristasData = DataParser.parseMotoristas(data);
      console.log(
        "[Login] Motoristas parsed:",
        motoristasData.motoristas.length,
        "registros",
      );

      // If Drive returned something but parser found nothing, try local
      if (motoristasData.motoristas.length === 0) {
        console.warn("[Login] Drive data nao gerou motoristas, tentando local...");
        await db.cache.clear("motoristas");
        try {
          const localResp = await fetch(CONFIG.CPFS_URL);
          if (localResp.ok) {
            const localData = await localResp.json();
            motoristasData = DataParser.parseMotoristas(localData);
            console.log(
              "[Login] Motoristas do local:",
              motoristasData.motoristas.length,
            );
          }
        } catch (e) {
          console.warn("[Login] Local fallback tambem falhou:", e.message);
        }
      }

      if (motoristasData.motoristas.length > 0) {
        await db.cache.set("motoristas_parsed", motoristasData);
      }
    } else {
      // Try parsed cache
      const parsedCache = await db.cache.get("motoristas_parsed");
      if (parsedCache) {
        motoristasData = parsedCache;
        console.log("[Login] Usando cache parsed:", motoristasData.motoristas.length);
      }
    }

    if (motoristasData.cpfs.length === 0 && offlineStatus) {
      offlineStatus.style.display = "block";
    }

    // Log first few CPFs for debugging
    if (motoristasData.motoristas.length > 0) {
      console.log(
        "[Login] Primeiros CPFs disponiveis:",
        motoristasData.motoristas.slice(0, 3).map((m) => m.cpf),
      );
    }
  } catch (error) {
    console.error("Erro ao carregar motoristas:", error);
    if (offlineStatus) offlineStatus.style.display = "block";
  }

  // CPF input handler
  cpfInput.addEventListener("input", (e) => {
    let value = e.target.value.replace(/\D/g, "");

    // Apply mask
    if (value.length <= 11) {
      value = value.replace(/(\d{3})(\d)/, "$1.$2");
      value = value.replace(/(\d{3})(\d)/, "$1.$2");
      value = value.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
      e.target.value = value;
    }

    const cpfLimpo = value.replace(/\D/g, "");

    // Find employee
    const motorista = motoristasData.motoristas.find(
      (m) => m.cpf === cpfLimpo,
    );

    if (motorista) {
      cpfFeedback.textContent = motorista.nome || "Motorista " + cpfLimpo.slice(-4);
      cpfFeedback.className = "feedback-success";
      btnAcessar.disabled = false;

      // Store employee data
      sessionStorage.setItem("cpfMotorista", motorista.cpf);
      sessionStorage.setItem("nomeMotorista", motorista.nome);
      sessionStorage.setItem("matriculaMotorista", motorista.matricula || "");
      sessionStorage.setItem("empresaMotorista", motorista.empresa || "");
      sessionStorage.setItem("setorMotorista", motorista.setor || "");
    } else {
      btnAcessar.disabled = true;
      if (cpfLimpo.length === 11) {
        cpfFeedback.textContent = "CPF nao autorizado";
        cpfFeedback.className = "feedback-error";
      } else {
        cpfFeedback.textContent = "";
        cpfFeedback.className = "";
      }
    }
  });

  btnAcessar.addEventListener("click", () => {
    sessionStorage.setItem("timerChecklist", CONFIG.TIMER_DURACAO);
    window.location.href = "empresa.html";
  });
}

// ========== VEHICLE SELECTION (empresa.html) ==========
async function initEmpresa() {
  const selectVeiculo = document.getElementById("selectVeiculo");
  const btnContinuar = document.getElementById("btnContinuar");
  const infoEmpresa = document.getElementById("infoEmpresa");
  const infoModelo = document.getElementById("infoModelo");

  // Display employee info
  const nomeMotorista = sessionStorage.getItem("nomeMotorista") || "";
  const matricula = sessionStorage.getItem("matriculaMotorista") || "";
  const empresaMot = sessionStorage.getItem("empresaMotorista") || "";
  const setorMot = sessionStorage.getItem("setorMotorista") || "";

  const userNameEl = document.getElementById("userName");
  const userMetaEl = document.getElementById("userMeta");

  if (userNameEl) {
    userNameEl.textContent =
      (matricula ? matricula + " - " : "") + nomeMotorista;
  }
  if (userMetaEl) {
    const parts = [];
    if (empresaMot) parts.push(empresaMot);
    if (setorMot) parts.push(setorMot);
    userMetaEl.textContent = parts.join(" | ");
  }

  // Load vehicles
  let veiculos = [];

  try {
    const data = await fetchDriveData(
      CONFIG.DRIVE_VEICULOS_URL,
      CONFIG.VEICULOS_URL,
      "veiculos",
    );

    if (data) {
      veiculos = DataParser.parseVeiculos(data);
      await db.cache.set("veiculos_parsed", veiculos);
    } else {
      const parsedCache = await db.cache.get("veiculos_parsed");
      if (parsedCache) veiculos = parsedCache;
    }
  } catch (error) {
    console.error("Erro ao carregar veiculos:", error);
  }

  // Populate vehicle dropdown
  if (selectVeiculo) {
    // Sort by prefixo
    veiculos.sort((a, b) => a.prefixo.localeCompare(b.prefixo));

    veiculos.forEach((v, index) => {
      const option = document.createElement("option");
      option.value = index;
      option.textContent = v.prefixo + " - " + v.placaFormatada;
      selectVeiculo.appendChild(option);
    });
  }

  // Vehicle selection handler
  const vehicleInfoBox = document.getElementById("vehicleInfoBox");

  if (selectVeiculo) {
    selectVeiculo.addEventListener("change", () => {
      const idx = selectVeiculo.value;
      if (idx === "") {
        if (infoEmpresa) infoEmpresa.textContent = "";
        if (infoModelo) infoModelo.textContent = "";
        if (vehicleInfoBox) vehicleInfoBox.classList.remove("visible");
        btnContinuar.disabled = true;
        return;
      }

      const veiculo = veiculos[parseInt(idx)];
      if (veiculo) {
        if (infoEmpresa) {
          infoEmpresa.textContent = "Empresa: " + veiculo.empresa;
        }
        if (infoModelo && veiculo.modelo) {
          infoModelo.textContent = veiculo.modelo;
        }
        if (vehicleInfoBox) vehicleInfoBox.classList.add("visible");
        btnContinuar.disabled = false;
      }
    });
  }

  if (btnContinuar) {
    btnContinuar.addEventListener("click", () => {
      const idx = selectVeiculo.value;
      const veiculo = veiculos[parseInt(idx)];

      if (veiculo) {
        sessionStorage.setItem("bandeira", veiculo.empresa);
        sessionStorage.setItem("placa", veiculo.placaFormatada);
        sessionStorage.setItem("prefixo", veiculo.prefixo);
        sessionStorage.setItem("modeloVeiculo", veiculo.modelo || "");
      }

      window.location.href = "documentos.html";
    });
  }
}

// ========== DOCUMENTOS ==========
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
          document.getElementById("statusCNH").textContent = "Foto capturada";
        } else {
          crlvFoto = blob;
          document.getElementById("statusCRLV").className = "status-sucesso";
          document.getElementById("statusCRLV").textContent = "Foto capturada";
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
    const checklistId = await db.checklists.salvar({
      cpfMotorista: sessionStorage.getItem("cpfMotorista"),
      nomeMotorista: sessionStorage.getItem("nomeMotorista"),
      matricula: sessionStorage.getItem("matriculaMotorista"),
      placa: sessionStorage.getItem("placa"),
      prefixo: sessionStorage.getItem("prefixo"),
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

// ========== INSPECAO ==========
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

  // Load irregularity types
  try {
    const irregularesCache = await db.cache.get("irregulares");
    if (!irregularesCache) {
      const response = await fetch(CONFIG.IRREGULARIDADES_URL);
      const data = await response.json();
      await db.cache.set("irregulares", data);
    }
  } catch (error) {
    console.error("Erro ao carregar irregularidades:", error);
  }

  // Photo buttons
  botoesFoto.forEach((btn) => {
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
          await db.fotos.salvar(checklistId, "inspecao", posicao, blob);

          fotosCapturadas[posicao] = blob;
          item.classList.add("com-foto");
          item.querySelector(".status-foto").textContent = "OK";

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

  // Condition radio buttons
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

    irregularidades.forEach((irr, index) => {
      adicionarLinhaIrregularidade(index, irr.posicao, irr.descricao);
    });

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
    div.innerHTML =
      '<select class="select-posicao">' +
      '<option value="">Posicao</option>' +
      '<option value="frente">Frente</option>' +
      '<option value="direita">Direita</option>' +
      '<option value="esquerda">Esquerda</option>' +
      '<option value="traseira">Traseira</option>' +
      '<option value="topo">Topo</option>' +
      "</select>" +
      '<input type="text" class="input-descricao" placeholder="Descricao" value="' +
      descSalva +
      '">' +
      '<button class="btn-remover" type="button">Remover</button>';

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
    const temTodasFotos = [
      "frente",
      "direita",
      "esquerda",
      "traseira",
      "topo",
    ].every((pos) => fotosCapturadas[pos]);

    const condicaoSelecionada = document.querySelector(
      'input[name="condicao"]:checked',
    );

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
    for (const irr of irregularidades) {
      await db.irregulares.salvar({
        checklistId,
        posicao: irr.posicao,
        descricao: irr.descricao,
      });
    }
    window.location.href = "conclusao.html";
  });
}

// ========== CONCLUSAO ==========
async function initConclusao() {
  const checklistId = parseInt(sessionStorage.getItem("checklistId"));
  const resumoDiv = document.getElementById("resumoDados");

  const checklist = await db.checklists.get(checklistId);
  const fotos = await db.fotos.buscarPorChecklist(checklistId);
  const irregulares = await db.irregulares.buscarPorChecklist(checklistId);

  if (checklist && resumoDiv) {
    const nomeMotorista = sessionStorage.getItem("nomeMotorista") || "";
    const matricula = sessionStorage.getItem("matriculaMotorista") || "";

    resumoDiv.innerHTML =
      '<div class="resumo-item"><strong>Motorista:</strong> ' +
      (matricula ? matricula + " - " : "") +
      nomeMotorista +
      "</div>" +
      '<div class="resumo-item"><strong>Prefixo / Placa:</strong> ' +
      (checklist.prefixo || "") +
      " / " +
      checklist.placa +
      "</div>" +
      '<div class="resumo-item"><strong>Empresa:</strong> ' +
      checklist.bandeira +
      "</div>" +
      '<div class="resumo-item"><strong>Fotos:</strong> ' +
      fotos.length +
      " capturadas</div>" +
      '<div class="resumo-item"><strong>Irregularidades:</strong> ' +
      irregulares.length +
      " reportada(s)</div>";
  }

  // Sync
  if (typeof syncService !== "undefined") {
    if (navigator.onLine) {
      syncService.sincronizar();
    } else {
      syncService.registrarBackgroundSync();
    }
  }

  const btnNovo = document.getElementById("btnNovoChecklist");
  if (btnNovo) {
    btnNovo.onclick = () => {
      sessionStorage.clear();
      window.location.href = "index.html";
    };
  }

  const btnHistorico = document.getElementById("btnVerHistorico");
  if (btnHistorico) {
    btnHistorico.onclick = () => {
      window.location.href = "historico.html";
    };
  }
}

// ========== HISTORICO ==========
async function initHistorico() {
  const container = document.getElementById("listaChecklists");

  const checklists = await db.checklists.getAll();
  // Sort by timestamp descending
  checklists.sort((a, b) => b.timestamp - a.timestamp);

  function renderChecklists(list) {
    if (list.length === 0) {
      container.innerHTML =
        '<div class="vazio">Nenhum checklist encontrado</div>';
      return;
    }

    container.innerHTML = list
      .map(
        (c) =>
          '<div class="item-checklist ' +
          (c.sincronizado ? "" : "pendente") +
          '">' +
          '<div class="checklist-header-row">' +
          "<strong>" +
          (c.prefixo || "") +
          " - " +
          c.placa +
          "</strong>" +
          "<span>" +
          new Date(c.timestamp).toLocaleDateString("pt-BR") +
          "</span>" +
          "</div>" +
          '<div class="checklist-detail-row">' +
          "<span>" +
          c.bandeira +
          "</span>" +
          "<span>" +
          (c.sincronizado ? "Sincronizado" : "Pendente") +
          "</span>" +
          "</div>" +
          "</div>",
      )
      .join("");
  }

  renderChecklists(checklists);

  // Filter function
  function filtrar() {
    const buscaPlaca = (
      document.getElementById("buscaPlaca").value || ""
    ).toUpperCase();
    const filtroStatus = document.getElementById("filtroStatus").value;

    let filtered = checklists;

    if (buscaPlaca) {
      filtered = filtered.filter(
        (c) =>
          c.placa.includes(buscaPlaca) ||
          (c.prefixo && c.prefixo.includes(buscaPlaca)),
      );
    }

    if (filtroStatus !== "") {
      filtered = filtered.filter(
        (c) => c.sincronizado === parseInt(filtroStatus),
      );
    }

    renderChecklists(filtered);
  }

  const btnVoltar = document.getElementById("btnVoltar");
  if (btnVoltar) {
    btnVoltar.onclick = () => {
      window.location.href = "index.html";
    };
  }

  const buscaInput = document.getElementById("buscaPlaca");
  const filtroSelect = document.getElementById("filtroStatus");
  if (buscaInput) buscaInput.addEventListener("input", filtrar);
  if (filtroSelect) filtroSelect.addEventListener("change", filtrar);
}
