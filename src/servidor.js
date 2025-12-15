const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
};

/* ================== ALIASES ================== */
const ALIASES = {
  av: ["andré ventura", "ventura"],
  pr: ["marcelo rebelo de sousa", "marcelo", "presidente da república"],
  pm: ["primeiro-ministro", "primeiro ministro"],
  lmm: ["luís montenegro", "montenegro"],
  slb: ["benfica", "sport lisboa e benfica"],
  scp: ["sporting", "sporting cp", "sporting clube de portugal"],
  fcp: ["fc porto", "porto", "futebol clube do porto"],
};

function expandQuery(q) {
  const base = q.toLowerCase().trim();
  const extra = ALIASES[base] || [];
  return [...new Set([base, ...extra])];
}

/* ================== FONTES ================== */
const fontes = [
  { fonte: "RTP Notícias", rss: "https://www.rtp.pt/noticias/rss" },
  { fonte: "SIC Notícias", rss: "https://sicnoticias.pt/rss" },
  { fonte: "CNN Portugal", rss: "https://cnnportugal.iol.pt/rss.xml" },

  { fonte: "Correio da Manhã - Política", url: "https://www.cmjornal.pt/politica" },
  { fonte: "Correio da Manhã - Desporto", url: "https://www.cmjornal.pt/desporto" },
  { fonte: "CM ao Minuto", url: "https://www.cmjornal.pt/cm-ao-minuto" },

  { fonte: "NOW", url: "https://www.nowcanal.pt/ultimas" },

  { fonte: "Observador", rss: "https://observador.pt/feed" },
  { fonte: "ECO", rss: "https://eco.sapo.pt/feed" },
  { fonte: "ZeroZero", rss: "https://www.zerozero.pt/rss/noticias.php" },
  { fonte: "Bola na Rede", rss: "https://bolanarede.pt/feed" },
];

/* ================== UTILS ================== */
function clean(html) {
  return cheerio.load(`<div>${html}</div>`)("div").text().trim();
}

function yt(q) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

/* ================== RSS ================== */
async function fromRSS(fonte, termos) {
  if (!fonte.rss) return [];
  try {
    const res = await axios.get(fonte.rss, { headers: HEADERS, timeout: 8000 });
    const $ = cheerio.load(res.data, { xmlMode: true });
    const out = [];

    $("item").each((_, el) => {
      const titulo = $(el).find("title").text().trim();
      let desc = clean($(el).find("description").text());
      const link = $(el).find("link").text().trim();
      const pubDate = $(el).find("pubDate").text().trim();

      if (!titulo) return;
      if (!desc) desc = titulo;

      const txt = (titulo + " " + desc).toLowerCase();
      if (!termos.some(t => txt.includes(t))) return;

      const d = new Date(pubDate);
      if (isNaN(d.getTime())) return;

      out.push({
        titulo,
        resumo: desc,
        fonte: fonte.fonte,
        url: link,
        data: d.toISOString(),
        video: yt(`${titulo} ${fonte.fonte}`),
      });
    });

    return out;
  } catch {
    return [];
  }
}

/* ================== HTML ================== */
async function fromHTML(fonte, termos) {
  if (!fonte.url) return [];
  try {
    const res = await axios.get(fonte.url, { headers: HEADERS, timeout: 8000 });
    const $ = cheerio.load(res.data);
    const out = [];

    $("article").each((_, art) => {
      const a = $(art).find("a").first();
      const titulo = a.text().trim();
      if (!titulo) return;

      if (!termos.some(t => titulo.toLowerCase().includes(t))) return;

      const href = a.attr("href");
      if (!href) return;

      const time = $(art).find("time").attr("datetime");
      const d = time ? new Date(time) : null;
      if (!d || isNaN(d.getTime())) return;

      const resumo = $(art).find("p").first().text().trim() || titulo;

      out.push({
        titulo,
        resumo,
        fonte: fonte.fonte,
        url: new URL(href, fonte.url).toString(),
        data: d.toISOString(),
        video: yt(`${titulo} ${fonte.fonte}`),
      });
    });

    return out;
  } catch {
    return [];
  }
}

/* ================== API ================== */
app.get("/api/noticias", async (req, res) => {
  const q = req.query.q;
  const hours = parseInt(req.query.hours || "0", 10);
  if (!q) return res.json([]);

  const termos = expandQuery(q);
  let all = [];

  for (const f of fontes) {
    const r = await fromRSS(f, termos);
    if (r.length) all.push(...r);
    else all.push(...await fromHTML(f, termos));
  }

  if (hours > 0) {
    const limit = Date.now() - hours * 3600 * 1000;
    all = all.filter(n => new Date(n.data).getTime() >= limit);
  }

  all.sort((a, b) => new Date(b.data) - new Date(a.data));
  res.json(all);
});

app.use(express.static(path.join(__dirname, "../public")));
app.listen(PORT, () => console.log("Servidor ativo"));
