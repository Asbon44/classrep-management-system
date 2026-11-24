/* ===== CLASS BOOK SHOP – shared config & helpers ===== */
const DB_URL = "https://general-b9b11-default-rtdb.firebaseio.com";
const PAYSTACK_PUBLIC_KEY = "pk_live_b6f97586122addad3266156fe124d7da8113f810";

async function db(method, path, body) {
  const res = await fetch(`${DB_URL}/${path}.json`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Database error ${res.status}. Check your Firebase rules.`);
  return res.json();
}
const dbGet = (p) => db("GET", p);
const dbPut = (p, d) => db("PUT", p, d);
const dbPost = (p, d) => db("POST", p, d);
const dbPatch = (p, d) => db("PATCH", p, d);
const dbDelete = (p) => db("DELETE", p);

const toList = (obj) => Object.entries(obj || {}).map(([id, v]) => ({ id, ...v }));

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (n) => "GH₵ " + Number(n || 0).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fdate = (ts) => new Date(ts).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
const $ = (id) => document.getElementById(id);

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function toast(msg, isErr) {
  let t = $("toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = "show" + (isErr ? " err" : "");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.className = ""), 3200);
}

const openModal = (id) => $(id).classList.add("show");
const closeModal = (id) => $(id).classList.remove("show");

function coverHTML(b) {
  if (!b?.image) return `<div class="cover">${esc(b?.title)}</div>`;
  const image = esc(b.image);
  return `<div class="cover"><img src="${image}" alt="${esc(b.title)}" loading="lazy" referrerpolicy="no-referrer"></div>`;
}

function subscribeToBooks(onChange) {
  const url = `${DB_URL}/books.json`;
  const events = new EventSource(url);

  events.onmessage = (event) => {
    let value = null;
    try { value = JSON.parse(event.data); } catch (_) { return; }
    onChange(toList(value));
  };

  events.onerror = () => {
    if (typeof onChange.__retry === "number") clearTimeout(onChange.__retry);
    onChange.__retry = setTimeout(() => loadBooks(), 5000);
  };

  return events;
}
