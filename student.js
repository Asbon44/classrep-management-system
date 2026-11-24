/* ===== CLASS BOOK SHOP – student portal ===== */
let books = [];
let current = null;      // book being bought
let buyer = null;        // {name, index, email}
let method = "mobile_money";

$("yr").textContent = new Date().getFullYear();

async function loadBooks() {
  try {
    books = toList(await dbGet("books")).filter((b) => b.status !== "Inactive");
    renderBooks();
  } catch (e) {
    $("grid").innerHTML = `<div class="empty">Could not load books. ${esc(e.message)}</div>`;
  }
}

function renderBooks() {
  const q = $("q").value.trim().toLowerCase();
  const list = books.filter((b) => (b.title + " " + b.author).toLowerCase().includes(q));
  $("grid").innerHTML = list.length
    ? list.map((b) => `
      <div class="book-card">
        ${coverHTML(b)}
        <h3>${esc(b.title)}</h3>
        <div class="au">${esc(b.author)}</div>
        <div class="pr">${money(b.price)}</div>
        <button class="btn" onclick="openCheckout('${b.id}')">🛒 Purchase</button>
      </div>`).join("")
    : `<div class="empty" style="grid-column:1/-1">No books found.</div>`;
}

function openCheckout(id) {
  current = books.find((b) => b.id === id);
  if (!current) return;
  $("coSummary").innerHTML = `${coverHTML(current)}<div><b>${esc(current.title)}</b><div style="color:var(--muted);font-size:13px">${esc(current.author)}</div><div style="font-weight:800;color:var(--blue);font-size:18px;margin-top:4px">${money(current.price)}</div></div>`;
  openModal("checkoutModal");
}

async function proceed() {
  const name = $("coName").value.trim();
  const index = $("coIndex").value.trim();
  const email = $("coEmail").value.trim();
  if (!name || !index) return toast("Please enter your name and index number", true);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast("Please enter a valid email address", true);

  const btn = $("coGo");
  btn.disabled = true;
  try {
    const tx = toList(await dbGet("transactions"));
    const dup = tx.find((t) => t.bookId === current.id && t.indexNumber.toLowerCase() === index.toLowerCase() && t.status === "Paid");
    if (dup && !confirm("This index number has already paid for this book. Pay again?")) return;
  } catch (e) { /* if the check fails, continue to payment */ }
  finally { btn.disabled = false; }

  buyer = { name, index, email };
  $("payAmt").textContent = money(current.price);
  $("payFor").textContent = current.title;
  closeModal("checkoutModal");
  openModal("payModal");
}

function pick(el) {
  document.querySelectorAll(".method").forEach((m) => m.classList.remove("sel"));
  el.classList.add("sel");
  method = el.dataset.m;
}

function pay() {
  if (typeof PaystackPop === "undefined") return toast("Could not reach Paystack. Check your internet connection.", true);
  const ref = "CBS-" + Date.now() + "-" + Math.floor(Math.random() * 1e5);
  const handler = PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY,
    email: buyer.email,
    amount: Math.round(Number(current.price) * 100), // pesewas
    currency: "GHS",
    ref,
    channels: [method],
    metadata: {
      custom_fields: [
        { display_name: "Student Name", variable_name: "student_name", value: buyer.name },
        { display_name: "Index Number", variable_name: "index_number", value: buyer.index },
        { display_name: "Book", variable_name: "book", value: current.title },
      ],
    },
    callback: function (resp) { recordPayment(resp.reference || ref); },
    onClose: function () { toast("Payment window closed", true); },
  });
  handler.openIframe();
}

async function recordPayment(reference) {
  closeModal("payModal");
  const tx = {
    bookId: current.id,
    bookTitle: current.title,
    studentName: buyer.name,
    indexNumber: buyer.index,
    email: buyer.email,
    amount: Number(current.price),
    method,
    reference,
    date: Date.now(),
    status: "Paid",
  };
  let saved = true;
  try { await dbPost("transactions", tx); } catch (e) { saved = false; }
  $("okMsg").innerHTML = saved
    ? `Thank you, <b>${esc(buyer.name)}</b>! Your payment of <b>${money(tx.amount)}</b> for <b>${esc(tx.bookTitle)}</b> was received.<br>Reference: <b>${esc(reference)}</b>`
    : `Your payment went through (reference <b>${esc(reference)}</b>) but we could not save the record. Please keep this reference and contact the admin.`;
  openModal("okModal");
  ["coName", "coIndex", "coEmail"].forEach((i) => ($(i).value = ""));
}

async function myPurchases() {
  const idx = $("mpIndex").value.trim().toLowerCase();
  if (!idx) return toast("Enter your index number", true);
  $("mpOut").innerHTML = `<div class="empty">Searching…</div>`;
  try {
    const list = toList(await dbGet("transactions")).filter((t) => t.indexNumber.toLowerCase() === idx).sort((a, b) => b.date - a.date);
    $("mpOut").innerHTML = list.length
      ? `<table><tr><th>Book</th><th>Date</th><th>Amount</th><th>Reference</th><th>Status</th></tr>${list.map((t) =>
          `<tr><td>${esc(t.bookTitle)}</td><td>${fdate(t.date)}</td><td>${money(t.amount)}</td><td>${esc(t.reference)}</td><td><span class="badge green">✔ ${esc(t.status)}</span></td></tr>`).join("")}</table>`
      : `<div class="empty">No purchases found for that index number.</div>`;
  } catch (e) {
    $("mpOut").innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  }
}

document.querySelectorAll(".overlay").forEach((o) => o.addEventListener("click", (e) => { if (e.target === o && o.id !== "payModal") o.classList.remove("show"); }));
loadBooks();
