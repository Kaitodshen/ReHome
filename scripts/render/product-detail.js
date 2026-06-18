import { getRouteParams, navigate, setRouteParams } from "../router.js";
import { getSupabaseClient } from "../supabaseClient.js";
import { clampInteger, isUuid, sanitize, sanitizeShortText, sanitizeUrl, toSafeMoney } from "../security.js";
import { showToast } from "../ui.js";

let productImages = [];
let favoriteIds = JSON.parse(localStorage.getItem("rehome_favorites") || "[]");

export async function renderProductDetail() {
  const container = document.getElementById("router-view");
  if (!container) return;

  const { productId } = getRouteParams();
  if (!productId) { navigate("shop"); return; }
  if (!isUuid(productId)) { navigate("shop"); return; }

  try {
    const supabase = await getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    let isVaultOwner = false;
    let vaultedOrderItemId = null;

    if (user) {
       const { data: favs } = await supabase.from('favorites').select('product_id').eq('user_id', user.id);
       if (favs) favoriteIds = favs.map(f => f.product_id);

       const { data: orderItemData } = await supabase
          .from('order_items')
          .select('id, delivery_status, orders!inner(user_id)')
          .eq('product_id', productId)
          .eq('orders.user_id', user.id)
          .eq('delivery_status', 'vaulted')
          .limit(1)
          .maybeSingle();
       
       if (orderItemData) {
          isVaultOwner = true;
          vaultedOrderItemId = orderItemData.id;
       }
    } else {
       favoriteIds = JSON.parse(localStorage.getItem("rehome_favorites") || "[]");
    }

    const { data: product, error } = await supabase.from('products').select(`
      *,
      profiles:seller_id (shop_name, full_name, avatar_url)
    `).eq('id', productId).single();
    if (error || !product) throw new Error("Item tidak ditemukan.");

    const seller = product.profiles || {};
    const safeMaker = sanitizeShortText(seller.shop_name || seller.full_name || product.maker || 'Elena Studio');
    const defaultAvatar = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23d6d3d1'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/></svg>";
    const safeSellerAvatar = sanitizeUrl(seller.avatar_url || defaultAvatar);

    const mainImageUrl = sanitizeUrl(product.image_url);
    const dbImageUrls = Array.isArray(product.image_urls) && product.image_urls.length > 0 
      ? product.image_urls.map(u => sanitizeUrl(u)) 
      : [mainImageUrl, mainImageUrl, mainImageUrl];
    
    productImages = dbImageUrls;
    
    const safeTitle = sanitizeShortText(product.title, "Untitled item");
    const safeCategory = sanitizeShortText(product.category || "Living Room");
    const safeCondition = sanitizeShortText(product.condition || "Excellent");
    const safeDescription = sanitize(product.description || 'A masterpiece of influence, this item features solid craftsmanship. The material is a sustainable blend offering both durability and a soft tactile experience.');
    const safePrice = toSafeMoney(product.price);

    const stockTersedia = clampInteger(product.stock ?? 1, 0, 999, 1);
    const isActiveClass = favoriteIds.includes(product.id) ? "active" : "";

    let cartButtonHtml = '';
    if (isVaultOwner) {
       cartButtonHtml = `
         <div style="display: flex; gap: 16px;">
           <button class="btn-resell-vault" data-item-id="${vaultedOrderItemId}" style="flex: 1; padding: 16px; background-color: #f5f4f0; color: #1c1917; border: 1px solid #d6d3d1; border-radius: 12px; font-size: 16px; font-weight: 600; cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='#e7e5e4'" onmouseout="this.style.background='#f5f4f0'">Resell</button>
           <button class="btn-deliver-vault" data-item-id="${vaultedOrderItemId}" style="flex: 1; padding: 16px; background-color: #3d5a30; color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: 600; cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='#526442'" onmouseout="this.style.background='#3d5a30'">Deliver</button>
         </div>
       `;
    } else if (product.status === 'sold' || stockTersedia <= 0) {
       cartButtonHtml = `<div style="width: 100%; padding: 16px; background-color: #f5f5f4; color: #78716c; border-radius: 12px; font-size: 16px; font-weight: 600; text-align: center;">Out of Stock</div>`;
    } else if (user && user.id === product.seller_id) {
       cartButtonHtml = `<div style="width: 100%; padding: 16px; background-color: #f5f5f4; color: #78716c; border-radius: 12px; font-size: 16px; font-weight: 600; text-align: center;">You own this item</div>`;
    } else {
       cartButtonHtml = `
            <button id="add-to-cart-btn" style="width: 100%; padding: 16px; background-color: #556b45; color: white; border: none; border-radius: 12px; font-size: 16px; font-weight: 600; cursor: pointer; transition: 0.2s; display: flex; justify-content: center; align-items: center; gap: 10px;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
              <span>Add to Cart</span>
            </button>`;
    }

    container.innerHTML = `
      <div style="max-width: 1200px; margin: 0 auto; padding: 40px 20px; font-family: var(--sans);">
        
        <div style="margin-bottom: 24px; font-size: 13px; color: #78716c;">
          <button type="button" id="product-back-shop" style="cursor:pointer; border:0; background:transparent; color:inherit; padding:0; font:inherit;">Shop</button> / 
          <span>${safeCategory}</span> / 
          <span style="color:#1c1917; font-weight:600;">${safeTitle}</span>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 60px;">
          
          <div>
            <div style="position: relative; width: 100%; aspect-ratio: 4/5; background: #f5f5f4; border-radius: 16px; overflow: hidden;">
              <button class="btn-favorite ${isActiveClass}" style="width: 44px; height: 44px; top: 16px; right: 16px; position: absolute; z-index: 10;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
              </button>
              <img src="${productImages[0]}" alt="${safeTitle}" style="width: 100%; height: 100%; object-fit: cover;" id="main-image">
              <div style="position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%); display: flex; gap: 6px; background: rgba(0,0,0,0.3); padding: 6px 12px; border-radius: 99px;">
                <div style="width: 6px; height: 6px; border-radius: 50%; background: white;"></div>
                <div style="width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.5);"></div>
                <div style="width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.5);"></div>
              </div>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-top: 16px;" id="thumb-gallery"></div>
          </div>

          <div style="padding-top: 10px;">
            <div class="pd-tag-pill" style="margin-bottom: 16px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#3d5a30"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
              Sustainably Sourced
            </div>
            
            <h1 style="font-family: var(--serif); font-size: 42px; color: #1c1917; margin: 0 0 16px 0; line-height: 1.1;">${safeTitle}</h1>
            <div style="font-size: 28px; color: #78716c; font-weight: 500; margin-bottom: 32px;">${window.formatCurrency(safePrice)}</div>
            
            <div style="margin-bottom: 24px;">
              <span style="font-size: 13px; color: #78716c; display: block; margin-bottom: 8px;">Condition</span>
              <div style="display: flex; gap: 12px;">
                <div class="pd-condition-pill" style="background: #fbfaf9; border-color: #3d5a30; color: #3d5a30;">${safeCondition} (Pre-owned)</div>
                <div class="pd-condition-pill">Refurbished</div>
              </div>
            </div>

            <p style="color: #57534e; line-height: 1.6; margin-bottom: 32px; font-size: 15px;">
              ${safeDescription}
            </p>

            <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px;">
              <div class="qty-selector">
                <button class="qty-btn" id="btn-min">−</button>
                <input type="text" class="qty-input" id="qty-val" value="1" readonly>
                <button class="qty-btn" id="btn-plus">+</button>
              </div>
              <span style="color: #c2410c; font-size: 13px; font-weight: 500;">Only ${stockTersedia} in stock</span>
            </div>

            ${cartButtonHtml}
            
            ${(!isVaultOwner && product.status !== 'sold' && stockTersedia > 0 && (!user || user.id !== product.seller_id)) ? `<button class="btn-outline" id="make-offer-btn">Make an Offer</button>` : ''}

            <!-- Offer Modal -->
            <div id="offer-modal" style="display:none; position:fixed; inset:0; z-index:99999; background:rgba(0,0,0,0.5); backdrop-filter:blur(4px); align-items:center; justify-content:center;">
              <div style="background:white; border-radius:20px; padding:40px; max-width:440px; width:90%; box-shadow:0 24px 48px rgba(0,0,0,0.15); position:relative;">
                <button id="offer-modal-close" style="position:absolute; top:16px; right:16px; background:none; border:none; font-size:24px; color:#78716c; cursor:pointer;">×</button>
                <h3 style="font-family:var(--serif); font-size:24px; margin:0 0 8px; color:#1c1917;">Make an Offer</h3>
                <p style="color:#78716c; font-size:14px; margin:0 0 24px;">Submit your best price for <strong>${safeTitle}</strong></p>
                
                <div style="background:#f5f4f0; border-radius:12px; padding:16px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-size:13px; color:#78716c; font-weight:600;">Listed Price</span>
                  <span style="font-size:20px; font-weight:700; color:#3d5a30;">${window.formatCurrency(safePrice)}</span>
                </div>
                
                <label style="display:block; margin-bottom:16px;">
                  <span style="font-size:11px; font-weight:800; letter-spacing:1px; text-transform:uppercase; color:#1c1917; display:block; margin-bottom:8px;">Your Offer ($)</span>
                  <input type="number" id="offer-amount" min="1" step="1" placeholder="Enter your offer" style="width:100%; padding:14px 16px; border:1px solid #d6d3d1; border-radius:12px; font-size:16px; font-weight:600; outline:none; box-sizing:border-box; transition:border-color 0.2s;" onfocus="this.style.borderColor='#3d5a30'" onblur="this.style.borderColor='#d6d3d1'">
                </label>
                
                <label style="display:block; margin-bottom:24px;">
                  <span style="font-size:11px; font-weight:800; letter-spacing:1px; text-transform:uppercase; color:#1c1917; display:block; margin-bottom:8px;">Message (Optional)</span>
                  <textarea id="offer-message" rows="3" placeholder="Tell the seller why you love this item..." style="width:100%; padding:14px 16px; border:1px solid #d6d3d1; border-radius:12px; font-size:14px; outline:none; resize:none; font-family:var(--sans); box-sizing:border-box; transition:border-color 0.2s;" onfocus="this.style.borderColor='#3d5a30'" onblur="this.style.borderColor='#d6d3d1'"></textarea>
                </label>
                
                <button id="offer-submit-btn" style="width:100%; padding:16px; background:#3d5a30; color:white; border:none; border-radius:12px; font-size:16px; font-weight:700; cursor:pointer; transition:0.2s;">Submit Offer</button>
              </div>
            </div>

            <div class="seller-box">
              <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 48px; height: 48px; background: #e7e5e4; border-radius: 50%; overflow: hidden;">
                  <img src="${safeSellerAvatar}" alt="${safeMaker}" style="width:100%; height:100%; object-fit:cover;">
                </div>
                <div>
                  <div style="font-weight: 600; font-size: 15px; color: #1c1917;">${safeMaker}</div>
                  <div style="font-size: 12px; color: #78716c; margin-top: 2px;">★ 4.9 (124 reviews)</div>
                </div>
              </div>
              <span id="view-shop-btn" style="font-size: 13px; font-weight: 600; color: #78716c; cursor: pointer;">View Shop</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Lightbox Overlay -->
      <div id="pd-lightbox" style="display: none; position: fixed; inset: 0; z-index: 99999; background: rgba(0,0,0,0.9); align-items: center; justify-content: center; flex-direction: column;">
        <div style="position: absolute; top: 20px; right: 20px; color: white; font-size: 30px; cursor: pointer;" id="lightbox-close">×</div>
        <div style="position: absolute; left: 20px; top: 50%; color: white; font-size: 40px; cursor: pointer; transform: translateY(-50%);" id="lightbox-prev">‹</div>
        <img id="lightbox-img" src="" style="max-width: 90%; max-height: 90%; object-fit: contain;">
        <div style="position: absolute; right: 20px; top: 50%; color: white; font-size: 40px; cursor: pointer; transform: translateY(-50%);" id="lightbox-next">›</div>
      </div>
    `;

    document.getElementById("view-shop-btn")?.addEventListener("click", () => {
      setRouteParams({ id: product.seller_id });
      navigate("seller-profile");
    });

    document.getElementById("product-back-shop")?.addEventListener("click", () => navigate("shop"));

    const thumbGallery = document.getElementById("thumb-gallery");
    if (thumbGallery) {
      thumbGallery.innerHTML = productImages.slice(0, 4).map((src, i) => {
        const isLast = i === 3 && productImages.length > 4;
        return `
          <div class="thumb-item" data-index="${i}" style="position: relative; aspect-ratio: 1; border-radius: 12px; overflow: hidden; cursor: pointer; border: 2px solid ${i===0 ? '#3d5a30' : 'transparent'};">
            <img src="${src}" style="width: 100%; height: 100%; object-fit: cover;">
            ${isLast ? `<div style="position: absolute; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 14px;">+${productImages.length - 3} View</div>` : ''}
          </div>
        `;
      }).join('');
    }

    // Lightbox Logic
    let currentLbIndex = 0;
    const lightbox = document.getElementById("pd-lightbox");
    const lbImg = document.getElementById("lightbox-img");
    const mainImgEl = document.getElementById("main-image");

    const openLightbox = (index) => {
      currentLbIndex = index;
      lbImg.src = productImages[currentLbIndex];
      lightbox.style.display = "flex";
    };

    mainImgEl?.addEventListener("click", () => openLightbox(0));
    mainImgEl.style.cursor = "pointer";

    document.querySelectorAll(".thumb-item").forEach(el => {
      el.addEventListener("click", (e) => {
        const idx = parseInt(el.getAttribute("data-index"), 10);
        mainImgEl.src = productImages[idx];
        document.querySelectorAll(".thumb-item").forEach(t => t.style.borderColor = 'transparent');
        el.style.borderColor = '#3d5a30';
        if (e.target.closest('div').innerHTML.includes('+')) {
          openLightbox(idx);
        } else {
          currentLbIndex = idx; // update index for main image click
        }
      });
    });

    document.getElementById("lightbox-close")?.addEventListener("click", () => lightbox.style.display = "none");
    document.getElementById("lightbox-prev")?.addEventListener("click", (e) => {
      e.stopPropagation();
      currentLbIndex = (currentLbIndex - 1 + productImages.length) % productImages.length;
      lbImg.src = productImages[currentLbIndex];
    });
    document.getElementById("lightbox-next")?.addEventListener("click", (e) => {
      e.stopPropagation();
      currentLbIndex = (currentLbIndex + 1) % productImages.length;
      lbImg.src = productImages[currentLbIndex];
    });
    lightbox.addEventListener("click", (e) => {
      if (e.target === lightbox) lightbox.style.display = "none";
    });

    const favBtn = container.querySelector(".btn-favorite");
    favBtn.addEventListener("click", async () => {
      favBtn.classList.toggle("active");
      const isActive = favBtn.classList.contains("active");
      favBtn.style.pointerEvents = "none";
      
      try {
        if (user) {
          if (isActive) {
            if (!favoriteIds.includes(product.id)) favoriteIds.push(product.id);
            await supabase.from('favorites').insert({ user_id: user.id, product_id: product.id });
            showToast("Added to favorites!");
          } else {
            favoriteIds = favoriteIds.filter(id => id !== product.id);
            await supabase.from('favorites').delete().eq('user_id', user.id).eq('product_id', product.id);
            showToast("Removed from favorites.");
          }
        } else {
          if (isActive) {
            if (!favoriteIds.includes(product.id)) favoriteIds.push(product.id);
            showToast("Saved! (Login to keep permanently)");
          } else {
            favoriteIds = favoriteIds.filter(id => id !== product.id);
            showToast("Removed from favorites.");
          }
          localStorage.setItem("rehome_favorites", JSON.stringify(favoriteIds));
        }
      } catch (err) {
        console.error("Favorite error:", err);
        favBtn.classList.toggle("active");
        showToast("Error updating favorites.");
      } finally {
        favBtn.style.pointerEvents = "auto";
      }
    });

    const btnMin = document.getElementById("btn-min");
    const btnPlus = document.getElementById("btn-plus");
    const qtyInput = document.getElementById("qty-val");
    let currentQty = 1;

    btnMin.addEventListener("click", () => { if (currentQty > 1) { currentQty--; qtyInput.value = currentQty; } });
    btnPlus.addEventListener("click", () => {
      if (currentQty < stockTersedia) { currentQty++; qtyInput.value = currentQty; }
      else { showToast(`Hanya tersisa ${stockTersedia} stok!`); }
    });

    const btnCart = document.getElementById("add-to-cart-btn");
    if (btnCart) {
      btnCart.addEventListener("click", async (e) => {
        e.preventDefault(); e.stopPropagation();
        const requestedQty = clampInteger(qtyInput.value, 1, stockTersedia, 1);
        btnCart.disabled = true; btnCart.style.opacity = "0.7";
        const originalText = btnCart.innerHTML;
        btnCart.querySelector("span").textContent = "Checking...";
        
        try {
            if (!user) { alert("Sesi login belum aktif. Silakan Login."); return; }

            const { data: existingCarts, error: checkErr } = await supabase.from('cart_items').select('id, quantity').eq('user_id', user.id).eq('product_id', product.id);
            if (checkErr) throw new Error(checkErr.message);

            let qtyInDb = existingCarts && existingCarts.length > 0 ? existingCarts[0].quantity : 0;

            if (qtyInDb + requestedQty > stockTersedia) { showToast(`Gagal! Sisa kuota beli untuk item ini: ${stockTersedia - qtyInDb}`); return; }
            
            btnCart.querySelector("span").textContent = "Syncing...";
            flyToCart(e.clientX, e.clientY, productImages[0]);

            if (existingCarts && existingCarts.length > 0) {
               const { error: updErr } = await supabase.from('cart_items').update({ quantity: qtyInDb + requestedQty }).eq('id', existingCarts[0].id);
               if (updErr) throw new Error(updErr.message);
            } else {
               const { error: insErr } = await supabase.from('cart_items').insert({ user_id: user.id, product_id: product.id, quantity: requestedQty });
               if (insErr) throw new Error(insErr.message);
            }
               
            showToast(`Added ${requestedQty}x ${safeTitle} to cart.`);
            if (window.updateGlobalCartBadge) await window.updateGlobalCartBadge();

        } catch (err) { 
            console.error(err); 
            showToast("Gagal menyimpan ke database: " + err.message);
        } finally { 
            btnCart.innerHTML = originalText; btnCart.disabled = false; btnCart.style.opacity = "1"; 
        }
      });
    }

    // ─── MAKE AN OFFER LOGIC ───
    const offerBtn = document.getElementById('make-offer-btn');
    const offerModal = document.getElementById('offer-modal');
    const offerClose = document.getElementById('offer-modal-close');
    const offerSubmit = document.getElementById('offer-submit-btn');

    if (offerBtn && offerModal) {
      offerBtn.addEventListener('click', () => {
        if (!user) { showToast('Please log in to make an offer.'); return; }
        offerModal.style.display = 'flex';
      });

      offerClose?.addEventListener('click', () => { offerModal.style.display = 'none'; });
      offerModal.addEventListener('click', (e) => { if (e.target === offerModal) offerModal.style.display = 'none'; });

      offerSubmit?.addEventListener('click', async () => {
        const amount = parseFloat(document.getElementById('offer-amount')?.value);
        const message = document.getElementById('offer-message')?.value?.trim() || '';

        if (!amount || amount <= 0) { showToast('Please enter a valid offer amount.'); return; }
        if (amount >= product.price) { showToast('Your offer should be lower than the listed price. Otherwise, just buy it!'); return; }

        offerSubmit.disabled = true;
        offerSubmit.textContent = 'Submitting...';

        try {
          const { error } = await supabase.from('offers').insert({
            product_id: product.id,
            buyer_id: user.id,
            seller_id: product.seller_id,
            amount: amount,
            message: message,
            status: 'pending'
          });

          if (error) throw error;
          showToast('Offer submitted! The seller will review it.');
          offerModal.style.display = 'none';
          document.getElementById('offer-amount').value = '';
          document.getElementById('offer-message').value = '';
        } catch (err) {
          console.error('Offer error:', err);
          showToast('Failed to submit offer: ' + err.message);
        } finally {
          offerSubmit.disabled = false;
          offerSubmit.textContent = 'Submit Offer';
        }
      });
    }

    const btnDeliver = document.querySelector('.btn-deliver-vault');
    if (btnDeliver) {
      btnDeliver.addEventListener('click', async (e) => {
        e.stopPropagation();
        btnDeliver.disabled = true;
        btnDeliver.textContent = 'Processing...';
        const itemId = btnDeliver.dataset.itemId;
        try {
          const { error } = await supabase.from('order_items').update({ delivery_status: 'delivered' }).eq('id', itemId);
          if (error) throw error;
          showToast("Delivery requested! The item is on its way.");
          navigate('profile'); // Send to profile to view delivery
        } catch (err) {
          showToast("Failed to request delivery.");
          btnDeliver.disabled = false;
          btnDeliver.textContent = 'Deliver';
        }
      });
    }

    const btnResell = document.querySelector('.btn-resell-vault');
    if (btnResell) {
      btnResell.addEventListener('click', async (e) => {
        e.stopPropagation();
        const itemId = btnResell.dataset.itemId;
        const productData = {
           title: safeTitle,
           price: safePrice,
           image_url: mainImageUrl,
           description: safeDescription,
           category: safeCategory,
           condition: safeCondition,
           maker: safeMaker,
           quantity: 1
        };
        
        localStorage.setItem('rehome_resell_data', JSON.stringify({ ...productData, order_item_id: itemId }));
        showToast("Setting up your resell listing...");
        navigate("new-listing");
      });
    }

  } catch (err) {
    console.warn("Gagal render produk:", err);
    container.innerHTML = `<div style="padding:100px; text-align:center;"><h2>Produk gagal dimuat.</h2></div>`;
  }
}

