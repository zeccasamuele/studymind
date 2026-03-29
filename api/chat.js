// api/chat.js
// Vercel Serverless Function — fa da proxy tra il frontend e Anthropic

export default async function handler(req, res) {
  // Headers CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Gestisci preflight OPTIONS
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Permetti solo POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Parsa manualmente il body se necessario
    let body = req.body;
    if (typeof body === "string") {
      body = JSON.parse(body);
    }

    const { messages, system } = body;

    if (!messages || !system) {
      return res.status(400).json({ error: "Missing messages or system prompt" });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
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
    return res.status(500).json({ error: error.message || "Errore interno del server" });
  }
}