// api/chat.js
// Vercel Serverless Function — fa da proxy tra il frontend e Anthropic
// In questo modo la chiave API non è mai esposta nel browser

export default async function handler(req, res) {
  // Permetti solo POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Headers CORS — permetti chiamate dal tuo dominio
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Gestisci preflight OPTIONS
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { messages, system } = req.body;

  if (!messages || !system) {
    return res.status(400).json({ error: "Missing messages or system prompt" });
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY, // chiave segreta solo sul server
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system,
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (error) {
    console.error("Anthropic API error:", error);
    return res.status(500).json({ error: "Errore interno del server" });
  }
}
