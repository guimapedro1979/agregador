// servidor.js
// Backend simples para servir o agregador de notícias no Render

const express = require("express");
const cors = require("cors");
const path = require("path");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();
app.use(cors());
app.use(express.json());

// 👉 servir ficheiros estáticos da pasta /public
app.use(express.static(path.join(__dirname, "public")));

// ------------------------
// Rota de teste (opcional)
// ------------------------
app.get("/health", (req, res) => {
  res.send("OK");
});

// ------------------------
// EXEMPLO de rota de busca
// (aqui podes depois ligar o scraping verdadeiro)
// ------------------------
app.get("/api/noticias", async (req, res) => {
  const termo = (req.query.q || "").trim();
  if (!termo) {
    return res.status(400).json({ error: "Falta o parâmetro q" });
  }

  // Por enquanto devolvemos só um exemplo estático
  // (para confirmar que tudo funciona no Render)
  // Depois podemos trocar isto pelo scraping completo.
  const agora = new Date().toISOString();
  return res.json([
    {
      titulo: `Exemplo de notícia sobre "${termo}"`,
      fonte: "Exemplo",
      url: "https://www.abola.pt",
      data: agora
    }
  ]);
});

// ------------------------
// Fallback: qualquer rota → index.html
// (para que o frontend funcione mesmo com refresh)
// ------------------------
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ------------------------
// Arrancar servidor
// ------------------------
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor a correr na porta ${PORT}`);
});
