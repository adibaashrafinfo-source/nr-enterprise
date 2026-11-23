/** Reads an image into a data URL. In demo mode it stands in for the server upload; the live API returns a stored URL. */
export const fileToUrl = (file: File) => new Promise<string>((resolve, reject) => {
  if (!file.type.startsWith("image/")) { reject(new Error("Choose an image file.")); return; }
  if (file.size > 2 * 1024 * 1024) { reject(new Error("Logo must be 2 MB or smaller.")); return; }
  const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(new Error("Could not read the file.")); r.readAsDataURL(file);
});
