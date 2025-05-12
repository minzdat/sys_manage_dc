// src/Services/cloudinaryService.ts

export const CLOUD_NAME = 'dmplej3ht'; // Thay bằng cloudName của bạn
export const UPLOAD_PRESET = 'petapp_unsigned'; // Thay bằng upload preset bạn đã tạo trên Cloudinary

/**
 * Upload 1 file lên Cloudinary
 * @param file File cần upload
 * @returns URL ảnh sau upload hoặc null nếu lỗi
 */
export const uploadImageToCloudinary = async (file: File): Promise<string | null> => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (data.secure_url) {
      return data.secure_url;
    } else {
      console.error('Cloudinary upload failed:', data);
      return null;
    }

  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    return null;
  }
};
