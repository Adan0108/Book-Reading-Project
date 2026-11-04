import { Router } from "express";
import asyncHandler from "../../helpers/asyncHandler";
import { authenticationV2 } from "../../auth/checkAuth";
import { uploadMemory } from "../../configs/multer.config";
import uploadController from "../../controllers/upload.controller";
import { authorizeUpload, confirmUpload } from '../../services/publishing.service';
import { SuccessResponse } from '../../core/success.response';
import { requireRoles } from '../../auth/requireRoles';

const router = Router();

router.use(authenticationV2);

router.post('/upload/fan-art/authorize', requireRoles(['AUTHOR', 'ADMIN']), asyncHandler(async (req, res) => {
  const metadata = await authorizeUpload(req.user!.uid, req.body);
  new SuccessResponse({ message: 'Authorized', metadata }).send(res);
}));
router.post('/upload/fan-art/confirm', requireRoles(['AUTHOR', 'ADMIN']), asyncHandler(async (req, res) => {
  const metadata = await confirmUpload(req.user!.uid, req.body.assetId);
  new SuccessResponse({ message: 'Confirmed', metadata }).send(res);
}));

router.post('/upload/fan-art', uploadMemory.single('file'), asyncHandler(uploadController.uploadFanArt));
router.delete('/delete/fan-art/:id', asyncHandler(uploadController.deleteFanArt));

export default router;
