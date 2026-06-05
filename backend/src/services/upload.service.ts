import cloudinary from "../configs/cloudinary.config";
import { createFanArt, deleteFanArtById, findFanArtById } from '../models/repositories/fanArt.repo';
import { findChapterByIdForAuthor } from '../models/repositories/chapter.repo';
import { findAuthorByUserId } from '../models/repositories/author.repo';

export const uploadImageFromBuffer = async (fileBuffer: Buffer, folderName: string = 'meomic/general'): Promise<any> => {
    return new Promise((resolve, reject) => {
      
      // Create the upload stream
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folderName,
          format: 'webp', 
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary Upload Error:', error);
            return reject(error);
          }
          if (!result) {
            return reject(new Error('Cloudinary returned an empty result.'));
          }
          
          // Resolve the promise
          resolve(result); 
        }
      );
  
      // Pour the Multer buffer into the stream
      uploadStream.end(fileBuffer);
    })
}

export const uploadAndSaveFanArt = async (fileBuffer: Buffer, chapterId: number, userId: number) => {
  try {

    const author = await findAuthorByUserId(userId);
    if (!author) {
      const error: any = new Error('Forbidden: You must be a registered author to upload fan art.');
      error.statusCode = 403;
      throw error;
    }

    const chapter = await findChapterByIdForAuthor(chapterId, author.id);
    if (!chapter) {
      const error: any = new Error('Forbidden: You do not have permission to upload art for this chapter.');
      error.statusCode = 403; 
      throw error; 
    }

    const cloudinaryResult = await uploadImageFromBuffer(fileBuffer, 'meomic/fan_arts');

    const dbResult = await createFanArt({
      chapterId: chapterId,
      url: cloudinaryResult.secure_url
    });

    return {
      message: 'Fan art uploaded and saved successfully!',
      fanArtId: dbResult.insertId,
      url: cloudinaryResult.secure_url,
      width: cloudinaryResult.width,
      height: cloudinaryResult.height
    };

  } catch (error) {
    console.error("Error in uploadAndSaveFanArt service:", error);
    throw error; 
  }
}

export const removeFanArtService = async (fanArtId: number, userId: number) => {
  try {
    // 1. Fetch the fan art to get the URL and chapter_id
    const fanArt = await findFanArtById(fanArtId);
    if (!fanArt) {
      const error: any = new Error('Fan art not found.');
      error.statusCode = 404;
      throw error;
    }

    // 2. SECURITY CHECK: Verify the user is the author of this specific chapter
    const author = await findAuthorByUserId(userId);
    if (!author) {
      const error: any = new Error('Forbidden: You must be a registered author.');
      error.statusCode = 403;
      throw error;
    }

    const chapter = await findChapterByIdForAuthor(fanArt.chapter_id, author.id);
    if (!chapter) {
      const error: any = new Error('Forbidden: You do not have permission to delete art for this chapter.');
      error.statusCode = 403;
      throw error; 
    }

    // 3. Extract the Cloudinary public_id from the URL
    // URL looks like: https://res.cloudinary.com/.../meomic/fan_arts/abc123xyz.webp
    const urlParts = fanArt.url.split('/');
    const filenameWithExtension = urlParts[urlParts.length - 1]; // "abc123xyz.webp"
    const filenameOnly = filenameWithExtension.split('.')[0];    // "abc123xyz"
    
    // Reconstruct the exact path Cloudinary needs
    const publicId = `meomic/fan_arts/${filenameOnly}`;

    // 4. Destroy the image on Cloudinary
    await cloudinary.uploader.destroy(publicId);

    // 5. Delete the row from the MySQL Database
    await deleteFanArtById(fanArtId);

    return { message: 'Fan art permanently deleted from storage and database.' };
    
  } catch (error) {
    console.error("Error in removeFanArtService:", error);
    throw error;
  }
}