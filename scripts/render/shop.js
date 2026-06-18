// scripts/render/shop.js
import { getSupabaseClient } from "../supabaseClient.js";
import { navigate, setRouteParams } from "../router.js";
import { showToast } from "../ui.js";

function sanitize(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, tag => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag] || tag));
}

let allProducts = [], filteredProducts = [], currentView = "grid", page = 0;
const PAGE_SIZE = 9;

// Menyimpan ID Favorit dari Database
let favoriteIds = [];
let cartMap = {};
let currentUser = null;

export async function renderShop() {
  const catalog = document.getElementById("shop-catalog") || document.querySelector(".product-grid");
  const countEl = document.querySelector(".shop-header p") || document.querySelector("p.sub");
  if (!catalog) return;

  try {
    const supabase = await getSupabaseClient();
    
    // 1. CEK USER & AMBIL FAVORIT DARI DATABASE
    const { data: { user } } = await supabase.auth.getUser();
    currentUser = user;

    if (currentUser) {
        // Ambil favorit permanen dari Supabase
        const { data: favs } = await supabase.from('favorites').select('product_id').eq('user_id', currentUser.id);
        if (favs) favoriteIds = favs.map(f => f.product_id);

        const { data: cartData } = await supabase.from('cart_items').select('product_id, quantity').eq('user_id', currentUser.id);
        if (cartData) {
            cartMap = {};
            cartData.forEach(item => cartMap[item.product_id] = item.quantity);
        }
    } else {
        // Jika belum login, simpan sementara di browser
        favoriteIds = JSON.parse(localStorage.getItem("rehome_favorites") || "[]");
        cartMap = {};
    }
  } catch (err) {
    console.error("Error init shop:", err);
  }

  await fetchProductsAndRender(catalog, countEl);
  bindShopControls(catalog, countEl);

  // Show search indicator if global search is active
  const searchBar = document.getElementById('shop-search-bar');
  const searchTerm = document.getElementById('shop-search-term');
  const clearBtn = document.getElementById('shop-clear-search');
  if (searchBar && window.rehomeSearchQuery) {
    searchBar.style.display = 'flex';
    if (searchTerm) searchTerm.textContent = window.rehomeSearchQuery;
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        window.rehomeSearchQuery = '';
        const globalInput = document.getElementById('global-search-input');
        if (globalInput) globalInput.value = '';
        searchBar.style.display = 'none';
        applyFilters(catalog, countEl);
      });
    }
  } else if (searchBar) {
    searchBar.style.display = 'none';
  }
}

async function fetchProductsAndRender(catalog, countEl) {
  catalog.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px;">Loading treasures...</div>`;
  try {
    const supabase = await getSupabaseClient();
    const showMyItemsCheckbox = document.getElementById("filter-show-my-items");
    const showMyItems = showMyItemsCheckbox ? showMyItemsCheckbox.checked : false;

    let query = supabase.from('products').select('*').eq('status', 'active').order('created_at', { ascending: false });

    if (currentUser && !showMyItems) {
      query = query.or(`seller_id.neq.${currentUser.id},seller_id.is.null`);
    }

    const { data } = await query;
    allProducts = data || [];
    page = 0;
    applyFilters(catalog, countEl);
  } catch (err) {
    catalog.innerHTML = `<div style="color:red; grid-column:1/-1; text-align:center;">Error loading products.</div>`;
  }
}


