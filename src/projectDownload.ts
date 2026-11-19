/** Keep the user-initiated download local to the browser; preview hosts may not serve ZIP URLs. */
export function downloadProjectArchive(encoded: string) {
  const binary = atob(encoded.trim());
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (
    bytes.length < 22 ||
    bytes[0] !== 0x50 ||
    bytes[1] !== 0x4b ||
    bytes[2] !== 0x03 ||
    bytes[3] !== 0x04
  ) {
    throw new Error("Invalid project ZIP payload");
  }
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/zip" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "SmartMarsh-GitHub.zip";
  link.style.display = "none";
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    // Browsers can start saving after the click handler finishes, especially inside previews.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
