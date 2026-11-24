/* ===== CLASS BOOK SHOP – admin portal ===== */
const DEFAULT_PASSWORD = "admin123";
let allBooks = [], allTx = [], tPage = 1, newImage = "";
const PER_PAGE = 8;

async function login(e) {
  e.preventDefault();
  const user = $("lUser").value.trim().toLowerCase();
  const pass = $("lPass").value;
  const btn = $("lBtn");
  btn.disabled = true;
  try {
    const stored = await dbGet("admin/passwordHash");
    const expected = stored || (await sha256(DEFAULT_PASSWORD));
    if (user === "admin" && (await sha256(pass)) === expected) {
      sessionStorage.setItem("cbs_admin", "1");
      start();
    } else toast("Wrong username or password", true);
  } catch (err) { toast(err.message, true); }
  btn.disabled = false;
}
function logout() { sessionStorage.removeItem("cbs_admin"); location.reload(); }

async function changePassword() {
  const o = $("cpOld").value, n = $("cpNew").value, n2 = $("cpNew2").value;
  if (!o || !n || !n2) return toast("Fill in all fields", true);
  if (n.length < 6) return toast("New password must be at least 6 characters", true);
  if (n !== n2) return toast("New passwords do not match", true);
  const btn = $("cpBtn"); btn.disabled = true;
  try {
    const stored = (await dbGet("admin/passwordHash")) || (await sha256(DEFAULT_PASSWORD));
    if ((await sha256(o)) !== stored) throw new Error("Current password is incorrect");
    await dbPut("admin/passwordHash", await sha256(n));
    ["cpOld", "cpNew", "cpNew2"].forEach((i) => ($(i).value = ""));
    toast("Password updated successfully");
  } catch (err) { toast(err.message, true); }
  btn.disabled = false;
}

function start() {
  $("loginView").style.display = "none";
  $("appView").style.display = "flex";
  refresh();
}
function show(v) {
  ["dashboard", "transactions", "settings"].forEach((s) => ($("v-" + s).style.display = s === v ? "block" : "none"));
  document.querySelectorAll(".side a[data-v]").forEach((a) => a.classList.toggle("active", a.dataset.v === v));
}

async function refresh() {
  try {
    const [b, t] = await Promise.all([dbGet("books"), dbGet("transactions")]);
    allBooks = toList(b).sort((x, y) => (x.createdAt || 0) - (y.createdAt || 0));
    allTx = toList(t).sort((x, y) => y.date - x.date);
    renderStats(); renderBooks(); renderTx();
  } catch (e) { toast(e.message, true); }
}
const paidCount = (id) => new Set(allTx.filter((t) => t.bookId === id && t.status === "Paid").map((t) => t.indexNumber.toLowerCase())).size;

function renderStats() {
  const paid = allTx.filter((t) => t.status === "Paid");
  $("stBooks").textContent = allBooks.length;
  $("stStudents").textContent = new Set(paid.map((t) => t.indexNumber.toLowerCase())).size;
  $("stRev").textContent = money(paid.reduce((s, t) => s + Number(t.amount), 0));
  $("stPur").textContent = paid.length;
}

function renderBooks() {
  const q = $("bq").value.trim().toLowerCase();
  const list = allBooks.filter((b) => (b.title + " " + b.author).toLowerCase().includes(q));
  $("bookRows").innerHTML = list.length
    ? list.map((b, i) => `<tr><td>${i + 1}</td><td><b>${esc(b.title)}</b></td><td>${esc(b.author)}</td><td>${Number(b.price).toFixed(2)}</td><td><span class="badge blue">${paidCount(b.id)}</span></td><td><span class="badge ${b.status === "Inactive" ? "gray" : "green"}">${b.status === "Inactive" ? "Inactive" : "Active"}</span></td><td><button class="btn sm" onclick="details('${b.id}')">View Details</button></td></tr>`).join("")
    : `<tr><td colspan="7" class="empty">No books yet. Click “Add Book”.</td></tr>`;
}

function renderTx() {
  const q = $("tq").value.trim().toLowerCase();
  const list = allTx.filter((t) => (t.studentName + " " + t.indexNumber).toLowerCase().includes(q));
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  if (tPage > pages) tPage = pages;
  const slice = list.slice((tPage - 1) * PER_PAGE, tPage * PER_PAGE);
  $("txRows").innerHTML = slice.length
    ? slice.map((t, i) => `<tr><td>${(tPage - 1) * PER_PAGE + i + 1}</td><td>${esc(t.studentName)}</td><td>${esc(t.indexNumber)}</td><td>${esc(t.bookTitle)}</td><td>${Number(t.amount).toFixed(2)}</td><td>${fdate(t.date)}</td><td><span class="badge green">✔ ${esc(t.status)}</span></td></tr>`).join("")
    : `<tr><td colspan="7" class="empty">No transactions found.</td></tr>`;
  let p = `<button ${tPage === 1 ? "disabled" : ""} onclick="goPage(${tPage - 1})">Previous</button>`;
  for (let i = 1; i <= pages; i++) p += `<button class="${i === tPage ? "on" : ""}" onclick="goPage(${i})">${i}</button>`;
  p += `<button ${tPage === pages ? "disabled" : ""} onclick="goPage(${tPage + 1})">Next</button>`;
  $("pager").innerHTML = p;
}
function goPage(n) { tPage = n; renderTx(); }