function renderPage(catalog, countEl) {
  if (countEl) countEl.textContent = `Discover ${filteredProducts.length} preloved gems.`;
  
  catalog.innerHTML = filteredProducts.slice(0, (page + 1) * PAGE_SIZE).map(p => {
    const isFav = favoriteIds.includes(p.id) ? "active" : "";
    
    // Sanitasi data agar aman dari XSS
    const safeTitle = sanitize(p.title);
    const safeCategory = sanitize(p.category || "Furniture");
    const safeCondition = sanitize(p.condition || "Excellent");
    const qty = cartMap[p.id] || 0;
    let cartControls = "";
    if (currentUser && p.seller_id === currentUser.id) {
      cartControls = `<div style="margin-top:12px; padding:8px 16px; background:#f5f5f4; color:#78716c; border-radius:8px; font-weight:600; text-align:center; font-size: 14px;">Your Listing</div>`;
    } else if (qty > 0) {
      cartControls = `
        <div class="cart-controls" style="display:flex; align-items:center; gap:12px; margin-top:12px;">
          <button class="btn-qty-minus" data-id="${p.id}" style="flex:1; padding:6px 12px; border:1px solid rgba(197, 200, 188, 0.5); border-radius:8px; background:white; cursor:pointer; font-weight:700; color:#1c1917;">-</button>
          <span style="font-weight:700; width: 20px; text-align:center;">${qty}</span>
          <button class="btn-qty-plus" data-id="${p.id}" style="flex:1; padding:6px 12px; border:1px solid rgba(197, 200, 188, 0.5); border-radius:8px; background:white; cursor:pointer; font-weight:700; color:#1c1917;">+</button>
        </div>
      `;
    } else {
      cartControls = `
        <button class="btn-add-cart" data-id="${p.id}" style="margin-top:12px; padding:8px 16px; background:#3d5a30; color:white; border:none; border-radius:8px; font-weight:600; cursor:pointer; width:100%;">Add to Cart</button>
      `;
    }
    
    return `
    <div class="prod-card" data-id="${p.id}" style="cursor:pointer; position:relative; overflow:hidden;">
      <button class="btn-favorite ${isFav}" title="Favorite" style="position: absolute; top: 12px; right: 12px; z-index: 10;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
      </button>
      <img class="prod-img" src="${p.image_url || 'assets/chair.jpg'}" loading="lazy" style="border-radius:12px;">
      <div class="prod-info" style="margin-top:12px;">
        <span style="font-size:12px;color:#78716c;font-weight:600;">${safeCondition} · ${safeCategory}</span>
        <h3 style="font-size:16px;margin:4px 0;">${safeTitle}</h3>
        <strong style="color:#3d5a30;">${window.formatCurrency(p.price)}</strong>
        ${cartControls}
      </div>
    </div>`;
  }).join("");

  // KLIK PRODUK KARTU
  catalog.querySelectorAll(".prod-card").forEach(card => {
    card.addEventListener("click", () => { 
        setRouteParams({ productId: card.dataset.id }); 
        navigate("product-detail"); 
    });
  });

  // CART BUTTONS
  catalog.querySelectorAll(".btn-add-cart").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await updateCartItem(btn.dataset.id, 1, catalog, countEl);
    });
  });

  catalog.querySelectorAll(".btn-qty-minus").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      await updateCartItem(id, (cartMap[id] || 1) - 1, catalog, countEl);
    });
  });

  catalog.querySelectorAll(".btn-qty-plus").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      await updateCartItem(id, (cartMap[id] || 1) + 1, catalog, countEl);
    });
  });

  catalog.querySelectorAll(".btn-favorite").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation(); 
      const prodId = btn.closest(".prod-card").dataset.id;
      
      // Matikan tombol sementara agar tidak dobel klik
      btn.style.pointerEvents = "none";
      btn.classList.toggle("active");
      const isActive = btn.classList.contains("active");

      try {
          if (currentUser) {
              const supabase = await getSupabaseClient();
              if (isActive) {
                  // Simpan ke Database
                  favoriteIds.push(prodId);
                  await supabase.from('favorites').insert({ user_id: currentUser.id, product_id: prodId });
                  showToast("Saved to your favorites!");
              } else {
                  // Hapus dari Database
                  favoriteIds = favoriteIds.filter(id => id !== prodId);
                  await supabase.from('favorites').delete().eq('user_id', currentUser.id).eq('product_id', prodId);
                  showToast("Removed from favorites.");
              }
          } else {
              // Fallback (Guest) -> Simpan di browser
              if (isActive) {
                  if (!favoriteIds.includes(prodId)) favoriteIds.push(prodId);
                  showToast("Saved! (Login to keep permanently)");
              } else {
                  favoriteIds = favoriteIds.filter(id => id !== prodId);
                  showToast("Removed from favorites.");
              }
              localStorage.setItem("rehome_favorites", JSON.stringify(favoriteIds));
          }
      } catch (err) {
          console.error("Gagal sinkronisasi favorit:", err);
          showToast("Error saving favorite.");
          btn.classList.toggle("active"); // Rollback tampilan jika error
      } finally {
          btn.style.pointerEvents = "auto";
      }
    });
  });
}

