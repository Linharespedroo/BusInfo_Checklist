class DataParser {
  // Extract rows from Drive JSON format
  // Drive structure: { statusCode, headers, body: { results: [{ tables: [{ rows: [...] }] }] } }
  static extractDriveRows(data) {
    try {
      if (
        data &&
        data.body &&
        data.body.results &&
        data.body.results[0] &&
        data.body.results[0].tables &&
        data.body.results[0].tables[0] &&
        data.body.results[0].tables[0].rows
      ) {
        return data.body.results[0].tables[0].rows;
      }
    } catch (e) {
      console.warn("Formato Drive nao reconhecido:", e);
    }
    return null;
  }

  static parseVeiculos(data) {
    // Try Drive format first
    const rows = DataParser.extractDriveRows(data);
    if (rows) {
      return rows.map((row) => ({
        prefixo: (row["[Prefixo]"] || "").trim(),
        placa: (row["[Placa]"] || "").trim(),
        empresa: (row["[Empresa]"] || "").trim(),
        modelo: (row["[Modelo]"] || "").trim(),
        placaFormatada: (row["[Placa]"] || "").trim().toUpperCase(),
      }));
    }

    // Local format (array of objects)
    if (Array.isArray(data)) {
      return data.map((v) => ({
        prefixo: v.prefixo || "",
        placa: v.placa || "",
        empresa: v.empresa || "",
        modelo: v.modelo || "",
        placaFormatada: (v.placa || "").toUpperCase(),
      }));
    }

    return [];
  }

  static parseMotoristas(data) {
    // Try Drive format (quadro) first
    const rows = DataParser.extractDriveRows(data);
    if (rows) {
      const motoristas = rows.map((row) => ({
        cpf: (row["[CPF]"] || "").trim(),
        nome: (row["[Nome]"] || "").trim(),
        matricula: (row["[Matricula]"] || "").trim(),
        empresa: (row["[Empresa]"] || "").trim(),
        setor: (row["[Setor]"] || "").trim(),
        descricao: (row["[Descrição]"] || "").trim(),
        lider: (row["[Lider]"] || "").trim(),
      }));

      return {
        cpfs: motoristas.map((m) => m.cpf),
        motoristas: motoristas,
      };
    }

    // Local format (array of CPF strings)
    if (Array.isArray(data)) {
      return {
        cpfs: data,
        motoristas: data.map((cpf) => ({
          cpf,
          nome: "Motorista " + cpf.slice(-4),
          matricula: "",
          empresa: "",
          setor: "",
          descricao: "",
          lider: "",
        })),
      };
    }

    return { cpfs: [], motoristas: [] };
  }

  static parseIrregularidades(data) {
    return data;
  }
}

window.DataParser = DataParser;
