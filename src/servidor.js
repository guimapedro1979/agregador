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
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

// ------------------ util ------------------
function norm(s) {
  return (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(html) {
  if (!html) return "";
  return cheerio.load(`<div>${html}</div>`)("div").text().trim();
}

function yt(q) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

function parseDateMaybe(x) {
  if (!x) return null;
  const d = new Date(x);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// ------------------ aliases ------------------
const ALIASES = {
  av: ["andré ventura", "ventura"],
  pr: ["marcelo rebelo de sousa", "marcelo", "presidente da republica", "presidente da república"],
  pm: ["primeiro-ministro", "primeiro ministro"],
  lmm: ["luís montenegro", "montenegro"],
  slb: ["benfica", "sport lisboa e benfica"],
  scp: ["sporting", "sporting cp", "sporting clube de portugal"],
  fcp: ["fc porto", "porto", "futebol clube do porto"],
};

function buildTerms(qRaw) {
  const q = norm(qRaw);
  if (!q) return [];
  const extras = (ALIASES[q] || []).map(norm);
  const tokens = q.split(" ").filter(Boolean);
  return [...new Set([q, ...extras, ...tokens])];
}

// ------------------ fontes ------------------
const fontes = [
  // TVs / News
  { fonte: "RTP Notícias", rss: "https://www.rtp.pt/noticias/rss" },
  { fonte: "SIC Notícias", rss: "https://sicnoticias.pt/rss" },
  { fonte: "CNN Portugal", rss: "https://cnnportugal.iol.pt/rss.xml" },

  // CM / CMTV (via CM Jornal)
  { fonte: "CM - Política", url: "https://www.cmjornal.pt/politica" },
  { fonte: "CM - Desporto", url: "https://www.cmjornal.pt/desporto" },
  { fonte: "CM ao Minuto", url: "https://www.cmjornal.pt/cm-ao-minuto" },

  // NOW
  { fonte: "NOW", url: "https://www.nowcanal.pt/ultimas" },

  // Futebol / política mista
  { fonte: "Observador", rss: "https://observador.pt/feed" },
  { fonte: "ECO", rss: "https://eco.sapo.pt/feed" },
  { fonte: "ZeroZero", rss: "https://www.zerozero.pt/rss/noticias.php" },
  { fonte: "Bola na Rede", rss: "https://bolanarede.pt/feed" },
];

// ------------------ deep fetch (abre o artigo) ------------------
// Cache simples para não rebentar o Render
const PAGE_CACHE = new Map(); // url -> {ts, data}
const CACHE_MS = 10 * 60 * 1000; // 10 min

async function fetchArticleDetails(url) {
  const now = Date.now();
  const cached = PAGE_CACHE.get(url);
  if (cached && now - cached.ts < CACHE_MS) return cached.data;

  try {
    const resp = await axios.get(url, { headers: HEADERS, timeout: 9000 });
    const $ = cheerio.load(resp.data);

    // data: tenta meta / time / json-ld
    const metaPub =
      $('meta[property="article:published_time"]').attr("content") ||
      $('meta[name="publishdate"]').attr("content") ||
      $('meta[name="pubdate"]').attr("content") ||
      $('meta[property="og:updated_time"]').attr("content");

    let iso = parseDateMaybe(metaPub);

    if (!iso) {
      const t = $("time[datetime]").first().attr("datetime");
      iso = parseDateMaybe(t);
    }

    if (!iso) {
      // JSON-LD (NewsArticle)
      const ld = $('script[type="application/ld+json"]').first().text();
      if (ld) {
        try {
          const json = JSON.parse(ld);
          const arr = Array.isArray(json) ? json : [json];
          for (const item of arr) {
            const dp = item && (item.datePublished || item.dateCreated || item.dateModified);
            const candidate = parseDateMaybe(dp);
            if (candidate) {
              iso = candidate;
              break;
            }
          }
        } catch {}
      }
    }

    // descrição/teor: meta description / og:description
    let desc =
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="description"]').attr("content") ||
      "";

    desc = (desc || "").trim();

    // fallback: excerto do texto do artigo (primeiros 350 chars)
    let bodyText = "";
    if (!desc) {
      bodyText = $("article").text().replace(/\s+/g, " ").trim();
      if (!bodyText) bodyText = $("main").text().replace(/\s+/g, " ").trim();
      desc = bodyText ? bodyText.slice(0, 350) + (bodyText.length > 350 ? "…" : "") : "";
    }

    const data = { iso, desc, fullText: bodyText || "" };
    PAGE_CACHE.set(url, { ts: now, data });
    return data;
  } catch {
    const data = { iso: null, desc: "", fullText: "" };
    PAGE_CACHE.set(url, { ts: now, data });
    return data;
  }
}

// ------------------ RSS ------------------
function parseDateFromRssItem($item) {
  const pubDate = $item.find("pubDate").first().text().trim();
  const dcDate = $item.find("dc\\:date").first().text().trim();
  const published = $item.find("published").first().text().trim();
  const updated = $item.find("updated").first().text().trim();
  return parseDateMaybe(pubDate) || parseDateMaybe(dcDate) || parseDateMaybe(published) || parseDateMaybe(updated);
}

async function fromRSS(fonte, terms, hours) {
  if (!fonte.rss) return [];
  try {
    const res = await axios.get(fonte.rss, { headers: HEADERS, timeout: 9000 });
    const $ = cheerio.load(res.data, { xmlMode: true });

    // 1) apanhar items mais recentes primeiro
    const items = [];
    $("item").each((_, el) => items.push($(el)));

    // limita deep fetch para não rebentar
    const MAX_ITEMS = 25;
    const MAX_DEEP = 8;

    const out = [];
    let deepUsed = 0;

    for (const $item of items.slice(0, MAX_ITEMS)) {
      const titulo = ($item.find("title").first().text() || "").trim();
      let desc = stripHtml(($item.find("description").first().text() || "").trim());
      const link = ($item.find("link").first().text() || "").trim();

      if (!titulo || !link) continue;
      if (!desc) desc = titulo;

      const blob = norm(titulo + " " + desc);
      let match = terms.some((t) => blob.includes(t));

      // data inicial do feed
      let iso = parseDateFromRssItem($item);

      // Se não deu match, ou se não há data, fazemos deep fetch (limitado)
      if ((!match || !iso) && deepUsed < MAX_DEEP) {
        deepUsed++;
        const details = await fetchArticleDetails(link);

        // data real
        if (!iso && details.iso) iso = details.iso;

        // texto para match (meta desc ou texto)
        const deepBlob = norm(titulo + " " + (details.desc || "") + " " + (details.fullText || ""));
        match = match || terms.some((t) => deepBlob.includes(t));

        // melhor descrição
        if (details.desc && details.desc.length > desc.length) desc = details.desc;
      }

      // Sem match? fora.
      if (!match) continue;

      // filtro por horas REAL: precisa de data real
      if (hours > 0) {
        if (!iso) continue;
        const limit = Date.now() - hours * 3600 * 1000;
        if (new Date(iso).getTime() < limit) continue;
      } else {
        // sem filtro, se não houver data, usa agora (só para exibir)
        iso = iso || new Date().toISOString();
      }

      out.push({
        titulo,
        resumo: desc || titulo,
        fonte: fonte.fonte,
        url: link,
        data: iso,
        video: yt(`${titulo} ${fonte.fonte} Portugal`),
      });
    }

    return out;
  } catch {
    return [];
  }
}

// ------------------ HTML list scraping ------------------
async function fromHTMLList(fonte, terms, hours) {
  if (!fonte.url) return [];
  try {
    const res = await axios.get(fonte.url, { headers: HEADERS, timeout: 9000 });
    const $ = cheerio.load(res.data);

    const out = [];
    const MAX = 20;

    $("a").each((_, a) => {
      if (out.length >= MAX) return;

      const titulo = $(a).text().trim();
      if (!titulo || titulo.length < 8) return;

      const tnorm = norm(titulo);
      if (!terms.some((t) => tnorm.includes(t))) return;

      let href = $(a).attr("href");
      if (!href) return;

      try {
        href = new URL(href, fonte.url).toString();
      } catch {
        return;
      }

      out.push({ titulo, url: href });
    });

    // enriquecer com data/desc via deep fetch (limitado)
    const enriched = [];
    for (const item of out.slice(0, 10)) {
      const details = await fetchArticleDetails(item.url);
      const iso = details.iso;

      if (hours > 0) {
        if (!iso) continue;
        const limit = Date.now() - hours * 3600 * 1000;
        if (new Date(iso).getTime() < limit) continue;
      }

      const resumo = details.desc || item.titulo;

      // match também no texto do artigo (aqui sim “tipo Google”)
      const deepBlob = norm(item.titulo + " " + (details.desc || "") + " " + (details.fullText || ""));
      if (!terms.some((t) => deepBlob.includes(t))) continue;

      enriched.push({
        titulo: item.titulo,
        resumo,
        fonte: fonte.fonte,
        url: item.url,
        data: iso || new Date().toISOString(),
        video: yt(`${item.titulo} ${fonte.fonte} Portugal`),
      });
    }

    return enriched;
  } catch {
    return [];
  }
}

// ------------------ API ------------------
app.get("/api/noticias", async (req, res) => {
  const q = req.query.q || "";
  const hours = parseInt(req.query.hours || "0", 10);

  const terms = buildTerms(q);
  if (!terms.length) return res.json([]);

  let all = [];

  for (const f of fontes) {
    let r = [];
    if (f.rss) r = await fromRSS(f, terms, hours);
    else r = await fromHTMLList(f, terms, hours);

    all.push(...r);
  }

  // ordenar mais recente primeiro
  all.sort((a, b) => new Date(b.data) - new Date(a.data));

  // remover duplicados por URL
  const seen = new Set();
  all = all.filter((n) => {
    if (!n.url) return false;
    if (seen.has(n.url)) return false;
    seen.add(n.url);
    return true;
  });

  res.json(all);
});

app.use(express.static(path.join(__dirname, "../public")));
app.listen(PORT, () => console.log("Servidor ativo na porta", PORT));
