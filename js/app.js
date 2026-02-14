// Aguardar DOM carregar
document.addEventListener("DOMContentLoaded", async () => {
  if (typeof db === "undefined") {
    console.error("Banco de dados nao inicializado");
    return;
  }

  // Version-based cache invalidation
  var cachedVersion = localStorage.getItem("app_version");
  if (cachedVersion !== CONFIG.VERSAO) {
    console.log(
      "[App] Versao atualizada: " + cachedVersion + " -> " + CONFIG.VERSAO,
    );
    await db.cache.clear("motoristas");
    await db.cache.clear("veiculos");
    await db.cache.clear("motoristas_parsed");
    await db.cache.clear("veiculos_parsed");
    localStorage.setItem("app_version", CONFIG.VERSAO);
  }

  // Registrar Service Worker (force update on every load)
  if ("serviceWorker" in navigator) {
    try {
      var reg = await navigator.serviceWorker.register("/sw.js");
      reg.update();
    } catch (error) {
      console.warn("Service Worker nao registrado:", error);
    }
  }

  // Inicializar timer se existir
  if (document.getElementById("timerDisplay")) {
    inicializarTimer();
  }

  // Carregar dados conforme pagina
  var pagina = window.location.pathname;

  if (pagina.includes("index.html") || pagina === "/") {
    await initLogin();
  } else if (pagina.includes("empresa.html")) {
    await initEmpresa();
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
  var headerEl = document.getElementById("timerHeader");
  if (
    window.location.pathname.includes("index.html") ||
    window.location.pathname === "/"
  ) {
    if (headerEl) headerEl.style.display = "none";
    return;
  }

  var tempoRestante = sessionStorage.getItem("timerChecklist");
  if (!tempoRestante) {
    tempoRestante = CONFIG.TIMER_DURACAO || 300;
    sessionStorage.setItem("timerChecklist", tempoRestante);
  } else {
    tempoRestante = parseInt(tempoRestante);
  }

  function atualizarDisplay() {
    var minutos = Math.floor(tempoRestante / 60);
    var segundos = tempoRestante % 60;
    var display = minutos + ":" + segundos.toString().padStart(2, "0");

    var timerEl = document.getElementById("timerDisplay");
    if (timerEl) timerEl.textContent = display;
    sessionStorage.setItem("timerChecklist", tempoRestante);

    if (tempoRestante <= 60) {
      var header = document.querySelector(".app-header");
      if (header) header.classList.add("urgente");
    }
  }

  atualizarDisplay();

  setInterval(function () {
    tempoRestante--;
    if (tempoRestante >= 0) {
      atualizarDisplay();
    }
  }, 1000);
}

// ========== FETCH HELPERS ==========
async function fetchDriveData(driveUrl, fallbackUrl, cacheKey) {
  // Try cache first
  var cached = await db.cache.get(cacheKey);
  if (cached) {
    console.log("[" + cacheKey + "] Dados carregados do cache");
    return cached;
  }

  // Try Drive URL via CORS proxies (try multiple)
  var proxies = [
    { name: "corsproxy.io", url: "https://corsproxy.io/?" },
    {
      name: "allorigins",
      url: "https://api.allorigins.win/raw?url=",
      encode: true,
    },
  ];

  for (var pi = 0; pi < proxies.length; pi++) {
    var proxy = proxies[pi];
    try {
      var fetchUrl = proxy.encode
        ? proxy.url + encodeURIComponent(driveUrl)
        : proxy.url + driveUrl;
      console.log(
        "[" + cacheKey + "] Tentando proxy " + proxy.name + "...",
      );
      var response = await fetch(fetchUrl);
      console.log(
        "[" + cacheKey + "] " + proxy.name + " status:",
        response.status,
      );
      if (response.ok) {
        var text = await response.text();
        console.log(
          "[" + cacheKey + "] " + proxy.name + " response length:",
          text.length,
        );
        if (text.trim().startsWith("{") || text.trim().startsWith("[")) {
          var data = JSON.parse(text);
          await db.cache.set(cacheKey, data);
          console.log(
            "[" +
              cacheKey +
              "] Dados do Drive carregados via " +
              proxy.name,
          );
          return data;
        } else {
          console.warn(
            "[" + cacheKey + "] " + proxy.name + " retornou nao-JSON:",
            text.substring(0, 200),
          );
        }
      }
    } catch (e) {
      console.warn(
        "[" + cacheKey + "] " + proxy.name + " falhou:",
        e.message,
      );
    }
  }

  // Fallback to local file
  try {
    console.log("[" + cacheKey + "] Buscando arquivo local:", fallbackUrl);
    var resp = await fetch(fallbackUrl);
    if (resp.ok) {
      var localData = await resp.json();
      await db.cache.set(cacheKey, localData);
      console.log("[" + cacheKey + "] Dados locais carregados");
      return localData;
    }
  } catch (e) {
    console.warn("[" + cacheKey + "] Fallback fetch falhou:", e.message);
  }

  console.error("[" + cacheKey + "] Nenhuma fonte de dados disponivel");
  return null;
}

// ========== LOGIN ==========
async function initLogin() {
  var cpfInput = document.getElementById("cpf");
  var btnAcessar = document.getElementById("btnAcessar");
  var cpfFeedback = document.getElementById("cpfFeedback");
  var offlineStatus = document.getElementById("offlineStatus");

  if (!cpfInput || !btnAcessar) return;

  var motoristasData = { cpfs: [], motoristas: [] };

  try {
    var data = await fetchDriveData(
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

      if (motoristasData.motoristas.length === 0) {
        console.warn(
          "[Login] Drive data nao gerou motoristas, tentando local...",
        );
        await db.cache.clear("motoristas");
        try {
          var localResp = await fetch(CONFIG.CPFS_URL);
          if (localResp.ok) {
            var localData = await localResp.json();
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
      var parsedCache = await db.cache.get("motoristas_parsed");
      if (parsedCache) {
        motoristasData = parsedCache;
        console.log(
          "[Login] Usando cache parsed:",
          motoristasData.motoristas.length,
        );
      }
    }

    if (motoristasData.cpfs.length === 0 && offlineStatus) {
      offlineStatus.style.display = "block";
    }

    if (motoristasData.motoristas.length > 0) {
      console.log(
        "[Login] Primeiros CPFs disponiveis:",
        motoristasData.motoristas.slice(0, 3).map(function (m) {
          return m.cpf;
        }),
      );
    }
  } catch (error) {
    console.error("Erro ao carregar motoristas:", error);
    if (offlineStatus) offlineStatus.style.display = "block";
  }

  // CPF input handler
  cpfInput.addEventListener("input", function (e) {
    var value = e.target.value.replace(/\D/g, "");

    if (value.length <= 11) {
      value = value.replace(/(\d{3})(\d)/, "$1.$2");
      value = value.replace(/(\d{3})(\d)/, "$1.$2");
      value = value.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
      e.target.value = value;
    }

    var cpfLimpo = value.replace(/\D/g, "");

    var motorista = motoristasData.motoristas.find(function (m) {
      return m.cpf === cpfLimpo;
    });

    if (motorista) {
      cpfFeedback.textContent =
        motorista.nome || "Motorista " + cpfLimpo.slice(-4);
      cpfFeedback.className = "feedback-success";
      btnAcessar.disabled = false;

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

  btnAcessar.addEventListener("click", function () {
    sessionStorage.setItem("timerChecklist", CONFIG.TIMER_DURACAO);
    window.location.href = "empresa.html";
  });
}

// ========== VEHICLE SELECTION (empresa.html) ==========
async function initEmpresa() {
  var searchInput = document.getElementById("searchVeiculo");
  var searchResults = document.getElementById("searchResults");
  var btnContinuar = document.getElementById("btnContinuar");
  var infoEmpresa = document.getElementById("infoEmpresa");
  var infoModelo = document.getElementById("infoModelo");
  var vehicleInfoBox = document.getElementById("vehicleInfoBox");

  // Display employee info
  var nomeMotorista = sessionStorage.getItem("nomeMotorista") || "";
  var matricula = sessionStorage.getItem("matriculaMotorista") || "";
  var empresaMot = sessionStorage.getItem("empresaMotorista") || "";
  var setorMot = sessionStorage.getItem("setorMotorista") || "";

  var userNameEl = document.getElementById("userName");
  var userMetaEl = document.getElementById("userMeta");

  if (userNameEl) {
    userNameEl.textContent =
      (matricula ? matricula + " - " : "") + nomeMotorista;
  }
  if (userMetaEl) {
    var parts = [];
    if (empresaMot) parts.push(empresaMot);
    if (setorMot) parts.push(setorMot);
    userMetaEl.textContent = parts.join(" | ");
  }

  // Load vehicles
  var veiculos = [];

  try {
    var data = await fetchDriveData(
      CONFIG.DRIVE_VEICULOS_URL,
      CONFIG.VEICULOS_URL,
      "veiculos",
    );

    if (data) {
      veiculos = DataParser.parseVeiculos(data);
      await db.cache.set("veiculos_parsed", veiculos);
    } else {
      var parsedCache = await db.cache.get("veiculos_parsed");
      if (parsedCache) veiculos = parsedCache;
    }
  } catch (error) {
    console.error("Erro ao carregar veiculos:", error);
  }

  veiculos.sort(function (a, b) {
    return a.prefixo.localeCompare(b.prefixo);
  });

  var selectedVeiculo = null;

  function renderResults(query) {
    var q = query.toUpperCase().trim();
    var filtered =
      q === ""
        ? veiculos
        : veiculos.filter(function (v) {
            return (
              v.prefixo.toUpperCase().includes(q) ||
              v.placa.toUpperCase().includes(q) ||
              v.placaFormatada.toUpperCase().includes(q)
            );
          });

    if (filtered.length === 0) {
      searchResults.innerHTML =
        '<div class="search-empty">Nenhum veiculo encontrado</div>';
      searchResults.style.display = "block";
      return;
    }

    searchResults.innerHTML = filtered
      .slice(0, 20)
      .map(function (v) {
        var idx = veiculos.indexOf(v);
        return (
          '<div class="search-result-item" data-index="' +
          idx +
          '">' +
          "<strong>" +
          v.prefixo +
          " - " +
          v.placaFormatada +
          "</strong>" +
          "<span>" +
          v.empresa +
          "</span>" +
          "</div>"
        );
      })
      .join("");
    searchResults.style.display = "block";
  }

  if (searchInput) {
    searchInput.addEventListener("input", function () {
      renderResults(searchInput.value);
      selectedVeiculo = null;
      if (vehicleInfoBox) vehicleInfoBox.classList.remove("visible");
      btnContinuar.disabled = true;
    });

    searchInput.addEventListener("focus", function () {
      renderResults(searchInput.value);
    });
  }

  document.addEventListener("click", function (e) {
    if (
      searchInput &&
      searchResults &&
      !searchInput.contains(e.target) &&
      !searchResults.contains(e.target)
    ) {
      searchResults.style.display = "none";
    }
  });

  if (searchResults) {
    searchResults.addEventListener("click", function (e) {
      var item = e.target.closest(".search-result-item");
      if (!item) return;

      var idx = parseInt(item.dataset.index);
      var veiculo = veiculos[idx];
      if (!veiculo) return;

      selectedVeiculo = veiculo;
      searchInput.value = veiculo.prefixo + " - " + veiculo.placaFormatada;
      searchResults.style.display = "none";

      if (infoEmpresa) infoEmpresa.textContent = "Empresa: " + veiculo.empresa;
      if (infoModelo && veiculo.modelo)
        infoModelo.textContent = veiculo.modelo;
      if (vehicleInfoBox) vehicleInfoBox.classList.add("visible");
      btnContinuar.disabled = false;
    });
  }

  if (btnContinuar) {
    btnContinuar.addEventListener("click", function () {
      if (selectedVeiculo) {
        sessionStorage.setItem("bandeira", selectedVeiculo.empresa);
        sessionStorage.setItem("placa", selectedVeiculo.placaFormatada);
        sessionStorage.setItem("prefixo", selectedVeiculo.prefixo);
        sessionStorage.setItem("modeloVeiculo", selectedVeiculo.modelo || "");
      }
      window.location.href = "inspecao.html";
    });
  }
}

// ========== INSPECAO ==========
async function initInspecao() {
  // Create checklist at start of inspection
  var checklistId = await db.checklists.salvar({
    cpfMotorista: sessionStorage.getItem("cpfMotorista"),
    nomeMotorista: sessionStorage.getItem("nomeMotorista"),
    matricula: sessionStorage.getItem("matriculaMotorista"),
    placa: sessionStorage.getItem("placa"),
    prefixo: sessionStorage.getItem("prefixo"),
    bandeira: sessionStorage.getItem("bandeira"),
  });
  sessionStorage.setItem("checklistId", checklistId);

  var container = document.getElementById("posicoesContainer");
  var btnFinalizar = document.getElementById("btnFinalizarInspecao");

  // State for each position
  var estado = {};
  CONFIG.POSICOES.forEach(function (pos) {
    estado[pos] = {
      fotos: [],
      condicao: null,
      irregularidades: [],
    };
  });

  var posicaoIcons = {
    dianteira:
      '<line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline>',
    lateral_direita:
      '<line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline>',
    lateral_esquerda:
      '<line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline>',
    traseira:
      '<line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline>',
  };

  // Build position cards dynamically
  CONFIG.POSICOES.forEach(function (pos) {
    var label = CONFIG.POSICAO_LABELS[pos] || pos;
    var card = document.createElement("div");
    card.className = "posicao-card";
    card.id = "posicao-" + pos;

    var fotosHTML = "";
    for (var i = 0; i < CONFIG.MAX_FOTOS_POR_POSICAO; i++) {
      fotosHTML +=
        '<div class="foto-slot vazio" data-pos="' +
        pos +
        '" data-idx="' +
        i +
        '">' +
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>' +
        '<circle cx="12" cy="13" r="4"></circle>' +
        "</svg>" +
        "<span>Foto " +
        (i + 1) +
        (i === 0 ? " *" : "") +
        "</span>" +
        "</div>";
    }

    card.innerHTML =
      '<div class="posicao-header">' +
      '<div class="posicao-icon">' +
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      posicaoIcons[pos] +
      "</svg>" +
      "</div>" +
      "<h3>" +
      label +
      "</h3>" +
      '<span class="posicao-foto-count" id="count-' +
      pos +
      '">0/' +
      CONFIG.MAX_FOTOS_POR_POSICAO +
      "</span>" +
      "</div>" +
      '<div class="fotos-grid">' +
      fotosHTML +
      "</div>" +
      '<div class="condicao-section">' +
      '<div class="condicao-toggle">' +
      '<button class="btn-condicao btn-regular" data-pos="' +
      pos +
      '" data-val="regular">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' +
      " Regular" +
      "</button>" +
      '<button class="btn-condicao btn-irregular" data-pos="' +
      pos +
      '" data-val="irregular">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>' +
      " Irregular" +
      "</button>" +
      "</div>" +
      "</div>" +
      '<div class="irregularidades-section" id="irr-section-' +
      pos +
      '" style="display:none">' +
      '<div class="irr-lista" id="irr-lista-' +
      pos +
      '"></div>' +
      '<button class="btn-add-irr" data-pos="' +
      pos +
      '">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>' +
      " Adicionar Irregularidade" +
      "</button>" +
      "</div>";

    container.appendChild(card);
  });

  // Helper to reset a photo slot to empty state
  function resetFotoSlot(pos, idx) {
    var slot = container.querySelector(
      '.foto-slot[data-pos="' + pos + '"][data-idx="' + idx + '"]',
    );
    if (!slot) return;
    estado[pos].fotos[idx] = null;
    slot.className = "foto-slot vazio";
    slot.innerHTML =
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>' +
      '<circle cx="12" cy="13" r="4"></circle>' +
      "</svg>" +
      "<span>Foto " +
      (idx + 1) +
      (idx === 0 ? " *" : "") +
      "</span>";
    updateFotoCount(pos);
    verificarFinalizacao();
  }

  function updateFotoCount(pos) {
    var count = estado[pos].fotos.filter(Boolean).length;
    var countEl = document.getElementById("count-" + pos);
    if (countEl)
      countEl.textContent = count + "/" + CONFIG.MAX_FOTOS_POR_POSICAO;
  }

  // Event delegation for all clicks inside positions container
  container.addEventListener("click", async function (e) {
    // Delete photo button
    var btnDeleteFoto = e.target.closest(".btn-delete-foto");
    if (btnDeleteFoto) {
      e.stopPropagation();
      var dPos = btnDeleteFoto.dataset.pos;
      var dIdx = parseInt(btnDeleteFoto.dataset.idx);
      resetFotoSlot(dPos, dIdx);
      return;
    }

    // Photo slot click (only if empty - vazio)
    var slot = e.target.closest(".foto-slot");
    if (slot) {
      // If already captured, do nothing (use delete button)
      if (slot.classList.contains("capturada")) return;
      var pos = slot.dataset.pos;
      var idx = parseInt(slot.dataset.idx);
      await abrirCamera(pos, idx, slot);
      return;
    }

    // Condition button click
    var btnCondicao = e.target.closest(".btn-condicao");
    if (btnCondicao) {
      var cPos = btnCondicao.dataset.pos;
      var cVal = btnCondicao.dataset.val;

      var parent = btnCondicao.parentElement;
      parent.querySelectorAll(".btn-condicao").forEach(function (b) {
        b.classList.remove("active");
      });
      btnCondicao.classList.add("active");

      estado[cPos].condicao = cVal;

      var irrSection = document.getElementById("irr-section-" + cPos);
      if (cVal === "irregular") {
        irrSection.style.display = "block";
        if (estado[cPos].irregularidades.length === 0) {
          adicionarIrregularidade(cPos);
        }
      } else {
        irrSection.style.display = "none";
        estado[cPos].irregularidades = [];
        document.getElementById("irr-lista-" + cPos).innerHTML = "";
      }
      verificarFinalizacao();
      return;
    }

    // Add irregularity button
    var btnAddIrr = e.target.closest(".btn-add-irr");
    if (btnAddIrr) {
      adicionarIrregularidade(btnAddIrr.dataset.pos);
      return;
    }

    // Remove irregularity button
    var btnRemIrr = e.target.closest(".btn-remover-irr");
    if (btnRemIrr) {
      var rPos = btnRemIrr.dataset.pos;
      var rIdx = parseInt(btnRemIrr.dataset.idx);
      estado[rPos].irregularidades.splice(rIdx, 1);
      renderIrregularidades(rPos);
      verificarFinalizacao();
      return;
    }

    // Photo for irregularity button
    var btnFotoIrr = e.target.closest(".btn-foto-irr");
    if (btnFotoIrr) {
      var fPos = btnFotoIrr.dataset.pos;
      var fIdx = parseInt(btnFotoIrr.dataset.idx);
      await abrirCameraIrregularidade(fPos, fIdx);
      return;
    }

    // Delete irregularity photo
    var btnDeleteIrrFoto = e.target.closest(".btn-delete-irr-foto");
    if (btnDeleteIrrFoto) {
      var diPos = btnDeleteIrrFoto.dataset.pos;
      var diIdx = parseInt(btnDeleteIrrFoto.dataset.idx);
      estado[diPos].irregularidades[diIdx].foto = null;
      estado[diPos].irregularidades[diIdx].fotoUrl = null;
      renderIrregularidades(diPos);
      verificarFinalizacao();
      return;
    }
  });

  // Handle irregularity dropdown changes
  container.addEventListener("change", function (e) {
    if (e.target.classList.contains("select-irr")) {
      var pos = e.target.dataset.pos;
      var idx = parseInt(e.target.dataset.idx);
      estado[pos].irregularidades[idx].tipo = e.target.value;
      verificarFinalizacao();
    }
  });

  function adicionarIrregularidade(pos) {
    estado[pos].irregularidades.push({ tipo: "", foto: null, fotoUrl: null });
    renderIrregularidades(pos);
    verificarFinalizacao();
  }

  function renderIrregularidades(pos) {
    var lista = document.getElementById("irr-lista-" + pos);
    var tipos = CONFIG.IRREGULARIDADES[pos] || [];

    lista.innerHTML = estado[pos].irregularidades
      .map(function (irr, idx) {
        var fotoSection = "";
        if (irr.foto && irr.fotoUrl) {
          // Show preview with delete button
          fotoSection =
            '<div class="irr-foto-preview">' +
            '<img src="' +
            irr.fotoUrl +
            '" alt="Foto irregularidade">' +
            '<button class="btn-delete-irr-foto" data-pos="' +
            pos +
            '" data-idx="' +
            idx +
            '" type="button">' +
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
            "</button>" +
            "</div>";
        } else {
          // Show capture button
          fotoSection =
            '<button class="btn-foto-irr" data-pos="' +
            pos +
            '" data-idx="' +
            idx +
            '">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>' +
            " Tirar foto da irregularidade *" +
            "</button>";
        }

        return (
          '<div class="irr-item">' +
          '<div class="irr-item-top">' +
          '<select class="select-irr" data-pos="' +
          pos +
          '" data-idx="' +
          idx +
          '">' +
          '<option value="">Selecione o tipo...</option>' +
          tipos
            .map(function (tipo) {
              return (
                '<option value="' +
                tipo +
                '"' +
                (irr.tipo === tipo ? " selected" : "") +
                ">" +
                tipo +
                "</option>"
              );
            })
            .join("") +
          "</select>" +
          '<button class="btn-remover-irr" data-pos="' +
          pos +
          '" data-idx="' +
          idx +
          '" type="button">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
          "</button>" +
          "</div>" +
          fotoSection +
          "</div>"
        );
      })
      .join("");
  }

  async function abrirCamera(pos, idx, slotEl) {
    var modal = document.getElementById("modalCamera");
    var video = document.getElementById("videoCamera");
    modal.style.display = "flex";

    if (await cameraService.iniciar(video)) {
      document.getElementById("btnCapturar").onclick = async function () {
        var blob = await cameraService.capturar();
        estado[pos].fotos[idx] = blob;
        await db.fotos.salvar(checklistId, "inspecao", pos + "_" + idx, blob);

        var blobUrl = URL.createObjectURL(blob);
        slotEl.classList.remove("vazio");
        slotEl.classList.add("capturada");
        slotEl.innerHTML =
          '<img src="' +
          blobUrl +
          '" alt="Foto">' +
          "<span>Foto " +
          (idx + 1) +
          "</span>" +
          '<button class="btn-delete-foto" data-pos="' +
          pos +
          '" data-idx="' +
          idx +
          '" type="button">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
          "</button>";

        updateFotoCount(pos);
        cameraService.parar();
        modal.style.display = "none";
        verificarFinalizacao();
      };
      document.getElementById("btnFecharCamera").onclick = function () {
        cameraService.parar();
        modal.style.display = "none";
      };
    }
  }

  async function abrirCameraIrregularidade(pos, idx) {
    var modal = document.getElementById("modalCamera");
    var video = document.getElementById("videoCamera");
    modal.style.display = "flex";

    if (await cameraService.iniciar(video)) {
      document.getElementById("btnCapturar").onclick = async function () {
        var blob = await cameraService.capturar();
        var blobUrl = URL.createObjectURL(blob);
        estado[pos].irregularidades[idx].foto = blob;
        estado[pos].irregularidades[idx].fotoUrl = blobUrl;
        await db.fotos.salvar(
          checklistId,
          "irregularidade",
          pos + "_irr_" + idx,
          blob,
        );

        cameraService.parar();
        modal.style.display = "none";
        renderIrregularidades(pos);
        verificarFinalizacao();
      };
      document.getElementById("btnFecharCamera").onclick = function () {
        cameraService.parar();
        modal.style.display = "none";
      };
    }
  }

  function verificarFinalizacao() {
    var valid = true;

    CONFIG.POSICOES.forEach(function (pos) {
      var st = estado[pos];
      // Must have at least 1 photo per position
      if (st.fotos.filter(Boolean).length === 0) valid = false;
      // Must have condition selected
      if (!st.condicao) valid = false;
      // If irregular, all irregularities need type + photo
      if (st.condicao === "irregular") {
        if (st.irregularidades.length === 0) valid = false;
        st.irregularidades.forEach(function (irr) {
          if (!irr.tipo || !irr.foto) valid = false;
        });
      }
    });

    btnFinalizar.disabled = !valid;
  }

  btnFinalizar.addEventListener("click", async function () {
    // Save all irregularities
    for (var p = 0; p < CONFIG.POSICOES.length; p++) {
      var pos = CONFIG.POSICOES[p];
      var st = estado[pos];
      if (st.condicao === "irregular") {
        for (var i = 0; i < st.irregularidades.length; i++) {
          var irr = st.irregularidades[i];
          await db.irregulares.salvar({
            checklistId: checklistId,
            posicao: pos,
            tipo: irr.tipo,
          });
        }
      }
    }
    window.location.href = "conclusao.html";
  });
}

// ========== CONCLUSAO ==========
async function initConclusao() {
  var checklistId = parseInt(sessionStorage.getItem("checklistId"));
  var resumoDiv = document.getElementById("resumoDados");

  var checklist = await db.checklists.get(checklistId);
  var fotos = await db.fotos.buscarPorChecklist(checklistId);
  var irregulares = await db.irregulares.buscarPorChecklist(checklistId);

  if (checklist && resumoDiv) {
    var nomeMotorista = sessionStorage.getItem("nomeMotorista") || "";
    var matricula = sessionStorage.getItem("matriculaMotorista") || "";

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

  var btnNovo = document.getElementById("btnNovoChecklist");
  if (btnNovo) {
    btnNovo.onclick = function () {
      sessionStorage.clear();
      window.location.href = "index.html";
    };
  }

  var btnHistorico = document.getElementById("btnVerHistorico");
  if (btnHistorico) {
    btnHistorico.onclick = function () {
      window.location.href = "historico.html";
    };
  }
}

// ========== HISTORICO ==========
async function initHistorico() {
  var container = document.getElementById("listaChecklists");

  var checklists = await db.checklists.getAll();
  checklists.sort(function (a, b) {
    return b.timestamp - a.timestamp;
  });

  function renderChecklists(list) {
    if (list.length === 0) {
      container.innerHTML =
        '<div class="vazio">Nenhum checklist encontrado</div>';
      return;
    }

    container.innerHTML = list
      .map(function (c) {
        return (
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
          "</div>"
        );
      })
      .join("");
  }

  renderChecklists(checklists);

  function filtrar() {
    var buscaPlaca = (
      document.getElementById("buscaPlaca").value || ""
    ).toUpperCase();
    var filtroStatus = document.getElementById("filtroStatus").value;

    var filtered = checklists;

    if (buscaPlaca) {
      filtered = filtered.filter(function (c) {
        return (
          c.placa.includes(buscaPlaca) ||
          (c.prefixo && c.prefixo.includes(buscaPlaca))
        );
      });
    }

    if (filtroStatus !== "") {
      filtered = filtered.filter(function (c) {
        return c.sincronizado === parseInt(filtroStatus);
      });
    }

    renderChecklists(filtered);
  }

  var btnVoltar = document.getElementById("btnVoltar");
  if (btnVoltar) {
    btnVoltar.onclick = function () {
      window.location.href = "index.html";
    };
  }

  var buscaInput = document.getElementById("buscaPlaca");
  var filtroSelect = document.getElementById("filtroStatus");
  if (buscaInput) buscaInput.addEventListener("input", filtrar);
  if (filtroSelect) filtroSelect.addEventListener("change", filtrar);
}
