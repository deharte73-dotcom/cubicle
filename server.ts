import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

// Create Gemini client if key is available
let ai: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

const app = express();
const PORT = 3000;

app.use(express.json());

// API route to parse unstructured Korean input into 5 variables
app.post("/api/parse-query", async (req, res) => {
  const { query } = req.body;
  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "질문을 입력해주세요." });
  }

  if (!ai) {
    // If no API key, do a basic regex fall-back or return error but gracefully allow manual usage
    return res.status(503).json({ 
      error: "Gemini API Key가 설정되지 않았습니다. 수동으로 폼을 작성하거나 Secrets 설정을 확인해주세요." 
    });
  }

  try {
    const prompt = `사용자가 작성한 큐비클 현장 자재 적산 관련 텍스트에서 다음 5가지 파라미터를 정확하게 분석하여 JSON으로 반환하세요.
텍스트: "${query}"

[출출할 파라미터 규칙]
1. height (높이, mm): 언급된 높이 값(숫자). 예: "높이 1800" 이면 1800, 언급 없으면 null.
2. pbType (PB 종류): "일반 PB" 또는 "방수 PB" 중 매칭되는 값. 언급 없거나 애매하면 "방수 PB"(기본값).
3. hpmType (HPM 종류): "일반 HPM" 또는 "메탈 HPM" 중 매칭되는 값. 언급 없거나 애매하면 "일반 HPM"(기본값).
4. baseboard (걸레받이): "없음", "전면에만/전면", "전체" 중 매칭되는 값. 각각 "없음", "전면", "전체"로 표준화. 언급 없으면 "없음"(기본값).
5. quantity (총 물량, 헤베): 언급된 물량 또는 헤베값(실수/정수). 예: "총 12헤베" -> 12, "45.5헤베" -> 45.5. 언급 없으면 null.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            height: { type: Type.INTEGER, description: "Cubicle height in mm" },
            pbType: { type: Type.STRING, description: "'일반 PB' 또는 '방수 PB'" },
            hpmType: { type: Type.STRING, description: "'일반 HPM' 또는 '메탈 HPM'" },
            baseboard: { type: Type.STRING, description: "'없음', '전면', '전체'" },
            quantity: { type: Type.NUMBER, description: "Total quantity in flat m2 (헤베)" },
          },
        }
      }
    });

    const text = response.text;
    if (text) {
      const parsed = JSON.parse(text.trim());
      return res.json({ parsed });
    } else {
      throw new Error("Empty response from AI");
    }
  } catch (error: any) {
    console.error("Gemini parse error:", error);
    return res.status(500).json({ error: "텍스트 분석 중 오류가 발생했습니다: " + error.message });
  }
});

// Vite middleware for development or Static Asset serving for production
async function configureServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

configureServer();
