const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const state = {
  model: localStorage.getItem("claude-model") || "claude-sonnet-4-5",
  conversations: loadConversations(),
  currentId: null,
  messages: [],
  pendingImages: [],
  busy: false
};
const modelNames = {
  "claude-sonnet-4-5": "Claude Sonnet",
  "claude-haiku-4-5": "Claude Haiku",
  "claude-opus-4-1": "Claude Opus"
};

function loadConversations() {
  try { return JSON.parse(localStorage.getItem("claude-inspire-history") || "[]"); }
  catch { return []; }
}
function persist() {
  localStorage.setItem("claude-inspire-history", JSON.stringify(state.conversations.slice(0, 30)));
}
function toast(message) {
  const el = $("#toast"); el.textContent = message; el.classList.remove("hidden");
  clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.add("hidden"), 3600);
}
function setModel(model) {
  state.model = model; localStorage.setItem("claude-model", model);
  $("#welcomeModel").value = model; $("#chatModel").value = model; $("#settingsModel").value = model;
  $$(".model-item").forEach((el) => el.classList.toggle("selected", el.dataset.model === model));
}
function showView(view) {
  $("#welcome").classList.toggle("hidden", view !== "welcome");
  $("#chatView").classList.toggle("hidden", view !== "chat");
  $("#settingsView").classList.toggle("hidden", view !== "settings");
}
function newChat() {
  state.currentId = null; state.messages = []; state.pendingImages = [];
  $("#welcomeInput").value = ""; $("#chatInput").value = "";
  $("#imagePreview").innerHTML = ""; $("#imagePreview").classList.add("hidden");
  $("#attachmentLabel").textContent = "";
  showView("welcome"); $("#sidebar").classList.remove("mobile-open");
}
function saveCurrent() {
  if (!state.messages.length) return;
  const first = state.messages.find((m) => m.role === "user");
  const title = typeof first?.content === "string" ? first.content.slice(0, 54) : "Conversation avec une image";
  const record = { id: state.currentId || crypto.randomUUID(), title: title || "Nouvelle conversation", messages: state.messages, updated: Date.now(), model: state.model };
  state.currentId = record.id;
  state.conversations = [record, ...state.conversations.filter((item) => item.id !== record.id)].slice(0, 30);
  persist();
}
function openHistory() {
  const list = state.conversations;
  if (!list.length) { toast("Aucune conversation enregistrée pour le moment."); return; }
  const choice = prompt("Historique local :\n" + list.map((c, i) => `${i + 1}. ${c.title}`).join("\n") + "\n\nSaisis le numéro à ouvrir :");
  if (choice === null) return;
  const record = list[Number(choice) - 1];
  if (!record) { toast("Numéro invalide."); return; }
  state.currentId = record.id; state.messages = record.messages || []; setModel(record.model || state.model);
  renderMessages(); showView("chat"); $("#sidebar").classList.remove("mobile-open");
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[char]);
}
function renderMarkdown(text) {
  let safe = escapeHtml(text);
  safe = safe.replace(/```([\w+-]*)\n([\s\S]*?)```/g, (_m, lang, code) => `<pre><code>${code.replace(/\n$/, "")}</code></pre>`);
  safe = safe.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  safe = safe.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  safe = safe.replace(/\*(.+?)\*/g, "<em>$1</em>");
  safe = safe.replace(/^### (.+)$/gm, "<h3>$1</h3>").replace(/^## (.+)$/gm, "<h2>$1</h2>").replace(/^# (.+)$/gm, "<h1>$1</h1>");
  safe = safe.replace(/^(?:- |\* )(.*)$/gm, "<li>$1</li>");
  safe = safe.replace(/(?:<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);
  safe = safe.split(/\n{2,}/).map((part) => part.startsWith("<pre>") || part.startsWith("<h") || part.startsWith("<ul>") ? part : `<p>${part.replace(/\n/g, "<br>")}</p>`).join("");
  return safe;
}
function renderMessages() {
  const root = $("#messages"); root.innerHTML = "";
  state.messages.forEach((message) => {
    const node = document.createElement("article"); node.className = `message ${message.role}`;
    if (message.role === "assistant") {
      const label = document.createElement("div"); label.className = "message-label"; label.textContent = "✳ Claude"; node.appendChild(label);
      const content = document.createElement("div"); content.className = "message-content";
      const text = typeof message.content === "string" ? message.content : (message.content || []).filter((p) => p.type === "text").map((p) => p.text).join("\n");
      content.innerHTML = renderMarkdown(text); node.appendChild(content);
    } else {
      const content = document.createElement("div");
      const parts = Array.isArray(message.content) ? message.content : [{ type: "text", text: message.content }];
      parts.forEach((part) => {
        if (part.type === "text" && part.text) {
          const p = document.createElement("div"); p.textContent = part.text; content.appendChild(p);
        } else if (part.type === "image" && part.source?.data) {
          const img = document.createElement("img"); img.className = "message-image";
          img.src = `data:${part.source.media_type};base64,${part.source.data}`; img.alt = "Image jointe"; content.appendChild(img);
        }
      });
      node.appendChild(content);
    }
    root.appendChild(node);
  });
  root.scrollTop = root.scrollHeight;
}
function addTyping() {
  const node = document.createElement("article"); node.className = "message assistant"; node.id = "typing";
  node.innerHTML = '<div class="message-label">✳ Claude</div><div class="typing">Réflexion en cours</div>';
  $("#messages").appendChild(node); $("#messages").scrollTop = $("#messages").scrollHeight;
}
function setBusy(value) {
  state.busy = value; $("#chatSend").disabled = value; $("#welcomeSend").disabled = value;
  $("#chatSend").textContent = value ? "…" : "↑"; $("#welcomeSend").textContent = value ? "…" : "↑";
}
function fitTextarea(el) { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 240) + "px"; }
async function sendMessage(text, source) {
  const messageText = (text || "").trim();
  if (!messageText && !state.pendingImages.length) { toast("Écris un message ou joins une image."); return; }
  if (state.busy) return;
  const userContent = [];
  if (messageText) userContent.push({ type: "text", text: messageText });
  for (const image of state.pendingImages) userContent.push({ type: "image", source: { type: "base64", media_type: image.media_type, data: image.data } });
  state.messages.push({ role: "user", content: userContent.length === 1 && userContent[0].type === "text" ? messageText : userContent });
  state.pendingImages = []; $("#imagePreview").innerHTML = ""; $("#imagePreview").classList.add("hidden"); $("#attachmentLabel").textContent = "";
  $("#welcomeInput").value = ""; $("#chatInput").value = ""; fitTextarea($("#chatInput"));
  setModel(source === "welcome" ? $("#welcomeModel").value : $("#chatModel").value);
  showView("chat"); renderMessages(); saveCurrent(); setBusy(true); addTyping();
  try {
    const response = await fetch("/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: state.model, messages: state.messages })
    });
    const data = await response.json().catch(() => ({}));
    $("#typing")?.remove();
    if (!response.ok) throw new Error(data.error || "Une erreur est survenue.");
    state.messages.push({ role: "assistant", content: data.text || "Je n'ai pas reçu de texte en réponse." });
    renderMessages(); saveCurrent();
  } catch (error) {
    $("#typing")?.remove();
    state.messages.push({ role: "assistant", content: `**Impossible d'obtenir une réponse.**\n\n${error.message}\n\nVérifie que le serveur est démarré et que la clé API est configurée dans le fichier \`.env\`.` });
    renderMessages();
  } finally { setBusy(false); $("#chatInput").focus(); }
}
function addImageFiles(files) {
  const accepted = [...files].filter((file) => ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type));
  if (!accepted.length) { toast("Choisis une image PNG, JPG, WEBP ou GIF."); return; }
  if (state.pendingImages.length + accepted.length > 4) { toast("Maximum 4 images par message."); return; }
  accepted.forEach((file) => {
    if (file.size > 5 * 1024 * 1024) { toast(`${file.name} dépasse 5 Mo.`); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const image = { name: file.name, media_type: file.type, data: dataUrl.split(",")[1], preview: dataUrl };
      state.pendingImages.push(image); renderImagePreview();
    };
    reader.readAsDataURL(file);
  });
}
function renderImagePreview() {
  const root = $("#imagePreview"); root.innerHTML = "";
  state.pendingImages.forEach((image, index) => {
    const item = document.createElement("div"); item.className = "preview-item";
    item.innerHTML = `<img src="${image.preview}" alt="${escapeHtml(image.name)}"><button type="button" aria-label="Retirer l'image">×</button>`;
    item.querySelector("button").addEventListener("click", () => { state.pendingImages.splice(index, 1); renderImagePreview(); });
    root.appendChild(item);
  });
  root.classList.toggle("hidden", !state.pendingImages.length);
  $("#attachmentLabel").textContent = state.pendingImages.length ? `${state.pendingImages.length} image(s)` : "";
}
$("#newChat").addEventListener("click", newChat);
$("#mobileNewChat").addEventListener("click", newChat);
$("#collapseSidebar").addEventListener("click", () => $("#sidebar").classList.toggle("collapsed"));
$("#mobileMenu").addEventListener("click", () => $("#sidebar").classList.toggle("mobile-open"));
$("#historyButton").addEventListener("click", openHistory);
$("#settingsButton").addEventListener("click", () => { showView("settings"); $("#sidebar").classList.remove("mobile-open"); });
$("#backToChat").addEventListener("click", () => showView(state.messages.length ? "chat" : "welcome"));
$("#profileMenu").addEventListener("click", () => toast("Bienvenue dans votre espace personnel."));
$$("[data-notice]").forEach((el) => el.addEventListener("click", () => toast(el.dataset.notice)));
$$(".model-item").forEach((el) => el.addEventListener("click", () => setModel(el.dataset.model)));
$("#welcomeModel").addEventListener("change", (e) => setModel(e.target.value));
$("#chatModel").addEventListener("change", (e) => setModel(e.target.value));
$("#settingsModel").addEventListener("change", (e) => setModel(e.target.value));
$("#welcomeSend").addEventListener("click", () => sendMessage($("#welcomeInput").value, "welcome"));
$("#chatSend").addEventListener("click", () => sendMessage($("#chatInput").value, "chat"));
$("#welcomeInput").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(e.currentTarget.value, "welcome"); } });
$("#chatInput").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(e.currentTarget.value, "chat"); } });
$("#welcomeInput").addEventListener("input", (e) => fitTextarea(e.currentTarget));
$("#chatInput").addEventListener("input", (e) => fitTextarea(e.currentTarget));
$$(".suggestion").forEach((el) => el.addEventListener("click", () => { $("#welcomeInput").value = el.dataset.prompt; sendMessage(el.dataset.prompt, "welcome"); }));
$("#attachWelcome").addEventListener("click", () => $("#imageInput").click());
$("#attachChat").addEventListener("click", () => $("#imageInput").click());
$("#imageInput").addEventListener("change", (e) => { addImageFiles(e.target.files); e.target.value = ""; });
$("#clearHistory").addEventListener("click", () => {
  if (confirm("Effacer toutes les conversations enregistrées dans ce navigateur ?")) {
    state.conversations = []; persist(); newChat(); toast("Historique local effacé.");
  }
});
setModel(state.model);
fetch("/api/status").then((r) => r.json()).then((data) => {
  if (!data.configured) toast("Configuration requise : ajoute ta clé API dans le fichier .env du serveur.");
}).catch(() => {});
