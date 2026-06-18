import { sanitizeShortText, sanitizeUrl, toSafeMoney, toSafeNumber } from "../security.js";
import { getSupabaseClient } from "../supabaseClient.js";

export async function renderConfirmation() {
  const container = document.getElementById("router-view");
  if (!container) return;

  try {
    const supabase = await getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) return;

    // Fetch the most recent order for the user
    const { data: orders, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (orderError || !orders || orders.length === 0) {
      container.innerHTML = `<div style="padding: 100px; text-align: center;"><h2>No order found.</h2></div>`;
      return;
    }

    const order = orders[0];
    const orderNumberStr = "RH-" + order.id.substring(0, 5).toUpperCase();
    const orderNumberEl = document.getElementById("order-number");
    if (orderNumberEl) orderNumberEl.textContent = `ORDER #${orderNumberStr}`;

    // Fetch order items with products
    const { data: orderItems, error: itemsError } = await supabase
      .from("order_items")
      .select("*, products(*)")
      .eq("order_id", order.id);

    if (!itemsError && orderItems && orderItems.length > 0) {
      const summaryContainer = document.getElementById("order-item-summary");
      if (summaryContainer) {
        const firstItem = orderItems[0];
        const p = firstItem.products || {};
        const safeImage = sanitizeUrl(p.image_url);
        const safeTitle = sanitizeShortText(p.title || firstItem.title, "Item");
        const safeCondition = sanitizeShortText(p.condition, "Condition unknown");
        
        const moreCount = orderItems.length - 1;
        const titleText = moreCount > 0 ? `${safeTitle} & ${moreCount} more` : safeTitle;

        summaryContainer.innerHTML = `
          <div class="rc-item">
            <img src="${safeImage}" alt="${safeTitle}" class="rc-item-img">
            <div class="rc-item-details">
              <div class="rc-item-title">${titleText}</div>
              <div class="rc-item-price">${safeCondition}</div>
            </div>
          </div>
        `;
      }

      // Populate totals from the order record
      const subtotalEl = document.getElementById("order-subtotal");
      if (subtotalEl) subtotalEl.textContent = `${window.formatCurrency(toSafeMoney(order.subtotal))}`;
      
      const totalEl = document.getElementById("order-total");
      if (totalEl) totalEl.textContent = `${window.formatCurrency(toSafeMoney(order.total))}`;

      const impactPointsEl = document.getElementById("impact-points");
      // Impact points = carbon_offset * 10
      // checkout.js saves totalCarbonOffset to order.carbon_credit
      if (impactPointsEl && order.carbon_credit) {
        impactPointsEl.textContent = Math.round(order.carbon_credit * 10);
      }
    }

    // Fetch 4 random active products for "Complete the Look"
    const { data: products, error: prodError } = await supabase
      .from("products")
      .select("*")
      .eq("status", "active")
      .limit(20);

    if (!prodError && products && products.length > 0) {
      const shuffled = products.sort(() => 0.5 - Math.random()).slice(0, 4);
      const grid = document.getElementById("recommendations-grid");
      if (grid) {
        grid.innerHTML = shuffled.map(p => {
          const safeTitle = sanitizeShortText(p.title);
          const safeImage = sanitizeUrl(p.image_url);
          const safePrice = toSafeMoney(p.price);
          return `
            <a href="#" class="product-card" data-route="shop">
              <img src="${safeImage}" alt="${safeTitle}" class="product-img" style="background: #fbfaf9;">
              <div class="product-info">
                <h3 class="product-title">${safeTitle}</h3>
                <div class="product-price">${window.formatCurrency(safePrice)}</div>
              </div>
            </a>
          `;
        }).join('');
      }
    }

  } catch (err) {
    console.error("Error in confirmation:", err);
  }
}
