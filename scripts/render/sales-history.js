import { getSupabaseClient } from "../supabaseClient.js";
import { showToast } from "../ui.js";
import {
  sanitizeShortText,
  sanitizeUrl,
  toSafeMoney,
  toSafeNumber,
} from "../security.js";

/* ── helpers ─────────────────────────────────────────────────────── */

function sanitize(str) {
  if (!str) return "";
  return String(str).replace(/[&<>'"]/g, (tag) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[tag] || tag)
  );
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusBadge(status = "pending") {
  const s = sanitize(status).toLowerCase();
  const map = {
    pending:   { bg: "#fef3c7", color: "#92400e", label: "Pending" },
    paid:      { bg: "#d1fae5", color: "#065f46", label: "Paid" },
    shipped:   { bg: "#dbeafe", color: "#1e40af", label: "Shipped" },
    delivered: { bg: "#d1fae5", color: "#065f46", label: "Delivered" },
    completed: { bg: "#d1fae5", color: "#065f46", label: "Completed" },
    cancelled: { bg: "#fee2e2", color: "#991b1b", label: "Cancelled" },
  };
  const info = map[s] ?? map.pending;
  return `<span style="
    display:inline-block;
    padding:4px 12px;
    font-size:12px;
    font-weight:600;
    letter-spacing:0.02em;
    border-radius:9999px;
    background:${info.bg};
    color:${info.color};
    white-space:nowrap;
  ">${info.label}</span>`;
}

/* ── main render ─────────────────────────────────────────────────── */

export async function renderSalesHistory() {
  const container = document.getElementById("sales-history-list")
    || document.querySelector(".history-list");

  if (!container) return;

  // loading state
  container.innerHTML = `
    <div style="
      padding:64px 24px;
      text-align:center;
      color:#78716c;
      font-size:15px;
    ">Loading sales history…</div>`;

  try {
    const supabase = await getSupabaseClient();

    /* ── auth ──────────────────────────────────────────────────── */
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      container.innerHTML = `
        <div style="
          padding:64px 24px;
          text-align:center;
          border:1px dashed rgba(197,200,188,0.5);
          border-radius:16px;
        ">
          <h3 style="margin:0 0 8px;font-family:var(--serif);color:#1c1917;">
            Please sign in
          </h3>
          <p style="margin:0;color:#78716c;font-size:15px;">
            You need to be logged in to view your sales history.
          </p>
        </div>`;
      return;
    }

    /* ── fetch sold products ──────────────────────────────────── */
    const { data: products, error: prodErr } = await supabase
      .from("products")
      .select("id, title, price, image_url, created_at, status, carbon_offset")
      .eq("seller_id", user.id)
      .eq("status", "sold")
      .order("created_at", { ascending: false });

    if (prodErr) throw prodErr;

    if (!products || products.length === 0) {
      container.innerHTML = renderEmptyState();
      return;
    }

    /* ── fetch related order_items ────────────────────────────── */
    const productIds = products.map((p) => p.id);
    const { data: orderItems } = await supabase
      .from("order_items")
      .select("product_id, price, quantity, order_id, orders(created_at, status)")
      .in("product_id", productIds);

    // Map product_id → order info for quick lookup
    const orderMap = new Map();
    if (orderItems) {
      for (const oi of orderItems) {
        // Keep the latest order per product (in case of multiples)
        if (!orderMap.has(oi.product_id)) {
          orderMap.set(oi.product_id, oi);
        }
      }
    }

    /* ── render cards ─────────────────────────────────────────── */
    container.innerHTML = products.map((product) => {
      const oi = orderMap.get(product.id);
      const order = oi?.orders ?? {};
      const salePrice = oi ? toSafeNumber(oi.price) * toSafeNumber(oi.quantity, 1) : toSafeNumber(product.price);
      const saleDate = order.created_at || product.created_at;
      const orderStatus = order.status || "completed";

      return renderCard(product, salePrice, saleDate, orderStatus);
    }).join("");

    /* ── populate stats bar ───────────────────────────────────── */
    const totalSales = products.reduce((sum, p) => {
      const oi = orderMap.get(p.id);
      return sum + (oi ? toSafeNumber(oi.price) * toSafeNumber(oi.quantity, 1) : toSafeNumber(p.price));
    }, 0);
    const totalCO2 = products.reduce((sum, p) => sum + toSafeNumber(p.carbon_offset), 0);

    const elTotalSales = document.getElementById("sh-total-sales");
    const elItemsSold = document.getElementById("sh-items-sold");
    const elCO2 = document.getElementById("sh-co2-offset");
    const elCount = document.getElementById("sh-transaction-count");
    const elEmpty = document.getElementById("sh-empty-state");

    if (elTotalSales) elTotalSales.textContent = `${window.formatCurrency(totalSales)}`;
    if (elItemsSold) elItemsSold.textContent = products.length;
    if (elCO2) elCO2.textContent = `${totalCO2.toFixed(1)}kg`;
    if (elCount) elCount.textContent = `${products.length} transactions`;
    if (elEmpty) elEmpty.style.display = "none";

  } catch (err) {
    console.error("Sales history error:", err);
    showToast("Could not load sales history. Please try again.");
    container.innerHTML = `
      <div style="
        padding:64px 24px;
        text-align:center;
        border:1px dashed rgba(197,200,188,0.5);
        border-radius:16px;
      ">
        <h3 style="margin:0 0 8px;font-family:var(--serif);color:#1c1917;">
          Something went wrong
        </h3>
        <p style="margin:0;color:#78716c;font-size:15px;">
          We couldn't load your sales history right now.
        </p>
      </div>`;
  }
}

/* ── card template ───────────────────────────────────────────────── */

function renderCard(product, salePrice, saleDate, orderStatus) {
  const title = sanitizeShortText(product.title, "Untitled Product");
  const image = sanitizeUrl(product.image_url);
  const price = toSafeMoney(salePrice);
  const date = formatDate(saleDate);
  const badge = statusBadge(orderStatus);

  return `
    <article style="
      display:flex;
      align-items:center;
      gap:20px;
      padding:20px;
      background:#fff;
      border:1px solid #e7e5e4;
      border-radius:16px;
      margin-bottom:16px;
      transition:box-shadow 0.2s ease;
    " onmouseenter="this.style.boxShadow='0 4px 24px rgba(0,0,0,0.06)'"
       onmouseleave="this.style.boxShadow='none'">

      <!-- Product image -->
      <div style="flex-shrink:0;">
        <img
          src="${image}"
          alt="${title}"
          style="
            width:80px;
            height:80px;
            object-fit:cover;
            border-radius:12px;
            background:#f0ede8;
            display:block;
          "
          onerror="this.src='assets/chair.jpg'"
        />
      </div>

      <!-- Info -->
      <div style="flex:1;min-width:0;">
        <div style="
          display:flex;
          align-items:center;
          gap:10px;
          margin-bottom:6px;
          flex-wrap:wrap;
        ">
          <time style="
            font-size:13px;
            color:#78716c;
            letter-spacing:0.01em;
          ">${date}</time>
          ${badge}
        </div>
        <h3 style="
          margin:0;
          font-size:17px;
          font-weight:600;
          color:#1c1917;
          font-family:var(--serif);
          overflow:hidden;
          text-overflow:ellipsis;
          white-space:nowrap;
        ">${title}</h3>
      </div>

      <!-- Price -->
      <div style="flex-shrink:0;text-align:right;">
        <strong style="
          font-size:22px;
          color:#3d5a30;
          font-weight:700;
          letter-spacing:-0.01em;
        ">${window.formatCurrency(price)}</strong>
      </div>
    </article>`;
}

/* ── empty state ─────────────────────────────────────────────────── */

function renderEmptyState() {
  return `
    <div style="
      padding:64px 24px;
      text-align:center;
      border:1px dashed rgba(197,200,188,0.5);
      border-radius:16px;
      background:#fafaf8;
    ">
      <div style="
        width:64px;
        height:64px;
        margin:0 auto 20px;
        border-radius:50%;
        background:#f0ede8;
        display:flex;
        align-items:center;
        justify-content:center;
      ">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
             stroke="#9caf88" stroke-width="1.5" stroke-linecap="round"
             stroke-linejoin="round">
          <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
          <line x1="3" y1="6" x2="21" y2="6"/>
          <path d="M16 10a4 4 0 01-8 0"/>
        </svg>
      </div>
      <h3 style="
        margin:0 0 8px;
        font-family:var(--serif);
        font-size:20px;
        color:#1c1917;
      ">No sales yet</h3>
      <p style="
        margin:0;
        color:#78716c;
        font-size:15px;
        max-width:320px;
        margin:0 auto;
        line-height:1.5;
      ">Once a buyer purchases one of your listings, the transaction will appear here.</p>
    </div>`;
}
