app.get("/api/noticias", async (req, res) => {
  const termo = (req.query.q || "").trim();
  const hoursParam = parseInt(req.query.hours || "0", 10);

  if (!termo) {
    return res.status(400).json({ error: "Falta o parâmetro q" });
  }

  const agora = new Date();

  // notícias de exemplo, cada uma de um "site"
  const exemplosBase = [
    { fonte: "A Bola",   url: "https://www.abola.pt" },
    { fonte: "Record",   url: "https://www.record.pt" },
    { fonte: "O Jogo",   url: "https://www.ojogo.pt" },
    { fonte: "MaisFutebol", url: "https://maisfutebol.iol.pt" },
    { fonte: "Sapo Desporto", url: "https://desporto.sapo.pt" }
  ];

  const resultados = exemplosBase.map((item, idx) => {
    // cada notícia com uma hora de diferença
    const data = new Date(agora.getTime() - idx * 60 * 60 * 1000);
    return {
      titulo: `${item.fonte}: notícia sobre "${termo}"`,
      fonte: item.fonte,
      url: item.url,
      data: data.toISOString()
    };
  });

  // aplicar filtro de horas (se o utilizador escolher 12/24/48h)
  let filtrados = resultados;
  if (hoursParam > 0) {
    const limite = new Date(agora.getTime() - hoursParam * 60 * 60 * 1000);
    filtrados = resultados.filter(n => new Date(n.data) >= limite);
  }

  res.json(filtrados);
});