function flyToCart(startX, startY, imageUrl) {
  const cartIcon = document.querySelector('nav [data-route="cart"], header [data-route="cart"], .app-nav [data-route="cart"]');
  if (!cartIcon) return;
  const targetRect = cartIcon.getBoundingClientRect();
  const flyer = document.createElement("div");
  flyer.style.cssText = `position:fixed; width:60px; height:60px; border-radius:50%; background:#3d5a30; left:${startX-30}px; top:${startY-30}px; z-index:999999; box-shadow:0 10px 20px rgba(0,0,0,0.3); transition:all 0.8s cubic-bezier(0.25, 1, 0.5, 1); pointer-events:none;`;
  if (imageUrl) { flyer.style.backgroundImage = `url('${imageUrl}')`; flyer.style.backgroundSize = "cover"; flyer.style.backgroundPosition = "center"; }
  document.body.appendChild(flyer);

  if (!document.getElementById("cart-shake-style")) {
    document.head.insertAdjacentHTML("beforeend", `<style id="cart-shake-style">@keyframes cartPopShake { 0% { transform: scale(1) rotate(0deg); } 25% { transform: scale(1.3) rotate(-15deg); } 50% { transform: scale(1.3) rotate(15deg); } 75% { transform: scale(1.3) rotate(-15deg); } 100% { transform: scale(1) rotate(0deg); } } .cart-anim-pop { animation: cartPopShake 0.5s ease-in-out; }</style>`);
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      flyer.style.left = (targetRect.left + (targetRect.width/2) - 10) + "px"; flyer.style.top = (targetRect.top + (targetRect.height/2) - 10) + "px"; flyer.style.width = "20px"; flyer.style.height = "20px"; flyer.style.opacity = "0.3";
    });
  });

  setTimeout(() => {
    flyer.remove();
    cartIcon.classList.add("cart-anim-pop");
    setTimeout(() => cartIcon.classList.remove("cart-anim-pop"), 500);
  }, 800);
}
