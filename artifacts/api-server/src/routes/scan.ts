import { Router } from "express";
import OpenAI from "openai";

const router = Router();

const CHESS_RECOGNITION_PROMPT = `You are a chess diagram recognition expert. Read every chess board diagram in this image with maximum precision.

Work through each diagram METHODICALLY, one square at a time:
1. Find the 8×8 board. Determine its orientation: which color is on the bottom? (If a file/rank labels a–h or 1–8 are printed, USE them. If "a1" is the dark square in the bottom-left, white is on the bottom — the standard orientation.)
2. Scan rank by rank from the TOP row (rank 8) down to the BOTTOM row (rank 1). Within each rank, go LEFT to RIGHT (file a → h).
3. For EACH of the 8 squares in a rank, decide: empty, or which piece and which color.
   - Determine color by the FILL of the piece: White pieces are outlined/hollow/light; Black pieces are solid/filled/dark. Do not guess color from the square shade.
   - Identify the piece by SHAPE: King (cross on top), Queen (crown with points/orb), Rook (castle tower / battlements), Bishop (mitre with a diagonal slit), Knight (horse head), Pawn (small round ball on a base).
4. Before writing a rank, COUNT: pieces + empty squares MUST equal exactly 8. If not, re-scan that rank.
5. Sanity-check the whole board: exactly one white king (K) and exactly one black king (k). No pawns on rank 1 or rank 8. Re-examine if violated.

FEN notation rules:
- UPPERCASE = White pieces: K Q R B N P. lowercase = Black: k q r b n p.
- Numbers = consecutive empty squares in a rank (each rank must total 8).
- Ranks separated by "/", from rank 8 (top) to rank 1 (bottom).
- Append: side to move (w/b), castling rights (KQkq or -), en passant (- or square), 0, 1.
- Side to move: if the diagram caption says "White to move/play" use w; "Black to move/play" use b; default to w if unknown.

Return ONLY valid JSON with exactly this structure:
{
  "positions": [
    {
      "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
      "confidence": 95,
      "sideToMove": "black",
      "notes": "After 1.e4"
    }
  ]
}

If no chess diagrams exist in the image: {"positions": []}

Common mistakes to avoid:
- Each rank MUST have exactly 8 squares (pieces + empty squares summing to 8).
- Knight (N/n, horse head) is NOT a Bishop (B/b, mitre) — look carefully at the shape.
- Color is the piece's fill (hollow=white, solid=black), NOT the colour of the square it sits on.
- Do NOT confuse move-notation text, captions, or page decorations with pieces on the board.`;

function isValidFen(fen: string): boolean {
  const board = (fen ?? "").trim().split(/\s+/)[0];
  if (!board) return false;
  const ranks = board.split("/");
  if (ranks.length !== 8) return false;
  let wK = 0, bK = 0;
  for (let r = 0; r < 8; r++) {
    const rank = ranks[r];
    let count = 0;
    for (const ch of rank) {
      if (ch >= "1" && ch <= "8") count += Number(ch);
      else if ("prnbqkPRNBQK".includes(ch)) {
        count += 1;
        if (ch === "K") wK++;
        if (ch === "k") bK++;
        if ((ch === "P" || ch === "p") && (r === 0 || r === 7)) return false;
      } else return false;
    }
    if (count !== 8) return false;
  }
  return wK === 1 && bK === 1;
}

function getClient(res: import("express").Response): OpenAI | null {
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL?.trim();
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY?.trim();

  if (!baseURL || !apiKey) {
    res.status(503).json({ error: "Vision scanner is not configured on this server." });
    return null;
  }

  return new OpenAI({ baseURL, apiKey });
}

router.post("/scan/positions", async (req, res) => {
  const openai = getClient(res);
  if (!openai) return;

  const { imageBase64 } = req.body as { imageBase64?: string };

  if (!imageBase64?.trim()) {
    res.status(400).json({ error: "imageBase64 is required." });
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
            { type: "text", text: CHESS_RECOGNITION_PROMPT },
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

    // Parse JSON from response — strip markdown fences if present
    const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    let fens: string[] = [];
    try {
      const first = cleaned.indexOf("{");
      const last = cleaned.lastIndexOf("}");
      if (first >= 0 && last > first) {
        const parsed = JSON.parse(cleaned.slice(first, last + 1)) as { positions?: Array<{ fen?: string }> };
        fens = (parsed.positions ?? [])
          .map((p) => p.fen?.trim() ?? "")
          .filter((f) => f && isValidFen(f));
      }
    } catch {
      // fallback: extract any FEN-like strings from the text
      fens = text
        .split(/\s+/)
        .filter((token) => /^[prnbqkPRNBQK1-8]{2,}\//.test(token))
        .map((token) => token.replace(/,$/, "").replace(/"$/, ""))
        .filter(isValidFen);
    }

    res.json({ fens });
  } catch (err) {
    req.log.error({ err }, "Vision scan failed");
    res.status(500).json({ error: "Failed to scan the image for chess positions." });
  }
});

export default router;
