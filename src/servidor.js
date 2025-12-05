const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// User-Agent para evitar bloqueios básicos
const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/119.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

// ==================================================
//  FONTES: RSS quando existe, scraping HTML quando não
// ==================================================
const fontes = [
  // --- DESPORTO (jornais)
  { fonte: "A Bola", url: "https://www.abola.pt" }, // scraping
  { fonte: "Record", url: "https://www.record.pt" }, // scraping
  { fonte: "O Jogo", url: "https://www.ojogo.pt" }, // scraping
  { fonte: "MaisFutebol", url: "https://maisfutebol.iol.pt" }, // scraping
  { fonte: "Sapo Desporto", url: "https://desporto.sapo.pt" }, // scraping
  {
    fonte: "ZeroZero",
    url: "https://www.zerozero.pt",
    rss: "https://www.zerozero.pt/rss/noticias.php",
  },
  {
    fonte: "Bola na Rede",
    url: "https://bolanarede.pt",
    rss: "https://bolanarede.pt/feed",
  },

  // --- Benfica
  { fonte: "1904 Glorioso", url: "https://1904glorioso.com" }, // scraping
  {
    fonte: "Geração Benfica",
    url: "https://geracaobenfica.blogspot.com",
    rss: "https://geracaobenfica.blogspot.com/feeds/posts/default",
  },
  { fonte: "Benfica Oficial", url: "https://www.slbenfica.pt" }, // scraping

  // --- Sporting
  { fonte: "O Leonino", url: "https://www.oartistadodia.pt" }, // scraping genérico
  { fonte: "Sporting CP", url: "https://www.sporting.pt" }, // scraping
  {
    fonte: "Bancada de Leão",
    url: "https://bancadadeleao.blogspot.com",
    rss: "https://bancadadeleao.blogspot.com/feeds/posts/default",
  },

  // --- FC Porto
  { fonte: "Porto Canal", url: "https://portocanal.sapo.pt" }, // scraping
  { fonte: "Somos Porto", url: "https://somosporto.pt" }, // scraping
  {
    fonte: "Dragão Invictus",
    url: "https://dragaoinvictus.blogspot.com",
    rss: "https://dragaoinvictus.blogspot.com/feeds/posts/default",
  },

  // --- JORNAIS GENERALISTAS
  { fonte: "Público", url: "https://www.publico.pt" }, // scraping
  { fonte: "Expresso", url: "https://expresso.pt" }, // scraping
  { fonte: "Diário de Notícias", url: "https://www.dn.pt" }, // scraping
  { fonte: "Jornal de Notícias", url: "https://www.jn.pt" }, // scraping
  { fonte: "Correio da Manhã", url: "https://www.cmjornal.pt" }, // scraping
  {
    fonte: "Observador",
    url: "https://observador.pt",
    rss: "https://observador.pt/feed",
  },
  {
    fonte: "SIC Notícias",
    url: "https://sicnoticias.pt",
    rss: "https://sicnoticias.pt/rss",
  },
  {
    fonte: "CNN Portugal",
    url: "https://cnnportugal.iol.pt",
    rss: "https://cnnportugal.iol.pt/rss.xml",
  },
  {
    fonte: "RTP Notícias",
    url: "https://www.rtp.pt/noticias",
    rss: "https://www.rtp.pt/noticias/rss",
  },
  {
    fonte: "ECO",
    url: "https://eco.sapo.pt",
    rss: "https://eco.sapo.pt/feed",
  },
  {
    fonte: "Jornal Económico",
    url: "https://jornaleconomico.pt",
    rss: "https://jornaleconomico.pt/feed",
  },
  {
    fonte: "Esquerda.net",
    url: "https://www.esquerda.net",
    rss: "https://www.esquerda.net/rss.xml",
  },

  // --- BLOGS POLÍTICOS
  {
    fonte: "Aventar",
    url: "https://aventar.eu",
    rss: "https://aventar.eu/feed",
  },
  {
    fonte: "O Insurgente",
    url: "https://oinsurgente.org",
    rss: "https://oinsurgente.org/feed",
  },
  {
    fonte: "Ladrões de Bicicletas",
    url: "https://ladroesdebicicletas.blogspot.com",
    rss: "https://ladroesdebicicletas.blogspot.com/feeds/posts/default",
  },
  {
    fonte: "Contra-Corrente",
    url: "https://contracorrente.substack.com",
    rss: "https://contracorrente.substack.com/feed",
  },

  // --- BLOGS / OPINIÃO
  {
    fonte: "Pontos de Vista",
    url: "https://pontosdevista.pt",
    rss: "https://pontosdevista.pt/feed",
  },
  {
    fonte: "António Maria",
    url: "https://oamiguel.com",
    rss: "https://oamiguel.com/feed",
  },
  {
    fonte: "Viriato Soromenho Marques",
    url: "https://viriatosm.substack.com",
    rss: "https://viriatosm.substack.com/feed",
  },

  // --- TECNOLOGIA
  {
    fonte: "Pplware",
    url: "https://pplware.sapo.pt",
    rss: "https://pplware.sapo.pt/feed",
  },
  {
    fonte: "Leak",
    url: "https://www.leak.pt",
    rss: "https://www.leak.pt/feed",
  },
  {
    fonte: "Mais Tecnologia",
    url: "https://www.maistecnologia.com",
    rss: "https://www.maistecnologia.com/feed",
  },
];

