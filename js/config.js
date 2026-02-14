const CONFIG = {
  // Google Drive URLs (primary data source)
  DRIVE_VEICULOS_URL:
    "https://drive.google.com/uc?export=download&id=1J6NDpynIQO15GyuBZ79acxpmYjPWkXOA",
  DRIVE_QUADRO_URL:
    "https://drive.google.com/uc?export=download&id=1vo_96XYZY_eAccOPFnLHEGGKJtISGfCd",

  // CORS proxy (needed because Drive blocks cross-origin requests)
  CORS_PROXY: "https://corsproxy.io/?",

  // Local fallback URLs
  CPFS_URL: "/data/cpfs.json",
  VEICULOS_URL: "/data/veiculos.json",

  TIMER_DURACAO: 300,
  QUALIDADE_IMAGEM: 0.7,
  MAX_LARGURA_FOTO: 1280,
  VERSAO: "2.3.0",

  MAX_FOTOS_POR_POSICAO: 3,
  POSICOES: ["dianteira", "lateral_direita", "lateral_esquerda", "traseira"],

  POSICAO_LABELS: {
    dianteira: "Dianteira",
    lateral_direita: "Lateral Direita",
    lateral_esquerda: "Lateral Esquerda",
    traseira: "Traseira",
  },

  IRREGULARIDADES: {
    dianteira: [
      "Farol quebrado/trincado",
      "Farol desalinhado",
      "Para-choque danificado/trincado",
      "Para-choque solto",
      "Grade dianteira danificada",
      "Pintura arranhada/descascada",
      "Retrovisor externo quebrado",
      "Para-brisa trincado",
      "Palheta do limpador danificada",
      "Braco do limpador danificado",
    ],
    lateral_direita: [
      "Retrovisor lateral quebrado/trincado",
      "Vidro da porta quebrado/trincado",
      "Fechadura da porta com defeito",
      "Borracha de vedacao solta/danificada",
      "Pintura arranhada/descascada",
      "Lataria amassada",
      "Faixa refletiva solta/danificada",
      "Seta lateral quebrada",
    ],
    lateral_esquerda: [
      "Retrovisor lateral quebrado/trincado",
      "Vidro da porta quebrado/trincado",
      "Fechadura da porta com defeito",
      "Borracha de vedacao solta/danificada",
      "Pintura arranhada/descascada",
      "Lataria amassada",
      "Faixa refletiva solta/danificada",
      "Seta lateral quebrada",
    ],
    traseira: [
      "Lanterna traseira quebrada/trincada",
      "Lanterna de re queimada",
      "Seta traseira queimada",
      "Luz de freio queimada",
      "Para-choque traseiro danificado/trincado",
      "Para-choque traseiro solto",
      "Tampa do motor traseiro danificada",
      "Pintura arranhada/descascada",
      "Lataria amassada",
      "Escapamento danificado/solto",
      "Suporte de placa danificado/faltando",
      "Placa ilegivel/danificada",
      "Luz da placa queimada",
      "Vidro traseiro trincado/quebrado",
    ],
  },
};
