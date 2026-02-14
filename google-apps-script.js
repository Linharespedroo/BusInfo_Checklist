// =============================================================
// Google Apps Script - Proxy para Google Drive
// =============================================================
// COMO USAR:
//
// 1. Acesse: https://script.google.com
// 2. Clique em "Novo projeto"
// 3. Apague o conteudo e cole ESTE codigo inteiro
// 4. Clique em "Implantar" > "Nova implantacao"
// 5. Tipo: "App da Web"
// 6. Executar como: "Eu" (sua conta)
// 7. Quem tem acesso: "Qualquer pessoa"
// 8. Clique em "Implantar"
// 9. Autorize o acesso quando solicitado
// 10. Copie a URL gerada (comeca com https://script.google.com/macros/s/...)
// 11. Cole a URL no arquivo js/config.js no campo APPS_SCRIPT_URL
//
// Exemplo:
//   APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbx.../exec",
// =============================================================

function doGet(e) {
  var fileId = e.parameter.id;

  if (!fileId) {
    return ContentService.createTextOutput(
      JSON.stringify({ error: "Parametro 'id' obrigatorio" })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    var file = DriveApp.getFileById(fileId);
    var content = file.getBlob().getDataAsString();
    return ContentService.createTextOutput(content).setMimeType(
      ContentService.MimeType.JSON
    );
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ error: err.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
