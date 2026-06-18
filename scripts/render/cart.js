import { isUuid, sanitizeShortText, sanitizeUrl, toSafeMoney, toSafeNumber } from "../security.js";
import { getSupabaseClient } from "../supabaseClient.js";
import { showToast } from "../ui.js";

export async function renderCart() {
  const container = document.getElementById("router-view");
  if (!container) return;

  const loadingEl = document.getElementById("cart-loading");
  const unauthEl = document.getElementById("cart-unauth");
  const emptyEl = document.getElementById("cart-empty");
  const errorEl = document.getElementById("cart-error");
  const contentEl = document.getElementById("cart-content");

  const itemsContainer = document.getElementById("cart-items-container");
  const subtitleEl = document.getElementById("cart-subtitle");
  const subtotalEl = document.getElementById("summary-subtotal");
  const offsetEl = document.getElementById("summary-offset");
  const totalEl = document.getElementById("summary-total");

  if (!loadingEl || !itemsContainer) return;

  function showSection(section) {
    [loadingEl, unauthEl, emptyEl, errorEl, contentEl].forEach(el => {
      if (el) el.classList.add("hidden");
    });
    if (section) section.classList.remove("hidden");
  }

  showSection(loadingEl);

  try {
    const supabase = await getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      showSection(unauthEl);
      return;
    }

    const loadItems = async () => {
      let { data: cartItems, error } = await supabase
        .from("cart_items")
        .select("*, products(*)")
        .eq("user_id", session.user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      cartItems = cartItems || [];

      // Check for accepted offers to apply discounts & inject into cart
      const { data: offers } = await supabase
        .from("offers")
        .select("id, product_id, amount, products(*)")
        .eq("buyer_id", session.user.id)
        .eq("status", "accepted");
        
      if (offers && offers.length > 0) {
        // Find offers not in cart
        const missingOffers = offers.filter(o => !cartItems.some(c => c.product_id === o.product_id));
        
        for (const o of missingOffers) {
            if (o.products) {
                cartItems.push({
                    id: 'offer_' + o.id, // virtual ID
                    user_id: session.user.id,
                    product_id: o.product_id,
                    quantity: 1,
                    created_at: new Date().toISOString(),
                    products: o.products
                });
            }
        }

        cartItems.forEach(item => {
          const offer = offers.find(o => o.product_id === item.product_id);
          if (offer && item.products) {
            item.products.original_price = item.products.price;
            item.products.price = offer.amount; // Override with accepted offer price
            item.has_offer_discount = true;
          }
        });
      }

      return cartItems;
    };

    let cartItems = await loadItems();

    if (cartItems.length === 0) {
      showSection(emptyEl);
      return;
    }

    const updateSummary = () => {
      const subtotal = cartItems.reduce((sum, item) => {
        return sum + (toSafeNumber(item.products?.price) * toSafeNumber(item.quantity, 1));
      }, 0);
      
      const shipping = 0; // Free Conscious Shipping
      const totalQuantity = cartItems.reduce((sum, item) => sum + toSafeNumber(item.quantity, 1), 0);
      const carbonOffset = totalQuantity * 4; // Assuming $4 offset per item
      
      const total = subtotal + shipping - carbonOffset;

      if (subtotalEl) subtotalEl.textContent = `${window.formatCurrency(subtotal)}`;
      if (offsetEl) offsetEl.textContent = `-${window.formatCurrency(carbonOffset)}`;
      if (totalEl) totalEl.textContent = `${window.formatCurrency(Math.max(0, total))}`;
      if (subtitleEl) subtitleEl.textContent = `${totalQuantity} treasures curated for a more sustainable home.`;
    };

    const renderItems = () => {
      itemsContainer.innerHTML = cartItems.map((item) => {
        const product = item.products ?? {};
        const safeTitle = sanitizeShortText(product.title, "Cart item");
        const safeCategory = sanitizeShortText(product.category, "Furniture");
        const safeCondition = sanitizeShortText(product.condition, "Excellent");
        const safeImage = sanitizeUrl(product.image_url);
        const safePriceNum = toSafeNumber(product.price);
        const safePrice = safePriceNum.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        const safeQty = toSafeNumber(item.quantity, 1);
        const safeCartId = sanitizeShortText(item.id);

        let priceHtml = `<div class="cart-item-price">${window.formatCurrency(safePrice)}</div>`;
        if (item.has_offer_discount) {
          const origPrice = toSafeNumber(product.original_price).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
          priceHtml = `
            <div class="cart-item-price" style="display:flex; flex-direction:column; align-items:flex-end;">
              <span style="font-size:12px; color:#a8a29e; text-decoration:line-through;">${window.formatCurrency(origPrice)}</span>
              <span style="color:#3d5a30;">${window.formatCurrency(safePrice)}</span>
              <span style="background:#dcfce7; color:#166534; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700; text-transform:uppercase; margin-top:4px;">Offer Accepted</span>
            </div>
          `;
        }

        return `
        <article class="cart-item">
          <img src="${safeImage}" alt="${safeTitle}">
          <div class="cart-item-info">
            <h3>${safeTitle}</h3>
            <span>${safeCondition} - ${safeCategory}</span>
            <div class="cart-item-controls">
              <div class="qty-adjuster">
                <button class="qty-btn minus" data-id="${safeCartId}">-</button>
                <span>${safeQty}</span>
                <button class="qty-btn plus" data-id="${safeCartId}">+</button>
              </div>
              <button class="remove-btn" data-id="${safeCartId}">Remove</button>
            </div>
          </div>
          ${priceHtml}
        </article>`;
      }).join("");

      bindEvents();
    };

    const bindEvents = () => {
      itemsContainer.querySelectorAll('.qty-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.target.dataset.id;
          const isPlus = e.target.classList.contains('plus');
          const item = cartItems.find(i => i.id === id);
          if (!item) return;

          let newQty = isPlus ? item.quantity + 1 : item.quantity - 1;
          if (newQty < 1) newQty = 1;
          
          const maxStock = toSafeNumber(item.products?.stock, 1);
          if (newQty > maxStock) {
            showToast(`Hanya tersisa ${maxStock} stok!`);
            return;
          }
          if (newQty === item.quantity) return;

          e.target.disabled = true;
          
          const { error } = await supabase
            .from("cart_items")
            .update({ quantity: newQty })
            .eq("id", id);
            
          e.target.disabled = false;

          if (error) {
            showToast("Failed to update quantity");
          } else {
            item.quantity = newQty;
            renderItems();
            updateSummary();
            if (window.updateGlobalCartBadge) await window.updateGlobalCartBadge();
          }
        });
      });

      itemsContainer.querySelectorAll('.remove-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const id = e.target.dataset.id;
          if (!isUuid(id)) {
            showToast("Invalid cart item.");
            return;
          }

          e.target.textContent = "Removing...";
          e.target.disabled = true;

          const { error } = await supabase
            .from("cart_items")
            .delete()
            .eq("id", id)
            .eq("user_id", session.user.id);

          if (error) {
            showToast("Failed to remove item");
            e.target.textContent = "Remove";
            e.target.disabled = false;
          } else {
            cartItems = cartItems.filter(i => i.id !== id);
            if (cartItems.length === 0) {
              showSection(emptyEl);
            } else {
              renderItems();
              updateSummary();
            }
            showToast("Item removed from cart");
            if (window.updateGlobalCartBadge) await window.updateGlobalCartBadge();
          }
        });
      });
    };

    renderItems();
    updateSummary();
    showSection(contentEl);

  } catch (err) {
    console.error("Cart error:", err);
    showSection(errorEl);
  }
}