// ==================================================
//  LEITURA POR RSS (quando existir)
// ==================================================
async function buscarNoticiasRSS(fonte, termo) {
  if (!fonte.rss) return [];
  try {
    const resp = await axios.get(fonte.rss, {
      timeout: 8000,
      headers: DEFAULT_HEADERS,
    });
    const $ = cheerio.load(resp.data, { xmlMode: true });

    const termoLower = termo.toLowerCase();
    const noticias = [];

    $("item").each((_, el) => {
      const titulo = $(el).find("title").first().text().trim();
      let descricao = $(el).find("description").first().text().trim();
      const link = $(el).find("link").first().text().trim();
      const pubDate = $(el).find("pubDate").first().text().trim();

      if (!titulo && !descricao) return;

      // fallback: se não houver descrição, usamos o título como resumo
      if (!descricao) descricao = titulo;

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
        resumo: descricao,
      });
    });

    return noticias;
  } catch (err) {
    console.error("Erro ao ler RSS de", fonte.fonte, "-", err.message);
    return [];
  }
}

// ==================================================
//  SCRAPING HTML (quando não há RSS ou falha)
// ==================================================
async function buscarNoticiasHTML(fonte, termo) {
  if (!fonte.url) return [];
  try {
    const resp = await axios.get(fonte.url, {
      timeout: 8000,
      headers: DEFAULT_HEADERS,
    });
    const $ = cheerio.load(resp.data);

    const termoLower = termo.toLowerCase();
    const noticias = [];
    const usados = new Set();

    $("a").each((_, el) => {
      if (noticias.length >= 5) return; // máximo 5 por site

      const texto = $(el).text().trim();
      if (!texto) return;

      const textoLower = texto.toLowerCase();
      if (!textoLower.includes(termoLower)) return;

      let href = $(el).attr("href") || "";
      if (!href) return;

      try {
        href = new URL(href, fonte.url).toString();
      } catch {
        return;
      }

      const key = texto + "||" + href;
      if (usados.has(key)) return;
      usados.add(key);

      let resumo = "";
      const article = $(el).closest("article");
      if (article.length) {
        resumo = article.find("p").first().text().trim();
      }
      if (!resumo) {
        const pNext = $(el).parent().find("p").first().text().trim();
        if (pNext) resumo = pNext;
      }
      if (!resumo) resumo = texto; // fallback final = título

      const dataIso = new Date().toISOString();

      noticias.push({
        titulo: texto,
        fonte: fonte.fonte,
        url: href,
        data: dataIso,
        resumo,
      });
    });

    return noticias;
  } catch (err) {
    console.error("Erro ao fazer scraping de", fonte.fonte, "-", err.message);
    return [];
  }
}

// ==================================================
//  ROTA PRINCIPAL /api/noticias
// ==================================================
app.get("/api/noticias", async (req, res) => {
  const termo = (req.query.q || "").trim();
  const hoursParam = parseInt(req.query.hours || "0", 10);

  if (!termo) {
    return res.status(400).json({ error: "Falta o parâmetro q" });
  }

  try {
    const porFonte = await Promise.all(
      fontes.map(async (f) => {
        // 1º tenta RSS se existir
        const rssNoticias = await buscarNoticiasRSS(f, termo);
        if (rssNoticias.length) return rssNoticias;

        // 2º fallback: scraping HTML
        const htmlNoticias = await buscarNoticiasHTML(f, termo);
        return htmlNoticias;
      })
    );

    let todos = porFonte.flat();

    // filtro de horas (0 = sem filtro)
    if (hoursParam > 0) {
      const limite = new Date(Date.now() - hoursParam * 3600 * 1000);
      todos = todos.filter((n) => new Date(n.data) >= limite);
    }

    // ordenar por data (mais recente 1º)
    todos.sort((a, b) => new Date(b.data) - new Date(a.data));

    // se não houver nada, devolve pelo menos exemplos básicos
    if (!todos.length) {
      const agora = new Date();
      todos = fontes.map((fonte, idx) => {
        const data = new Date(agora.getTime() - idx * 3600 * 1000);
        return {
          titulo: `${fonte.fonte}: notícia sobre "${termo}"`,
          fonte: fonte.fonte,
          url: fonte.url || "",
          data: data.toISOString(),
          resumo: `Resumo automático da pesquisa por "${termo}" no site ${fonte.fonte}.`,
        };
      });
    }

    res.json(todos);
  } catch (err) {
    console.error("Erro geral /api/noticias:", err);
    res.status(500).json({ error: "Erro ao buscar notícias." });
  }
});

// ==================================================
//  SERVIR FRONTEND (pasta public)
//  ⚠ Se a tua pasta se chamar "público", troca "../public" por "../público"
// ==================================================
app.use(express.static(path.join(__dirname, "../public")));

app.listen(PORT, () => {
  console.log(`Servidor a correr na porta ${PORT}`);
});
