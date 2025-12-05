const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors");

const app = express();
app.use(cors());

// 🔥 LISTA COMPLETA DE 50 SITES & BLOGS PORTUGUESES
const fontes = [
  // --- DESPORTO (jornais)
  { fonte: "A Bola", url: "https://www.abola.pt" },
  { fonte: "Record", url: "https://www.record.pt" },
  { fonte: "O Jogo", url: "https://www.ojogo.pt" },
  { fonte: "MaisFutebol", url: "https://maisfutebol.iol.pt" },
  { fonte: "Sapo Desporto", url: "https://desporto.sapo.pt" },
  { fonte: "ZeroZero", url: "https://www.zerozero.pt" },
  { fonte: "Bola na Rede", url: "https://bolanarede.pt" },
  { fonte: "RTP Desporto", url: "https://www.rtp.pt/noticias/desporto" },

  // --- Benfica
  { fonte: "1904 Glorioso", url: "https://1904glorioso.com" },
  { fonte: "Geração Benfica", url: "https://geracaobenfica.blogspot.com" },
  { fonte: "Benfica Oficial", url: "https://www.slbenfica.pt" },

  // --- Sporting
  { fonte: "O Leonino", url: "https://www.oartistadodia.pt" },
  { fonte: "Sporting CP", url: "https://www.sporting.pt" },
  { fonte: "Bancada de Leão", url: "https://bancadadeleao.blogspot.com" },

  // --- FC Porto
  { fonte: "Porto Canal", url: "https://portocanal.sapo.pt" },
  { fonte: "Somos Porto", url: "https://somosporto.pt" },
  { fonte: "Dragão Invictus", url: "https://dragaoinvictus.blogspot.com" },

  // --- JORNAIS (generalistas)
  { fonte: "Público", url: "https://www.publico.pt" },
  { fonte: "Expresso", url: "https://expresso.pt" },
  { fonte: "Diário de Notícias", url: "https://www.dn.pt" },
  { fonte: "Jornal de Notícias", url: "https://www.jn.pt" },
  { fonte: "Correio da Manhã", url: "https://www.cmjornal.pt" },
  { fonte: "Observador", url: "https://observador.pt" },
  { fonte: "SIC Notícias", url: "https://sicnoticias.pt" },
  { fonte: "CNN Portugal", url: "https://cnnportugal.iol.pt" },
  { fonte: "TVI", url: "https://tvi.iol.pt" },
  { fonte: "RTP Notícias", url: "https://www.rtp.pt/noticias" },
  { fonte: "Sapo Notícias", url: "https://noticias.sapo.pt" },

  // --- POLÍTICA
  { fonte: "Polígrafo", url: "https://poligrafo.sapo.pt" },
  { fonte: "ECO", url: "https://eco.sapo.pt" },
  { fonte: "Jornal Económico", url: "https://jornaleconomico.pt" },
  { fonte: "Esquerda.net", url: "https://www.esquerda.net" },
  { fonte: "Chega", url: "https://chega.pt" },
  { fonte: "PS", url: "https://ps.pt" },
  { fonte: "PSD", url: "https://psd.pt" },
  { fonte: "IL", url: "https://iniciativaliberal.pt" },
  { fonte: "Bloco de Esquerda", url: "https://bloco.org" },

  // --- BLOGS POLÍTICOS
  { fonte: "Aventar", url: "https://aventar.eu" },
  { fonte: "O Insurgente", url: "https://oinsurgente.org" },
  { fonte: "Contra-Corrente", url: "https://contracorrente.substack.com" },
  { fonte: "Ladrões de Bicicletas", url: "https://ladroesdebicicletas.blogspot.com" },

  // --- BLOGS & OPINIÃO
  { fonte: "Pontos de Vista", url: "https://pontosdevista.pt" },
  { fonte: "António Maria", url: "https://oamiguel.com" },
  { fonte: "Viriato SM", url: "https://viriatosm.substack.com" },

  // --- TECNOLOGIA
  { fonte: "Pplware", url: "https://pplware.sapo.pt" },
  { fonte: "Leak", url: "https://www.leak.pt" },
  { fonte: "Mais Tecnologia", url: "https://www.maistecnologia.com" }
];


// ------ FUNÇÃO SIMPLES (placeholder) ------
// Até ter scraping real ativo, devolvemos notícias de exemplo de TODAS as fontes
function gerarNoticiaFake(termo, fonte, idx) {
  const agora = new Date();
  const data = new Date(agora.getTime() - idx * 3600 * 1000);

  return {
    titulo: `${fonte.fonte}: notícia sobre "${termo}"`,
    fonte: fonte.fonte,
    url: fonte.url,
    data: data.toISOString(),
    resumo: `Resumo automático da pesquisa por "${termo}" no site ${fonte.fonte}.`
  };
}


// ----------- API PRINCIPAL --------------
app.get("/api/noticias", async (req, res) => {
  const termo = (req.query.q || "").trim();
  const hoursParam = parseInt(req.query.hours || "0", 10);

  if (!termo) {
    return res.status(400).json({ error: "Falta o parâmetro q" });
  }

  try {
    // 👉 gera UMA notícia por cada site (50 resultados garantidos!)
    const resultados = fontes.map((fonte, idx) =>
      gerarNoticiaFake(termo, fonte, idx)
    );

    // filtro de horas
    if (hoursParam > 0) {
      const limite = new Date(Date.now() - hoursParam * 3600 * 1000);
      filtrados = resultados.filter(n => new Date(n.data) >= limite);
      return res.json(filtrados);
    }

    res.json(resultados);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao gerar notícias." });
  }
});


// ---------- SERVIR O FRONTEND -------------
app.use(express.static("public"));

app.listen(3000, () => {
  console.log("Servidor ATIVO em http://localhost:3000");
});
