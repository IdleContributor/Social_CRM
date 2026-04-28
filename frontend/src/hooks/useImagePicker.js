import { useState, useRef } from "react";

/**
 * Encapsulates image file selection and preview.
 * Returns everything a compose form needs to handle an image attachment.
 */
export function useImagePicker() {
  const [postImage, setPostImage]       = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef                    = useRef(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPostImage(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setPostImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return { postImage, imagePreview, fileInputRef, handleImageChange, removeImage };
}
