/** Dropped files onto an element the way a browser does: real drag events carrying a real DataTransfer. */
export function dropFiles(target: Element, files: File[]): void {
  const dataTransfer = new DataTransfer();
  files.forEach((file) => dataTransfer.items.add(file));
  for (const type of ['dragover', 'drop']) {
    target.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer }));
  }
}
