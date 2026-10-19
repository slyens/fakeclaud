require("dotenv").config();
const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json({ limit: "20mb" }));
app.use(express.static(path.join(__dirname, "public")));

const ALLOWED_MODELS = new Set([
  "claude-sonnet-4-5",
  "claude-haiku-4-5",
  "claude-opus-4-1"
]);

app.get("/api/status", (_req, res) => {
  res.json({ configured: Boolean(process.env.ANTHROPIC_API_KEY) });
});

app.post("/api/chat", async (req, res) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(503).json({
      error: "La clé API n'est pas configurée. Copie .env.example vers .env et ajoute ta clé API côté serveur."
    });
  }

  const { messages, model } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Ajoute un message avant d'envoyer." });
  }

  const chosenModel = ALLOWED_MODELS.has(model) ? model : "claude-sonnet-4-5";
  const safeMessages = messages.slice(-40).map((message) => {
    const role = message.role === "assistant" ? "assistant" : "user";
    let content = message.content;
    if (typeof content === "string") {
      content = content.slice(0, 30000);
    } else if (Array.isArray(content)) {
      content = content.slice(0, 12).map((part) => {
        if (part.type === "text") return { type: "text", text: String(part.text || "").slice(0, 20000) };
        if (part.type === "image" && part.source && part.source.type === "base64") {
          const mediaType = ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(part.source.media_type)
            ? part.source.media_type : "image/jpeg";
          return {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: String(part.source.data || "").slice(0, 12_000_000)
            }
          };
        }
        return { type: "text", text: "" };
      });
    } else {
      content = "";
    }
    return { role, content };
  });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: chosenModel,
        max_tokens: 4096,
        system: "Tu es un assistant utile, clair et honnête. Réponds dans la langue utilisée par l'utilisateur. Pour le code, donne des exemples sûrs et lisibles.",
        messages: safeMessages
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error?.message || `Erreur API (${response.status}). Vérifie ta clé, ton accès au modèle et ta facturation.`;
      return res.status(response.status >= 500 ? 502 : response.status).json({ error: message });
    }

    const text = (data.content || [])
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");
    return res.json({ text, model: data.model });
  } catch (error) {
    console.error("Erreur de connexion Anthropic:", error.message);
    return res.status(502).json({ error: "Impossible de joindre l'API Anthropic. Vérifie ta connexion et réessaie." });
  }
});

app.listen(PORT, () => {
  console.log(`Application prête sur http://localhost:${PORT}`);
});