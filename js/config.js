const CONFIG = {
  // Google Drive URLs (primary data source)
  DRIVE_VEICULOS_URL:
    "https://drive.google.com/uc?export=download&id=1J6NDpynIQO15GyuBZ79acxpmYjPWkXOA",
  DRIVE_QUADRO_URL:
    "https://drive.google.com/uc?export=download&id=1vo_96XYZY_eAccOPFnLHEGGKJtISGfCd",

  // Local fallback URLs
  CPFS_URL: "/data/cpfs.json",
  VEICULOS_URL: "/data/veiculos.json",

  TIMER_DURACAO: 300,
  QUALIDADE_IMAGEM: 0.7,
  MAX_LARGURA_FOTO: 1280,
  VERSAO: "2.1.0",

  MAX_FOTOS_POR_POSICAO: 3,
  POSICOES: ["frente", "direita", "esquerda", "traseira"],

  IRREGULARIDADES: {
    frente: [
      "Farol queimado",
      "Para-choque danificado",
      "Vidro trincado/quebrado",
      "Placa danificada",
      "Pintura danificada",
      "Outro",
    ],
    direita: [
      "Lateral amassada",
      "Retrovisor danificado",
      "Pneu careca/danificado",
      "Vidro trincado/quebrado",
      "Pintura danificada",
      "Outro",
    ],
    esquerda: [
      "Lateral amassada",
      "Retrovisor danificado",
      "Pneu careca/danificado",
      "Vidro trincado/quebrado",
      "Pintura danificada",
      "Outro",
    ],
    traseira: [
      "Luz de freio queimada",
      "Para-choque danificado",
      "Traseira com avaria",
      "Vidro trincado/quebrado",
      "Placa danificada",
      "Pintura danificada",
      "Outro",
    ],
  },
};