function bindShopControls(catalog, countEl) {
  // LOGIKA "SORT BY" CUSTOM
  const nativeSelect = document.querySelector(".sort-select");
  if (nativeSelect && !document.querySelector(".custom-sort-wrapper")) {
     nativeSelect.style.display = "none";
     
     const wrapper = document.createElement("div");
     wrapper.className = "custom-sort-wrapper";
     wrapper.style.cssText = "position: relative; display: inline-block; cursor: pointer; user-select: none;";
     
     const selectedText = document.createElement("div");
     selectedText.innerHTML = `<span style="margin-right:8px;">${nativeSelect.options[nativeSelect.selectedIndex]?.text || 'Sort by'}</span> <svg width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 1l5 5 5-5"/></svg>`;
     selectedText.style.cssText = "font-weight: 700; color: #1c1917; display: flex; align-items: center; font-size: 15px;";
     
     const optionsList = document.createElement("div");
     optionsList.style.cssText = "position: absolute; top: 100%; right: 0; background: white; border: 1px solid #c9c8bd; box-shadow: 0 4px 12px rgba(0,0,0,0.1); width: 160px; z-index: 100; display: none; flex-direction: column; overflow: hidden; margin-top: 8px;";
     
     Array.from(nativeSelect.options).forEach(opt => {
        const optionEl = document.createElement("div");
        optionEl.textContent = opt.text;
        optionEl.style.cssText = "padding: 10px 16px; font-size: 14px; font-weight: 500; color: #1c1917; transition: 0.1s;";
        optionEl.onmouseover = () => { optionEl.style.background = "#3b82f6"; optionEl.style.color = "white"; };
        optionEl.onmouseout = () => { optionEl.style.background = "transparent"; optionEl.style.color = "#1c1917"; };
        optionEl.onclick = (e) => {
           e.stopPropagation();
           nativeSelect.value = opt.value;
           selectedText.querySelector("span").textContent = opt.text;
           optionsList.style.display = "none";
           applyFilters(catalog, countEl); 
        };
        optionsList.appendChild(optionEl);
     });
     
     wrapper.appendChild(selectedText); wrapper.appendChild(optionsList);
     nativeSelect.parentNode.insertBefore(wrapper, nativeSelect.nextSibling);
     
     selectedText.onclick = (e) => { e.stopPropagation(); optionsList.style.display = optionsList.style.display === "none" ? "flex" : "none"; };
     document.addEventListener("click", () => optionsList.style.display = "none");
  }

  // TAMPILAN GRID / LIST
  const svgs = document.querySelectorAll('.shop-header svg, .view-toggle svg');
  svgs.forEach(svg => {
    if (svg.closest('.custom-sort-wrapper')) return; 
    if (svg.innerHTML.includes('rect') && svg.querySelectorAll('rect').length >= 4) svg.closest('button, div').dataset.viewMode = 'grid';
    else if (svg.innerHTML.includes('line') || svg.innerHTML.includes('path')) svg.closest('button, div').dataset.viewMode = 'list';
  });

  document.querySelectorAll("[data-view-mode]").forEach(btn => {
    btn.style.cursor = "pointer";
    btn.addEventListener("click", () => {
      currentView = btn.dataset.viewMode;
      document.querySelectorAll("[data-view-mode]").forEach(b => b.style.opacity = "0.4");
      btn.style.opacity = "1"; btn.style.background = currentView === "grid" ? "#f5f5f4" : "transparent";
      catalog.className = `product-grid ${currentView === "list" ? " list-view" : ""}`;
    });
  });

  // SLIDER HARGA
  const rMin = document.querySelector(".range-min"), rMax = document.querySelector(".range-max"), iMin = document.getElementById("input-min"), iMax = document.getElementById("input-max"), track = document.querySelector(".slider-track");
  function updateTrack() { if(track && rMin && rMax) { track.style.left = (rMin.value/20000)*100 + "%"; track.style.right = 100 - (rMax.value/20000)*100 + "%"; } }
  
  if (rMin && rMax) {
    updateTrack();
    rMin.addEventListener("input", () => { if(parseInt(rMin.value) > parseInt(rMax.value)-100) rMin.value = parseInt(rMax.value)-100; iMin.value = rMin.value; updateTrack(); applyFilters(catalog, countEl); });
    rMax.addEventListener("input", () => { if(parseInt(rMax.value) < parseInt(rMin.value)+100) rMax.value = parseInt(rMin.value)+100; iMax.value = rMax.value; updateTrack(); applyFilters(catalog, countEl); });
  }
  if (iMin && iMax) {
    iMin.addEventListener("change", () => { rMin.value = iMin.value; updateTrack(); applyFilters(catalog, countEl); });
    iMax.addEventListener("change", () => { rMax.value = iMax.value; updateTrack(); applyFilters(catalog, countEl); });
  }
  
  const showMyItemsCheckbox = document.getElementById("filter-show-my-items");
  if (showMyItemsCheckbox) {
    showMyItemsCheckbox.addEventListener("change", () => {
      fetchProductsAndRender(catalog, countEl);
    });
  }
  
  document.querySelectorAll(".chip, .custom-checkbox input").forEach(el => {
    if (el.id === "filter-show-my-items") return;
    el.addEventListener("change", () => applyFilters(catalog, countEl));
  });
  document.querySelectorAll(".chip").forEach(el => el.addEventListener("click", () => { el.classList.toggle("active"); applyFilters(catalog, countEl); }));

  const loadMoreBtn = document.querySelector('.load-more-btn');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      if ((page + 1) * PAGE_SIZE < filteredProducts.length) {
        page++;
        renderPage(catalog, countEl);
      } else {
        showToast("All available treasures are already loaded!");
      }
    });
  }
}

