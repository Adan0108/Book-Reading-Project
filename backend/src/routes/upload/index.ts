import { Router } from "express";
import asyncHandler from "../../helpers/asyncHandler";
import { authenticationV2 } from "../../auth/checkAuth";
import { uploadMemory } from "../../configs/multer.config";
import uploadController from "../../controllers/upload.controller";

const router = Router();

router.use(authenticationV2);

router.post('/upload/fan-art', uploadMemory.single('file'), asyncHandler(uploadController.uploadFanArt));
router.delete('/delete/fan-art/:id', asyncHandler(uploadController.deleteFanArt));

export default router;