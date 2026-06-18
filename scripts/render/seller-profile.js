import { getRouteParams, navigate, setRouteParams } from "../router.js";
import { getSupabaseClient } from "../supabaseClient.js";
import { sanitizeShortText, sanitizeUrl, toSafeMoney, sanitize } from "../security.js";

export async function renderSellerProfile() {
  const container = document.getElementById("router-view");
  if (!container) return;

  const { id: sellerId } = getRouteParams();
  if (!sellerId) {
    navigate("shop");
    return;
  }

  // Set up UI elements
  const backBtn = document.getElementById("sp-back-btn");
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      navigate("shop");
    });
  }

  try {
    const supabase = await getSupabaseClient();
    
    // Fetch profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, shop_name, avatar_url, location, description')
      .eq('id', sellerId)
      .single();

    if (profileError || !profile) {
      console.warn("Seller profile not found");
      document.getElementById("sp-name").textContent = "Profile Not Found";
      return;
    }

    // Populate profile info
    const shopName = profile.shop_name || profile.full_name || "Unknown Seller";
    document.getElementById("sp-name").textContent = sanitizeShortText(shopName);
    
    const avatarImg = document.getElementById("sp-avatar");
    const defaultAvatar = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23d6d3d1'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/></svg>";
    if (profile.avatar_url) {
      if (avatarImg) {
        avatarImg.src = sanitizeUrl(profile.avatar_url);
        avatarImg.classList.remove("hidden");
      }
    } else {
      if (avatarImg) {
        avatarImg.src = defaultAvatar;
        avatarImg.classList.remove("hidden");
      }
    }

    if (profile.location) {
      const locContainer = document.getElementById("sp-location-container");
      const locText = document.getElementById("sp-location");
      if (locContainer && locText) {
        locContainer.style.display = "flex";
        locText.textContent = sanitizeShortText(profile.location);
      }
    }

    if (profile.description) {
      const descEl = document.getElementById("sp-description");
      if (descEl) {
        descEl.textContent = sanitize(profile.description);
      }
    }

    // Fetch active products
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .eq('seller_id', sellerId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (productsError) {
      console.warn("Error fetching seller products");
    }

    const grid = document.getElementById("sp-products-grid");
    const countEl = document.getElementById("sp-product-count");

    if (products && products.length > 0) {
      if (countEl) countEl.textContent = `${products.length} listing${products.length > 1 ? 's' : ''}`;
      
      const bgClasses = ["white-bg", "dark-bg", "red-bg"];
      
      if (grid) {
        grid.innerHTML = products.map((product, index) => {
          const bgClass = bgClasses[index % bgClasses.length];
          const safeId = sanitizeShortText(product.id);
          const safeImgUrl = sanitizeUrl(product.image_url);
          const safeMaker = sanitizeShortText(product.maker || shopName, "CURATED FIND");
          const safeTitle = sanitizeShortText(product.title, "Untitled item");
          const safePrice = toSafeMoney(product.price);

          return `
            <article class="rec-card" data-id="${safeId}" style="
                cursor: pointer; 
                border-radius: 16px; 
                overflow: hidden; 
                box-shadow: inset 0 4px 15px rgba(0,0,0,0.03), 0 12px 30px rgba(61,90,48,0.12); 
                transition: transform 0.3s ease, box-shadow 0.3s ease; 
                background: white; 
                border: 1px solid #e7e5e4;
                display: flex;
                flex-direction: column;
            " onmouseover="this.style.transform='translateY(-6px)'; this.style.boxShadow='inset 0 4px 15px rgba(0,0,0,0.03), 0 20px 40px rgba(61,90,48,0.2)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='inset 0 4px 15px rgba(0,0,0,0.03), 0 12px 30px rgba(61,90,48,0.12)'">
              
              <div class="rec-img ${bgClass}" style="width: 100%; aspect-ratio: 1; padding: 0; overflow: hidden; background: #f2f0eb;">
                <img src="${safeImgUrl}" alt="${safeTitle}" style="width: 100%; height: 100%; object-fit: cover; border-radius: inherit; display: block; transition: transform 0.5s ease;" onmouseover="this.style.transform='scale(1.08)'" onmouseout="this.style.transform='scale(1)'">
              </div>
              
              <div class="rec-info" style="padding: 20px; display: flex; flex-direction: column; justify-content: space-between; flex-grow: 1;">
                <div>
                    <span style="font-size: 11px; font-weight: 800; color: #78716c; letter-spacing: 0.5px; text-transform: uppercase;">${safeMaker}</span>
                    <h3 style="font-size: 17px; margin: 6px 0 12px; color: #1c1917; font-weight: 700;">${safeTitle}</h3>
                </div>
                <strong style="color: #3d5a30; font-size: 18px;">${window.formatCurrency(safePrice)}</strong>
              </div>
            </article>
          `;
        }).join("");

        // Add click listener
        grid.querySelectorAll(".rec-card").forEach((card) => {
          card.addEventListener("click", () => {
            setRouteParams({ productId: card.dataset.id });
            navigate("product-detail");
          });
        });
      }
    } else {
      if (countEl) countEl.textContent = "0 listings";
      if (grid) grid.innerHTML = `<div style="grid-column: 1 / -1; padding: 60px 20px; text-align: center; color: #78716c;">This shop doesn't have any active listings right now.</div>`;
    }

  } catch (err) {
    console.error("Error rendering seller profile:", err);
  }
}
