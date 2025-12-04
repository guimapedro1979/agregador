// === server.js ===
// Servidor backend para fazer scraping SEM API
// Procura em dezenas de sites portugueses (desporto, política, boatos, etc.)
// e tenta obter título + data + pequeno resumo.
// Também serve o ficheiro index.html da pasta /public.

const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());

// Servir os ficheiros estáticos (index.html) na pasta /public
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

// ===============================
// LISTA DE SITES / BLOGS PORTUGUESES
// ===============================
const SITES = [
  // --- DESPORTO ---
  { nome: "A BOLA", url: "https://www.abola.pt" },
  { nome: "Record", url: "https://www.record.pt" },
  { nome: "O Jogo", url: "https://www.ojogo.pt" },
  { nome: "Maisfutebol", url: "https://maisfutebol.iol.pt" },
  { nome: "zerozero", url: "https://www.zerozero.pt" },
  { nome: "Bola na Rede", url: "https://bolanarede.pt" },
  { nome: "GoalPoint", url: "https://goalpoint.pt" },
  { nome: "Bancada", url: "https://bancada.pt" },
  { nome: "Fair Play", url: "https://fairplay.pt" },
  { nome: "Visão de Mercado", url: "https://blogvisaodemercado.pt" },
  { nome: "ProScout", url: "https://www.proscout.pt" },
  { nome: "PortuGOAL", url: "https://www.portugoal.net" },
  { nome: "Sportinforma / SAPO", url: "https://sportinforma.sapo.pt" },

  // --- BLOGS / ADEPTOS ---
  { nome: "Camarote Leonino", url: "https://camaroteleonino.blogs.sapo.pt" },
  { nome: "Mister do Café", url: "https://misterdocafe.blogspot.com" },
  { nome: "O Fura-Redes", url: "https://ofuraredes.blogspot.com" },
  { nome: "Fora-de-Jogo", url: "https://foradejogo08.blogspot.com" },
  { nome: "O Blog do David", url: "https://davidjosepereira.blogspot.com" },
  { nome: "Em Jogo", url: "https://emjogo.blogs.sapo.pt" },
  { nome: "Benfica Independente", url: "https://www.benficaindependente.com" },
  { nome: "Glorioso 1904", url: "https://glorioso1904.pt" },
  { nome: "Leonino", url: "https://leonino.pt" },
  { nome: "Fórum SCP", url: "https://www.forumscp.com" },

  // --- CLUBES OFICIAIS ---
  { nome: "SL Benfica", url: "https://www.slbenfica.pt" },
  { nome: "FC Porto", url: "https://www.fcporto.pt" },
  { nome: "Sporting CP", url: "https://www.sporting.pt" },
  { nome: "SC Braga", url: "https://scbraga.pt" },

  // --- NOTÍCIAS GERAIS / POLÍTICA ---
  { nome: "Correio da Manhã", url: "https://www.cmjornal.pt" },
  { nome: "CNN Portugal", url: "https://cnnportugal.iol.pt" },
  { nome: "RTP Notícias", url: "https://www.rtp.pt/noticias" },
  { nome: "SIC Notícias", url: "https://sicnoticias.pt" },
  { nome: "TVI", url: "https://tvi.iol.pt" },
  { nome: "Público", url: "https://www.publico.pt" },
  { nome: "Jornal de Notícias", url: "https://www.jn.pt" },
  { nome: "Diário de Notícias", url: "https://www.dn.pt" },
  { nome: "Expresso", url: "https://expresso.pt" },
  { nome: "Observador", url: "https://observador.pt" },
  { nome: "Sol", url: "https://sol.sapo.pt" },
  { nome: "Jornal Económico", url: "https://jornaleconomico.pt" },
  { nome: "Eco", url: "https://eco.sapo.pt" },
  { nome: "Sábado", url: "https://www.sabado.pt" },
  { nome: "Visão", url: "https://visao.pt" },
  { nome: "Notícias ao Minuto", url: "https://www.noticiasaominuto.com" },
  { nome: "Ionline", url: "https://ionline.sapo.pt" },

  // --- RÁDIOS ---
  { nome: "TSF", url: "https://www.tsf.pt" },
  { nome: "Renascença", url: "https://rr.pt" },
  { nome: "RTP / Antena 1", url: "https://www.rtp.pt" },

  // --- BOATOS / FAMOSOS ---
  { nome: "Flash", url: "https://flash.pt" },
  { nome: "Nova Gente", url: "https://nova.gente.sapo.pt" },
  { nome: "VIP", url: "https://www.vip.pt" },
  { nome: "Vidas", url: "https://www.vidas.pt" },

  // --- REGIONAIS ---
  { nome: "O Minho", url: "https://ominho.pt" },
  { nome: "Açoriano Oriental", url: "https://www.acorianooriental.pt" },
  { nome: "DN Madeira", url: "https://www.dnoticias.pt" }
];