function openAdd() {
  newImage = "";
  ["bTitle", "bAuthor", "bPrice"].forEach((i) => ($(i).value = ""));
  $("bImg").value = "";
  $("bPrev").innerHTML = "🖼 Upload Book Image<br><small>(Click to browse)</small>";
  openModal("addModal");
}
function pickImage(input) {
  const f = input.files[0];
  if (!f) return;
  if (!f.type.startsWith("image/")) return toast("Please select a valid image", true);
  if (f.size > 4 * 1024 * 1024) return toast("Image must be smaller than 4 MB", true);
  const img = new Image();
  const url = URL.createObjectURL(f);
  img.onload = () => {
    const max = 420, s = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    newImage = c.toDataURL("image/jpeg", 0.8);
    $("bPrev").innerHTML = `<img src="${newImage}" alt="preview">Click to change`;
    URL.revokeObjectURL(url);
  };
  img.onerror = () => { URL.revokeObjectURL(url); toast("Could not read that image", true); };
  img.src = url;
}
async function saveBook() {
  const title = $("bTitle").value.trim(), author = $("bAuthor").value.trim(), price = parseFloat($("bPrice").value);
  if (!title || !author || !(price > 0)) return toast("Enter a title, author and valid price", true);
  const btn = $("bSave"); btn.disabled = true;
  try {
    await dbPost("books", { title, author, price, image: newImage, status: "Active", createdAt: Date.now() });
    closeModal("addModal"); toast("Book added - student page updated"); refresh();
  } catch (e) { toast(e.message, true); }
  btn.disabled = false;
}

function details(id) {
  const b = allBooks.find((x) => x.id === id);
  const tx = allTx.filter((t) => t.bookId === id).sort((x, y) => y.date - x.date);
  $("detBody").innerHTML = `
    <div class="book-detail-top">${coverHTML(b)}<div style="flex:1;min-width:220px"><p><span style="color:var(--muted)">Title:</span> <b>${esc(b.title)}</b></p><p style="margin-top:6px"><span style="color:var(--muted)">Author / Lecturer:</span> <b>${esc(b.author)}</b></p><p style="margin-top:6px"><span style="color:var(--muted)">Price:</span> <b>${money(b.price)}</b></p><div class="total-box"><small>Total Students Paid</small><b>${paidCount(id)}</b></div></div></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px;flex-wrap:wrap"><h3 style="color:var(--blue-d)">👥 Students Who Paid for This Book</h3><button class="btn sm" onclick="downloadCSV(allTx.filter(t=>t.bookId==='${id}'),'${esc(b.title).replace(/[^\w]+/g, "-")}-students.csv')">��� Download List</button></div>
    <div class="table-wrap"><table><thead><tr><th>#</th><th>Student Name</th><th>Index Number</th><th>Payment Date</th><th>Amount (GH₵)</th><th>Status</th></tr></thead><tbody>${tx.length ? tx.map((t, i) => `<tr><td>${i + 1}</td><td>${esc(t.studentName)}</td><td>${esc(t.indexNumber)}</td><td>${fdate(t.date)}</td><td>${Number(t.amount).toFixed(2)}</td><td><span class="badge green">✔ ${esc(t.status)}</span></td></tr>`).join("") : `<tr><td colspan="6" class="empty">No payments yet.</td></tr>`}</tbody></table></div>
    <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap"><button class="btn light sm" onclick="toggleStatus('${id}')">${b.status === "Inactive" ? "Set Active" : "Set Inactive (hide from store)"}</button><button class="btn danger sm" onclick="removeBook('${id}')">Delete Book</button></div>`;
  openModal("detModal");
}
async function toggleStatus(id) {
  const b = allBooks.find((x) => x.id === id);
  try { await dbPatch("books/" + id, { status: b.status === "Inactive" ? "Active" : "Inactive" }); closeModal("detModal"); refresh(); toast("Status updated"); }
  catch (e) { toast(e.message, true); }
}
async function removeBook(id) {
  if (!confirm("Delete this book? Past transactions are kept.")) return;
  try { await dbDelete("books/" + id); closeModal("detModal"); refresh(); toast("Book deleted"); }
  catch (e) { toast(e.message, true); }
}

function downloadCSV(rows, name) {
  if (!rows.length) return toast("Nothing to export", true);
  const head = ["Student Name", "Index Number", "Email", "Book", "Amount (GHS)", "Date", "Reference", "Status"];
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((t) => [t.studentName, t.indexNumber, t.email, t.bookTitle, t.amount, fdate(t.date), t.reference, t.status].map(cell).join(","));
  const blob = new Blob([[head.map(cell).join(","), ...lines].join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  URL.revokeObjectURL(a.href);
}

document.querySelectorAll(".overlay").forEach((o) => o.addEventListener("click", (e) => { if (e.target === o) o.classList.remove("show"); }));
if (sessionStorage.getItem("cbs_admin") === "1") start();
