import { Router } from "express";
import { getPublicUrl, isR2Configured } from "../lib/r2.js";

const router = Router();

router.get("/config", (_req, res) => {
  res.json({
    r2Configured: isR2Configured(),
    r2PublicUrl: getPublicUrl(),
  });
});

export default router;