// ============= FUNÇÕES AUXILIARES =============

function dentroDasHoras(dateStr, hours) {
  if (!dateStr) return false;
  const dt = new Date(dateStr);
  if (isNaN(dt.getTime())) return false;

  const diffMs = Date.now() - dt.getTime();
  const diffHoras = diffMs / (1000 * 60 * 60);
  return diffHoras <= hours;
}

// tenta extrair data + pequeno resumo da página do artigo
function extrairDataESnippet(html) {
  const $ = cheerio.load(html);

  // data em metatags / time
  const candidatos = [
    'meta[property="article:published_time"]',
    'meta[name="article:published_time"]',
    'meta[name="pubdate"]',
    'meta[property="og:updated_time"]',
    'meta[name="date"]',
    'meta[name="dc.date"]',
    "time[datetime]"
  ];

  let dateStr = null;
  for (const sel of candidatos) {
    const el = $(sel).first();
    if (!el.length) continue;
    const c = el.attr("content") || el.attr("datetime");
    if (c) {
      dateStr = c;
      break;
    }
  }

  // pequeno resumo: primeiro <p> com texto decente
  let snippet = "";
  $("p").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text.length > 40 && !snippet) {
      snippet = text;
    }
  });
  if (snippet.length > 260) snippet = snippet.slice(0, 260) + "...";

  return { dateStr, snippet };
}

// --- scraping de um site específico ---
async function scrapSite(site, termo, hoursFilter) {
  try {
    const res = await axios.get(site.url, {
      timeout: 15000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
      }
    });

    const html = res.data;
    const $ = cheerio.load(html);
    const termoLC = termo.toLowerCase();

    const resultados = [];
    $("a").each((i, el) => {
      let texto = $(el).text().replace(/\s+/g, " ").trim();
      let href = $(el).attr("href");

      if (!texto || !href) return;
      if (texto.length < 4) return;
      if (!texto.toLowerCase().includes(termoLC)) return;

      try {
        href = new URL(href, site.url).href;
      } catch (e) {
        return;
      }

      resultados.push({
        site: site.nome,
        titulo: texto,
        link: href
      });
    });

    // remover duplicados
    const vistos = new Set();
    const unicos = [];
    for (const r of resultados) {
      if (!vistos.has(r.link)) {
        vistos.add(r.link);
        unicos.push(r);
      }
    }

    // limitar número por site (para não rebentar)
    const limitados = unicos.slice(0, 10);

    // ir a cada artigo buscar data + snippet
    const enriquecidos = await Promise.all(
      limitados.map(async (item) => {
        try {
          const art = await axios.get(item.link, {
            timeout: 12000,
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
            }
          });
          const { dateStr, snippet } = extrairDataESnippet(art.data);
          return { ...item, data: dateStr || null, resumo: snippet || "" };
        } catch (e) {
          return { ...item, data: null, resumo: "" };
        }
      })
    );

    // aplicar filtro de tempo, se existir (12 / 24 / 48)
    let filtrados = enriquecidos;
    if (hoursFilter > 0) {
      filtrados = enriquecidos.filter((r) => r.data && dentroDasHoras(r.data, hoursFilter));
    }

    return filtrados;
  } catch (err) {
    console.error(`Erro em ${site.nome} (${site.url}): ${err.message}`);
    return [];
  }
}

// ============= ENDPOINTS =============

// GET /search?q=termo&hours=12|24|48|0
app.get("/search", async (req, res) => {
  const termo = (req.query.q || "").trim();
  const hours = parseInt(req.query.hours || "0", 10) || 0;

  if (!termo) return res.json([]);

  try {
    const promessas = SITES.map((s) => scrapSite(s, termo, hours));
    const listas = await Promise.all(promessas);
    let todos = listas.flat();

    // ordenar: primeiro por data desc, depois por site
    todos.sort((a, b) => {
      if (a.data && b.data) {
        return new Date(b.data) - new Date(a.data);
      }
      if (a.data) return -1;
      if (b.data) return 1;
      return a.site.localeCompare(b.site);
    });

    res.json(todos);
  } catch (err) {
    console.error("Erro geral:", err.message);
    res.status(500).json({ erro: "Erro interno no servidor" });
  }
});

// Rota raiz devolve o index.html da pasta public (já tratado pelo express.static)

app.listen(PORT, () => {
  console.log(`✅ Servidor a correr na porta ${PORT}`);
  console.log(`   A monitorizar ${SITES.length} sites/blogs.`);
});