function applyFilters(catalog, countEl) {
  let res = [...allProducts];
  
  // TEXT SEARCH (from global search bar or shop search)
  const searchQuery = (window.rehomeSearchQuery || '').toLowerCase().trim();
  if (searchQuery) {
    res = res.filter(p => 
      (p.title || '').toLowerCase().includes(searchQuery) ||
      (p.maker || '').toLowerCase().includes(searchQuery) ||
      (p.description || '').toLowerCase().includes(searchQuery) ||
      (p.category || '').toLowerCase().includes(searchQuery)
    );
  }
  
  const cats = Array.from(document.querySelectorAll(".custom-checkbox input:checked")).map(cb => cb.closest("label").textContent.trim());
  if (cats.length && !cats.includes("All Furniture")) res = res.filter(p => cats.some(c => p.category?.toLowerCase() === c.toLowerCase()));
  const conds = Array.from(document.querySelectorAll(".chip.active")).map(c => c.textContent.trim());
  if (conds.length) res = res.filter(p => conds.some(c => p.condition?.toLowerCase() === c.toLowerCase()));
  const min = parseFloat(document.getElementById("input-min")?.value) || 0, max = parseFloat(document.getElementById("input-max")?.value) || 999999;
  res = res.filter(p => p.price >= min && p.price <= max);
  const sort = document.querySelector(".sort-select")?.value;
  if (sort?.includes("Low to High")) res.sort((a, b) => a.price - b.price); else if (sort?.includes("High to Low")) res.sort((a, b) => b.price - a.price);
  filteredProducts = res; renderPage(catalog, countEl);
}

async function updateCartItem(productId, newQty, catalog, countEl) {
  if (!currentUser) {
    showToast("Please login to add to cart.");
    return;
  }

  const product = allProducts.find(p => p.id === productId);
  const maxStock = product ? (product.stock !== null ? product.stock : 1) : 1;

  if (newQty > maxStock) {
    showToast(`Hanya tersisa ${maxStock} stok!`);
    return;
  }
  
  const oldQty = cartMap[productId] || 0;
  
  // Optimistic UI update
  if (newQty <= 0) {
    delete cartMap[productId];
  } else {
    cartMap[productId] = newQty;
  }
  renderPage(catalog, countEl);
  
  try {
    const supabase = await getSupabaseClient();
    if (newQty <= 0) {
      await supabase.from('cart_items').delete().eq('user_id', currentUser.id).eq('product_id', productId);
      showToast("Removed from cart.");
    } else {
      if (oldQty > 0) {
        await supabase.from('cart_items').update({ quantity: newQty }).eq('user_id', currentUser.id).eq('product_id', productId);
      } else {
        await supabase.from('cart_items').insert({ user_id: currentUser.id, product_id: productId, quantity: newQty });
      }
      showToast("Cart updated.");
      if (window.updateGlobalCartBadge) await window.updateGlobalCartBadge();
    }
  } catch (err) {
    console.error("Cart error:", err);
    // Rollback
    if (oldQty <= 0) {
      delete cartMap[productId];
    } else {
      cartMap[productId] = oldQty;
    }
    renderPage(catalog, countEl);
    showToast("Error updating cart.");
  }
}