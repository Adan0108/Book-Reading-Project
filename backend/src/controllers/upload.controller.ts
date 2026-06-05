import { Request, Response } from 'express';
import { uploadImageFromBuffer, uploadAndSaveFanArt, removeFanArtService } from '../services/upload.service';

class UploadController {

    uploadImage = async (req: Request, res: Response) => {
        try {
            // Check if Multer caught a file attached to the request
            if (!req.file) {
                return res.status(400).json({ 
                    status: 'error',
                    message: 'No file was uploaded. Please attach a file to the request.' 
                });
            }

            // Pass the file buffer to Cloudinary
            // We'll save it in a folder called 'meomic/avatars'
            const result = await uploadImageFromBuffer(req.file.buffer, 'meomic/avatars');

            // Send the secure URL back! This matches what your frontend will need
            return res.status(200).json({
                message: 'Image uploaded successfully!',
                metadata: {
                    imageUrl: result.secure_url, // <-- Save this URL to your database!
                    publicId: result.public_id,
                    width: result.width,
                    height: result.height
                }
            });


        } catch (error: any) {
            console.error("Upload Controller Error:", error);
            return res.status(500).json({
                status: 'error',
                message: 'Something went wrong while uploading to Cloudinary',
                error: error.message
            });
        }
    }

    uploadFanArt = async (req: Request, res: Response) => {
        try {
            // 1. Extract data from the HTTP Request
            const user = (req as any).user;
            const userId = Number(user?.uid ?? user?.userId);
            const chapterId = parseInt(req.body.chapterId);

            if (!req.file) {
                return res.status(400).json({ status: 'error', message: 'No fan art file was uploaded.' });
            }
            if (!chapterId || isNaN(chapterId)) {
                return res.status(400).json({ status: 'error', message: 'A valid chapterId is required.' });
            }

            // 2. Call the Service! (It handles the auth check, Cloudinary, AND the DB)
            const result = await uploadAndSaveFanArt(req.file.buffer, chapterId, userId);

            // 3. Return the success response
            return res.status(200).json({
                status: 'success',
                message: 'Fan art securely uploaded and saved!',
                metadata: result 
            });

        } catch (error: any) {
            console.error("Fan Art Upload Error:", error);
            
            // 4. Check if the Service threw our special 403 Forbidden error
            const statusCode = error.statusCode || 500;
            
            return res.status(statusCode).json({
                status: 'error',
                message: error.message || 'Failed to upload and save fan art.'
            });
        }
    }

    deleteFanArt = async (req: Request, res: Response) => {
        try {
            const user = (req as any).user;
            const userId = Number(user?.uid ?? user?.userId); 
            
            // Grab the fanArtId from the URL parameters (e.g., /upload/fan-art/5)
            const fanArtId = parseInt(req.params.id);

            if (!fanArtId || isNaN(fanArtId)) {
                return res.status(400).json({ status: 'error', message: 'A valid Fan Art ID is required.' });
            }

            // Hand it off to the Service!
            const result = await removeFanArtService(fanArtId, userId);

            return res.status(200).json({
                status: 'success',
                message: result.message
            });
        } catch (error: any) {
            console.error("Fan Art Deletion Error:", error);
            const statusCode = error.statusCode || 500;
            return res.status(statusCode).json({
                status: 'error',
                message: error.message || 'Failed to delete fan art.'
            });
        }
    }
}

export default new UploadController();