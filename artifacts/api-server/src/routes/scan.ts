import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

router.post("/scan/positions", async (req, res) => {
  const { imageBase64 } = req.body as { imageBase64?: string };

  if (!imageBase64?.trim()) {
    res.status(400).json({ error: "imageBase64 is required." });
    return;
  }

  if (!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
    res.status(503).json({ error: "Vision scanner is not configured on this server." });
    return;
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are a chess position extractor. Look at this image and find all chess diagrams/boards.

For each chess position you find, output its FEN string on its own line, in this exact format:
FEN: <fen string>

Rules:
- Output a FULL FEN with all 6 fields: piece placement, side to move, castling, en passant, halfmove clock, fullmove number.
- If you cannot determine side to move, assume white (w).
- If you cannot determine castling rights, use KQkq.
- If you cannot determine en passant, use -.
- If you cannot determine move counters, use 0 1.
- If there are no chess diagrams in the image, output: NO_POSITIONS_FOUND
- Do not output any other text, explanations, or commentary.`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${imageBase64}`,
                detail: "high",
              },
            },
          ],
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "";

    if (text.includes("NO_POSITIONS_FOUND")) {
      res.json({ fens: [] });
      return;
    }

    const fens = text
      .split("\n")
      .filter((line) => line.startsWith("FEN:"))
      .map((line) => line.replace(/^FEN:\s*/, "").trim())
      .filter(Boolean);

    res.json({ fens });
  } catch (err) {
    req.log.error({ err }, "Vision scan failed");
    res.status(500).json({ error: "Failed to scan the image for chess positions." });
  }
});

export default router;
