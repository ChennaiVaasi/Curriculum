import { Router, type IRouter } from "express";
import healthRouter from "./health";
import catalogRouter from "./catalog.js";
import configRouter from "./config.js";
import filesRouter from "./files.js";
import uploadRouter from "./upload.js";
import uploadPgnRouter from "./upload-pgn.js";
import chatpdfRouter from "./chatpdf.js";
import chat2pdfRouter from "./chat2pdf.js";
import r2statusRouter from "./r2status.js";
import scanRouter from "./scan.js";
import chessEyeRouter from "./chess-eye.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(catalogRouter);
router.use(configRouter);
router.use(filesRouter);
router.use(uploadRouter);
router.use(uploadPgnRouter);
router.use(chatpdfRouter);
router.use(chat2pdfRouter);
router.use(r2statusRouter);
router.use(scanRouter);
router.use(chessEyeRouter);

export default router;
