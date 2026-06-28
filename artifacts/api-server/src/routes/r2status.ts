import { Router, type IRouter } from "express";
import { isR2Configured, getCatalogObjectKey, getTextObject } from "../lib/r2.js";

const router: IRouter = Router();

router.get("/r2-status", async (req, res) => {
  const configured = isR2Configured();

  if (!configured) {
    res.json({
      configured: false,
      connected: false,
      error: "One or more of R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET is missing.",
    });
    return;
  }

  try {
    await getTextObject(getCatalogObjectKey());
    res.json({ configured: true, connected: true, catalogExists: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const code = (err as { Code?: string; name?: string }).Code ?? (err as { name?: string }).name ?? null;

    if (code === "NoSuchKey" || message.includes("NoSuchKey")) {
      res.json({
        configured: true,
        connected: true,
        catalogExists: false,
        note: "Bucket is reachable but catalog.json does not exist yet — it will be created on first upload.",
      });
    } else {
      res.status(502).json({
        configured: true,
        connected: false,
        error: message,
        code,
      });
    }
  }
});

export default router;
