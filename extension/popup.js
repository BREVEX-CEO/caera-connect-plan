const words = {
  waiting: "Waiting for you to approve this browser in OCADE.",
  connected: "Connected. JARVIS works only in tabs it opens.",
  working: "JARVIS is working in its own tab.",
  offline: "OCADE is not reachable right now.",
  update: "This extension needs an update.",
};
const $ = (id) => document.getElementById(id);
const send = (message) => chrome.runtime.sendMessage(message);

function show(state) {
  const connected = Boolean(state.deviceId);
  $("status").textContent = state.error
    ? `Something went wrong: ${state.error}`
    : connected
      ? state.task
        ? `${words.working} ${state.task.title}`
        : (words[state.status] ?? words.connected)
      : "Not connected. JARVIS cannot use this browser.";
  $("connect").hidden = connected;
  $("stop").hidden = !connected || !state.approved;
  $("forget").hidden = !connected;
  $("fingerprint").hidden = !(connected && !state.approved);
  $("fingerprint").querySelector("span").textContent = state.fingerprint ?? "";
  $("open").onclick = () => chrome.tabs.create({ url: `${state.server}/ocade-jarvis` });
}

$("connect").onclick = async () => show(await send("connect"));
$("stop").onclick = async () => show(await send("stop"));
$("forget").onclick = async () => show(await send("forget"));
show(await send("poll"));
