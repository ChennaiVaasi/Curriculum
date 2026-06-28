import { Router, type IRouter } from "express";
import healthRouter from "./health";
import catalogRouter from "./catalog.js";
import configRouter from "./config.js";
import filesRouter from "./files.js";
import uploadRouter from "./upload.js";
import chatpdfRouter from "./chatpdf.js";
import chat2pdfRouter from "./chat2pdf.js";
import r2statusRouter from "./r2status.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(catalogRouter);
router.use(configRouter);
router.use(filesRouter);
router.use(uploadRouter);
router.use(chatpdfRouter);
router.use(chat2pdfRouter);
router.use(r2statusRouter);

export default router;
