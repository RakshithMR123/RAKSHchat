import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;
app.use(express.json());

// Optimized AI Client
let genAI: any = null;
const getGenAI = () => {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is required");
    genAI = new GoogleGenAI({ 
      apiKey,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' }
      }
    });
  }
  return genAI;
};

// High-Resilience Model Priority List (RAKSHchat V4)
const MODELS = [
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b"
];

// Intelligent Stream Relay (RAKSHchat V3)
async function relayStream(contents: any[], res: express.Response) {
  const ai = getGenAI();
  let lastErr: any = null;
  let success = false;

  console.log(`[RAKSHchat V3] Processing request with ${contents.length} blocks...`);

  for (const model of MODELS) {
    try {
      console.log(`[V3] Attempting ${model}...`);
      
      const result = await ai.models.generateContentStream({
        model,
        contents,
        config: {
          systemInstruction: "You are RAKSHAI, an ultra-fast and intelligent AI assistant. Use Markdown. Be helpful and punchy.",
          temperature: 0.7,
        }
      });

      // If we reach here, the model started responding
      let chunkCount = 0;
      for await (const chunk of result) {
        const text = chunk.text;
        if (text) {
          if (chunkCount === 0) console.log(`[V3] ${model} successfully streaming!`);
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
          chunkCount++;
        }
      }
      
      if (chunkCount > 0) {
        res.write('data: [DONE]\n\n');
        res.end();
        success = true;
        return;
      }
    } catch (err: any) {
      lastErr = err;
      const errorStr = JSON.stringify(err);
      const isQuota = errorStr.includes("429") || errorStr.includes("quota") || errorStr.includes("RESOURCE_EXHAUSTED");
      const isNotFound = errorStr.includes("404") || errorStr.includes("not found") || errorStr.includes("503");
      
      console.error(`[V3] ${model} unavailable: ${err.message || 'Check logs'}`);
      
      if (isQuota || isNotFound) {
        continue;
      }
      break;
    }
  }

  if (!success) {
    console.error("[V3] All models failed.");
    res.write(`data: ${JSON.stringify({ error: "RAKSHchat is currently experiencing high load. Please try again in a few seconds." })}\n\n`);
    res.end();
  }
}

// Routes
app.get("/api/health", (req, res) => res.json({ status: "ok", engine: "RAKSHchat-V3" }));

app.post("/api/ai/chat", async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const { messages } = req.body;
  const contents = (messages || []).map((m: any) => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }]
  }));

  if (contents.length === 0) {
    res.write(`data: ${JSON.stringify({ text: "Hey! How can I help?" })}\n\n`);
    res.end();
    return;
  }

  await relayStream(contents, res);
});

// Simplified Utility with fallback
app.post("/api/ai/utility", async (req, res) => {
  try {
    const { prompt } = req.body;
    const ai = getGenAI();
    let lastErr: any = null;

    const formattedContents = [{
      role: 'user',
      parts: [{ text: prompt }]
    }];

    for (const model of MODELS) {
      try {
        const response = await ai.models.generateContent({ 
          model, 
          contents: formattedContents 
        });
        return res.json({ result: response.text });
      } catch (err: any) {
        lastErr = err;
        const errorStr = JSON.stringify(err);
        const isQuota = errorStr.includes("429") || errorStr.includes("quota") || errorStr.includes("RESOURCE_EXHAUSTED");
        const isNotFound = errorStr.includes("404") || errorStr.includes("not found");
        
        if (isQuota || isNotFound) {
          console.warn(`[Utility] ${model} unavailable, trying next...`);
          continue;
        }
        break;
      }
    }
    throw lastErr || new Error("Utility AI failed");
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Revised Vite/Production Integration
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("[RAKSHchat] Dev mode initializing...");
    const vite = await createViteServer({ 
      server: { middlewareMode: true }, 
      appType: "spa" 
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    console.log(`[RAKSHchat] Production mode serving from ${distPath}`);
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[RAKSHchat V4] Core listening on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error("FAILED TO START SERVER:", err);
});
