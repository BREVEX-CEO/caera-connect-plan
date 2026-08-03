const button = document.querySelector("#begin");
const code = document.querySelector("#code");
const status = document.querySelector("#status");

button.addEventListener("click", async () => {
  button.disabled = true;
  try {
    const reply = await chrome.runtime.sendMessage({ kind: "pairing.begin" });
    if (!reply?.ok || typeof reply.pairingCode !== "string") {
      throw new Error("Pairing could not start.");
    }
    code.value = reply.pairingCode;
    status.textContent = "Enter this code in OCADE. It expires in five minutes.";
  } catch {
    code.value = "------";
    status.textContent = "Pairing could not start. Close and reopen the extension.";
  } finally {
    button.disabled = false;
  }
});
