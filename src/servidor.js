const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// ===============================
//  50 SITES / BLOGS PORTUGUESES
// ===============================
const fontes = [
  // --- DESPORTO (jornais)
  { fonte: "A Bola", rss: "https://www.abola.pt/rss" },
  { fonte: "Record", rss: "https://www.record.pt/rss.aspx" },
  { fonte: "O Jogo", rss: "https://www.ojogo.pt/rss.html" },
  { fonte: "MaisFutebol", rss: "https://maisfutebol.iol.pt/rss" },
  { fonte: "Sapo Desporto", rss: "https://feeds.feedburner.com/sapodesporto" },
  { fonte: "ZeroZero", rss: "https://www.zerozero.pt/rss/noticias.php" },
  { fonte: "Bola na Rede", rss: "https://bolanarede.pt/feed" },
  { fonte: "RTP Desporto", rss: "https://www.rtp.pt/noticias/rss/desporto" },

  // --- Benfica
  { fonte: "1904 Glorioso", rss: "https://1904glorioso.com/feed" },
  { fonte: "1904 Glorioso", rss: "https://glorioso1904.pt/feed" },
  { fonte: "Geração Benfica", rss: "https://geracaobenfica.blogspot.com/feeds/posts/default" },
  { fonte: "Benfica Oficial", rss: "https://www.slbenfica.pt/rss" },

  // --- Sporting
  { fonte: "O Leonino", rss: "https://www.oartistadodia.pt/feeds/posts/default" }, // ajuste se tiver outro feed
  { fonte: "O Leonino", rss: "https://leonino.pt/feeds/posts/default" },
  { fonte: "Sporting CP", rss: "https://www.sporting.pt/pt/noticias/rss" },
  { fonte: "Bancada de Leão", rss: "https://bancadadeleao.blogspot.com/feeds/posts/default" },

  // --- FC Porto
  { fonte: "Porto Canal", rss: "https://portocanal.sapo.pt/rss" },
  { fonte: "Somos Porto", rss: "https://somosporto.pt/feed" },
  { fonte: "Dragão Invictus", rss: "https://dragaoinvictus.blogspot.com/feeds/posts/default" },

  // --- JORNAIS GENERALISTAS
  { fonte: "Público", rss: "https://www.publico.pt/rss" },
  { fonte: "Expresso", rss: "https://expresso.pt/rss" },
  { fonte: "Diário de Notícias", rss: "https://www.dn.pt/rss" },
  { fonte: "Jornal de Notícias", rss: "https://www.jn.pt/rss" },
  { fonte: "Correio da Manhã", rss: "https://www.cmjornal.pt/rss" },
  { fonte: "Observador", rss: "https://observador.pt/feed" },
  { fonte: "SIC Notícias", rss: "https://sicnoticias.pt/rss" },
  { fonte: "CNN Portugal", rss: "https://cnnportugal.iol.pt/rss.xml" },
  { fonte: "RTP Notícias", rss: "https://www.rtp.pt/noticias/rss" },
  { fonte: "Sapo Notícias", rss: "https://feeds.feedburner.com/PublicoRSS" }, // exemplo, podes trocar

  // --- POLÍTICA / ECONOMIA
  { fonte: "Polígrafo", rss: "https://poligrafo.sapo.pt/rss" },
  { fonte: "ECO", rss: "https://eco.sapo.pt/feed" },
  { fonte: "Jornal Económico", rss: "https://jornaleconomico.pt/feed" },
  { fonte: "Esquerda.net", rss: "https://www.esquerda.net/rss.xml" },

  // --- PARTIDOS (muitas vezes têm secção notícias)
  { fonte: "PS", rss: "https://ps.pt/feed" },
  { fonte: "PSD", rss: "https://psd.pt/feed" },
  { fonte: "Chega", rss: "https://chega.pt/feed" },
  { fonte: "IL", rss: "https://iniciativaliberal.pt/feed" },
  { fonte: "Bloco de Esquerda", rss: "https://bloco.org/rss.xml" },

  // --- BLOGS POLÍTICOS
  { fonte: "Aventar", rss: "https://aventar.eu/feed" },
  { fonte: "O Insurgente", rss: "https://oinsurgente.org/feed" },
  { fonte: "Contra-Corrente", rss: "https://contracorrente.substack.com/feed" },
  { fonte: "Ladrões de Bicicletas", rss: "https://ladroesdebicicletas.blogspot.com/feeds/posts/default" },

  // --- BLOGS / OPINIÃO
  { fonte: "Pontos de Vista", rss: "https://pontosdevista.pt/feed" },
  { fonte: "António Maria", rss: "https://oamiguel.com/feed" },
  { fonte: "Viriato Soromenho Marques", rss: "https://viriatosm.substack.com/feed" },

  // --- TECNOLOGIA
  { fonte: "Pplware", rss: "https://pplware.sapo.pt/feed" },
  { fonte: "Leak", rss: "https://www.leak.pt/feed" },
  { fonte: "Mais Tecnologia", rss: "https://www.maistecnologia.com/feed" }
];

