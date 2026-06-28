import { Router } from "express";
import OpenAI from "openai";

const router = Router();

function getClient(res: import("express").Response): OpenAI | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    res.status(503).json({ error: "OPENAI_API_KEY is not configured on this server." });
    return null;
  }
  return new OpenAI({ apiKey: key });
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
      model: "gpt-4o",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `You are a precise chess diagram reader. Your task is to extract the exact board position from any chess diagram in this image and output a FEN string.

STEP 1 — ORIENT THE BOARD
Determine which side is at the bottom (White or Black). Chess diagrams usually have White at the bottom (rank 1 at bottom, rank 8 at top, file a on the left, file h on the right). Note if the board is flipped.

STEP 2 — READ EACH RANK CAREFULLY
Go rank by rank from rank 8 (top) down to rank 1 (bottom). For each rank, read each square from file a (left) to file h (right). Be extremely careful about which column each piece sits in — count the squares precisely.

For each rank write a line like:
Rank 8: r n b q k b n r
Rank 7: p p p p p p p p
... (use . for empty squares, lowercase for black pieces, uppercase for white)
Piece letters: K/k=King, Q/q=Queen, R/r=Rook, B/b=Bishop, N/n=Knight, P/p=Pawn

STEP 3 — VERIFY
Count total white pieces and total black pieces. A starting position has 16 of each. Unusual counts are fine but recheck if something seems wrong.

STEP 4 — OUTPUT FEN
Convert your rank readings to FEN piece-placement notation (consecutive empty squares become a digit), then output:
FEN: <piece_placement> <side_to_move> <castling> <en_passant> <halfmove> <fullmove>

- side_to_move: w or b (use w if unclear)
- castling: KQkq or subset, or - if none (use KQkq if unclear)
- en_passant: target square like e3, or - (use - if unclear)
- halfmove / fullmove: integers (use 0 1 if unclear)

If there are NO chess diagrams in the image, output only: NO_POSITIONS_FOUND

Output ONLY the rank readings and the FEN line(s). No other commentary.`,
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
