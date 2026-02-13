class DataParser {
  static parseVeiculos(data) {
    // Agora é array direto!
    return data.map((v) => ({
      ...v,
      placaFormatada: v.placa.toUpperCase(),
    }));
  }

  static parseMotoristas(data) {
    // Agora é array direto de CPFs
    return {
      cpfs: data,
      motoristas: data.map((cpf) => ({
        cpf,
        nome: `Motorista ${cpf.slice(-4)}`,
      })),
    };
  }

  static parseIrregularidades(data) {
    return data; // Array direto
  }
}

window.DataParser = DataParser;