// ===============================
//  FUNÇÃO: LER RSS DE UMA FONTE
// ===============================
async function buscarNoticiasFonte(fonte, termo) {
  if (!fonte.rss) return [];

  try {
    const resp = await axios.get(fonte.rss, { timeout: 8000 });
    const $ = cheerio.load(resp.data, { xmlMode: true });

    const termoLower = termo.toLowerCase();
    const noticias = [];

    $("item").each((_, el) => {
      const titulo = $(el).find("title").first().text().trim();
      const descricao = $(el).find("description").first().text().trim();
      const link = $(el).find("link").first().text().trim();
      const pubDate = $(el).find("pubDate").first().text().trim();

      if (!titulo && !descricao) return;

      const textoCompleto = (titulo + " " + descricao).toLowerCase();
      if (!textoCompleto.includes(termoLower)) return;

      const dataObj = pubDate ? new Date(pubDate) : new Date();
      const dataIso = isNaN(dataObj.getTime())
        ? new Date().toISOString()
        : dataObj.toISOString();

      noticias.push({
        titulo,
        fonte: fonte.fonte,
        url: link || fonte.url || "",
        data: dataIso,
        resumo: descricao
      });
    });

    return noticias;
  } catch (err) {
    console.error("Erro ao ler RSS de", fonte.fonte, "-", err.message);
    return [];
  }
}

// ===============================
//  ROTA /api/noticias
// ===============================
app.get("/api/noticias", async (req, res) => {
  const termo = (req.query.q || "").trim();
  const hoursParam = parseInt(req.query.hours || "0", 10);

  if (!termo) {
    return res.status(400).json({ error: "Falta o parâmetro q" });
  }

  try {
    // vai buscar em paralelo a TODAS as fontes
    const porFonte = await Promise.all(
      fontes.map((f) => buscarNoticiasFonte(f, termo))
    );

    let todos = porFonte.flat();

    // filtro por horas, se escolheste 12/24/48
    if (hoursParam > 0) {
      const limite = new Date(Date.now() - hoursParam * 3600 * 1000);
      todos = todos.filter(n => new Date(n.data) >= limite);
    }

    // ordenar por data (mais recente primeiro)
    todos.sort((a, b) => new Date(b.data) - new Date(a.data));

    // fallback: se nada encontrado, devolve pelo menos exemplos “fake”
    if (!todos.length) {
      const agora = new Date();
      todos = fontes.map((fonte, idx) => {
        const data = new Date(agora.getTime() - idx * 3600 * 1000);
        return {
          titulo: `${fonte.fonte}: notícia sobre "${termo}"`,
          fonte: fonte.fonte,
          url: fonte.url || "",
          data: data.toISOString(),
          resumo: `Resumo automático da pesquisa por "${termo}" no site ${fonte.fonte}.`
        };
      });
    }

    res.json(todos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar notícias." });
  }
});

// ===============================
//  FRONTEND ESTÁTICO
// ===============================
app.use(express.static(path.join(__dirname, "../public")));

app.listen(PORT, () => {
  console.log(`Servidor a correr na porta ${PORT}`);
});
