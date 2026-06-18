// scripts/render/home.js
import { navigate, setRouteParams } from "../router.js";
import { sanitizeShortText, sanitizeUrl, toSafeMoney } from "../security.js";
import { getSupabaseClient } from "../supabaseClient.js";

export async function renderHome() {
  const container = document.getElementById("router-view");
  if (!container) return;

  const homeImages = container.querySelectorAll("img");
  homeImages.forEach(img => {
    if (!img.closest('.rec-grid') && (img.src.includes('interior') || img.src.includes('impact') || img.closest('section'))) {
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "cover"; 
      img.style.borderRadius = "inherit";
      img.style.display = "block";
      
      if (img.parentElement) {
        img.parentElement.style.overflow = "hidden";
        img.parentElement.style.padding = "0";
      }
    }
  });

  try {
    const supabase = await getSupabaseClient();
    const { data: products, error } = await supabase.from("products").select("*");
    if (error) throw error;

    if (products && products.length > 0) {
      const shuffled = [...products].sort(() => 0.5 - Math.random()).slice(0, 3);
      // IMPACT REPORT SYNC
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        try {
          const { data: profile } = await supabase.from('profiles').select('impact_score').eq('id', session.user.id).single();
          const { data: orders } = await supabase.from('orders').select('id, order_items(quantity)').eq('user_id', session.user.id);
          
          const impactScore = profile?.impact_score || 0;
          let itemsRehomed = 0;
          if (orders) {
            orders.forEach(o => {
              if (o.order_items) {
                o.order_items.forEach(oi => itemsRehomed += (oi.quantity || 1));
              }
            });
          }
          
          const impactStats = container.querySelector(".impact-stats");
          if (impactStats) {
            impactStats.innerHTML = `
              <div><strong>${impactScore}</strong><span>Impact Points</span></div>
              <div><strong>${itemsRehomed}</strong><span>Items ReHomed</span></div>
            `;
          }
        } catch (e) {
          console.warn("Failed to sync impact report", e);
        }
      }

      const recGrid = container.querySelector(".rec-grid");

      if (recGrid) {
        const bgClasses = ["white-bg", "dark-bg", "red-bg"];

        recGrid.innerHTML = shuffled.map((product, index) => {
          const bgClass = bgClasses[index % bgClasses.length];
          const safeId = sanitizeShortText(product.id);
          const safeImgUrl = sanitizeUrl(product.image_url);
          const safeMaker = sanitizeShortText(product.maker, "CURATED FIND");
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
              
              <div class="rec-img ${bgClass}" style="width: 100%; aspect-ratio: 1; padding: 0; overflow: hidden;">
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

        recGrid.querySelectorAll(".rec-card").forEach((card) => {
          card.addEventListener("click", () => {
            setRouteParams({ productId: card.dataset.id });
            navigate("product-detail");
          });
        });
      }
    }
  } catch (err) {
    console.warn("Gagal memuat rekomendasi dinamis:", err);
  }

  container.querySelectorAll("[data-route]").forEach((btn) => {
    if (!btn.classList.contains("rec-card")) {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        navigate(btn.dataset.route);
      });
    }
  });
}