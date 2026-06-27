import { Router, type IRouter } from "express";
import healthRouter from "./health";
import catalogRouter from "./catalog.js";
import filesRouter from "./files.js";
import uploadRouter from "./upload.js";
import chatpdfRouter from "./chatpdf.js";
import chat2pdfRouter from "./chat2pdf.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(catalogRouter);
router.use(filesRouter);
router.use(uploadRouter);
router.use(chatpdfRouter);
router.use(chat2pdfRouter);

export default router;
