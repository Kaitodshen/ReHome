import { bindLoginPage } from "./render/login.js";
import { navigate } from "./router.js";
import { logoutUser } from "./auth.js";
import { getSupabaseClient } from "./supabaseClient.js";

const premiumCSS = `
  header, .app-header { border-top: 4px solid #3d5a30 !important; }

  nav, header, .app-header {
    border-bottom: none !important;
    box-shadow: 0 12px 16px -12px rgba(82, 100, 66, 0.25) !important;
    position: relative;
    z-index: 100;
  }

  .btn-favorite { position: absolute; top: 12px; right: 12px; width: 36px; height: 36px; background: white; border: none; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.1); transition: 0.2s ease; z-index: 10; }
  .btn-favorite:hover { transform: scale(1.1); }
  .btn-favorite.active { color: #dc2626; fill: #dc2626; }
  .btn-favorite svg { width: 18px; height: 18px; color: #78716c; transition: 0.2s; }
  .btn-favorite.active svg { color: #dc2626; fill: #dc2626; }

  select.sort-select, .sort-select { appearance: none; -webkit-appearance: none; border: none !important; background: transparent !important; font-size: 15px !important; font-weight: 700 !important; color: #1c1917 !important; padding-right: 18px !important; cursor: pointer; outline: none; background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2210%22%20height%3D%226%22%20viewBox%3D%220%200%2010%206%22%20fill%3D%22none%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cpath%20d%3D%22M1%201L5%205L9%201%22%20stroke%3D%22%231C1917%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22/%3E%3C/svg%3E") !important; background-repeat: no-repeat !important; background-position: right center !important; }

  .product-grid.list-view { display: flex !important; flex-direction: column !important; gap: 32px !important; }
  .product-grid.list-view .prod-card { display: flex !important; flex-direction: row !important; gap: 24px !important; align-items: center; max-width: 100%; }
  .product-grid.list-view .prod-card img.prod-img { width: 250px !important; height: 250px !important; object-fit: cover !important; flex-shrink: 0; }
  .product-grid.list-view .prod-card .prod-info { flex-grow: 1; display: flex; flex-direction: column; justify-content: center; }

  .fab-add { position: fixed; bottom: 40px; right: 40px; width: 64px; height: 64px; border-radius: 50%; background-color: #526442; color: white; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 24px rgba(82,100,66,0.3); border: none; cursor: pointer; z-index: 999; transition: 0.2s; }
  .fab-add:hover { transform: scale(1.05); }

  .multi-range-slider { position: relative !important; width: 100% !important; height: 6px !important; background: #e7e5e4 !important; border-radius: 4px !important; margin: 20px 0 40px 0 !important; display: block !important; }
  .multi-range-slider .slider-track { position: absolute !important; height: 100% !important; background: #3d5a30 !important; border-radius: 4px !important; top: 0 !important; z-index: 1 !important; pointer-events: none !important; }
  .multi-range-slider input[type="range"] { position: absolute !important; width: 100% !important; height: 6px !important; top: 0 !important; left: 0 !important; background: transparent !important; pointer-events: none !important; -webkit-appearance: none !important; margin: 0 !important; z-index: 2 !important; border: none !important; }
  .multi-range-slider input[type="range"]::-webkit-slider-thumb { height: 24px !important; width: 24px !important; border-radius: 50% !important; background: white !important; border: 3px solid #3d5a30 !important; pointer-events: auto !important; -webkit-appearance: none !important; cursor: pointer !important; box-shadow: 0 2px 6px rgba(0,0,0,0.15) !important; margin-top: -9px !important; }
  .multi-range-slider input[type="range"]::-moz-range-thumb { height: 24px !important; width: 24px !important; border-radius: 50% !important; background: white !important; border: 3px solid #3d5a30 !important; pointer-events: auto !important; cursor: pointer !important; box-shadow: 0 2px 6px rgba(0,0,0,0.15) !important; box-sizing: border-box !important; }
`;
if(!document.getElementById('rehome-premium-css')) {
  const style = document.createElement('style'); style.id = 'rehome-premium-css'; style.innerHTML = premiumCSS; document.head.appendChild(style);
}

document.addEventListener("DOMContentLoaded", () => {
   document.querySelectorAll('nav a, header a').forEach(a => {
      if(a.textContent.toLowerCase().includes('sell an item') || a.getAttribute('data-route') === 'sell') {
          a.textContent = 'Sell';
          a.setAttribute('data-route', 'sell');
      } 
      else if (a.textContent.toLowerCase().trim() === 'sell' && a.getAttribute('data-route') !== 'sell') {
          a.remove();
      }
   });
});

window.updateGlobalCartBadge = async function() {
  try {
    const supabase = await getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    let totalItems = 0;
    if (session) {
      const { data, error } = await supabase.from('cart_items').select('quantity').eq('user_id', session.user.id);
      if (!error && data) totalItems = data.reduce((sum, item) => sum + item.quantity, 0);
    }
    
    document.querySelectorAll('nav [data-route="cart"], header [data-route="cart"], .app-nav [data-route="cart"]').forEach(icon => {
      let badge = icon.querySelector(".cart-badge") || icon.querySelector("span.cart-badge");
      if (!badge) {
         icon.style.position = "relative";
         icon.insertAdjacentHTML('beforeend', `<span class="cart-badge">${totalItems}</span>`);
         badge = icon.querySelector(".cart-badge");
      } else { badge.textContent = totalItems; }
      badge.style.cssText = "position:absolute; top:-6px; right:-8px; background:#dc2626; color:white; font-size:10px; font-weight:bold; min-width:18px; height:18px; border-radius:50%; display:flex; align-items:center; justify-content:center; border: 2px solid var(--paper, #fff); box-sizing: content-box;";
    });
  } catch (err) { console.error("Gagal update badge:", err); }
};
async function boot() {
  bindLoginPage();

  try {
    const supabase = await getSupabaseClient();
    const loader = document.getElementById("loader");
    if (!supabase) {
        if (loader) loader.hidden = true;
        document.getElementById("app").hidden = true;
        document.getElementById("login").hidden = false;
        return;
    }
    
    // Intercept QRIS Sync Request
    const urlParams = new URLSearchParams(window.location.search);
    const simPayId = urlParams.get('simulate_pay');
    if (simPayId) {
       if (loader) loader.hidden = true;
       document.getElementById("app").hidden = true;
       document.getElementById("login").hidden = true;
       
       const amount = urlParams.get('amount') || '0';
       
       document.body.innerHTML = `
        <div style="min-height:100vh; background:#f0f9ff; display:flex; align-items:center; justify-content:center; padding:24px; font-family:var(--sans, sans-serif);">
          <div style="background:white; width:100%; max-width:400px; border-radius:32px; overflow:hidden; box-shadow:0 20px 40px rgba(0,0,0,0.1);">
            <div style="background:#0284c7; color:white; padding:32px 24px; text-align:center;">
              <h3 style="margin:0; font-size:18px; font-weight:700;">Mobile Banking</h3>
              <p style="margin:8px 0 0; font-size:14px; opacity:0.9;">Payment Confirmation</p>
            </div>
            <div style="padding:32px 24px; background:white; border-radius:24px 24px 0 0; margin-top:-16px; text-align:center;">
              <p style="font-size:14px; color:#64748b; margin:0 0 8px;">Paying to</p>
              <h2 style="font-size:22px; color:#0f172a; margin:0 0 32px;">ReHome Marketplace</h2>
              
              <div style="background:#f8fafc; border:1px dashed #cbd5e1; padding:24px; border-radius:16px; margin-bottom:32px;">
                <p style="font-size:13px; color:#64748b; margin:0 0 8px;">Total Amount</p>
                <h1 style="font-size:36px; color:#0f172a; margin:0; font-weight:800;">$${parseFloat(amount).toLocaleString()}</h1>
              </div>
              
              <button id="btn-confirm-mobile" style="width:100%; padding:18px; border:none; background:#0ea5e9; border-radius:16px; font-size:16px; font-weight:700; color:white; cursor:pointer; box-shadow:0 10px 20px rgba(14, 165, 233, 0.2);">Confirm Payment</button>
              <p id="mobile-status" style="margin-top:16px; font-size:14px; color:#166534; font-weight:600; display:none;">Sent! You can close this.</p>
            </div>
          </div>
        </div>
       `;
       
       document.getElementById('btn-confirm-mobile').addEventListener('click', async (e) => {
          e.target.disabled = true;
          e.target.textContent = 'Processing...';
          e.target.style.background = '#94a3b8';
          
          const channel = supabase.channel(`payment-${simPayId}`);
          channel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              channel.send({
                type: 'broadcast',
                event: 'payment_success',
                payload: { status: 'success' }
              });
              e.target.style.display = 'none';
              document.getElementById('mobile-status').style.display = 'block';
            }
          });
       });
       return;
    }

    if (window.location.hash.includes('access_token')) {
        await supabase.auth.getSession();
        
        window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
        
        localStorage.setItem('rehome_current_route', 'home');
    }

    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) throw error;
    
    if (session) {
        if (loader) loader.hidden = true;
        document.getElementById("login").hidden = true;
        document.getElementById("app").hidden = false;
        await window.updateGlobalCartBadge();
        
        // Fetch profile to check role
        try {
          const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
          if (profile && profile.role === 'admin') {
            document.querySelectorAll('[data-route="admin"]').forEach(el => {
              el.classList.remove('hidden-item');
              el.style.display = 'flex'; // Ensure it displays
            });
          }
        } catch(e) { console.warn("Failed to fetch profile on boot", e); }
        
        const lastRoute = localStorage.getItem('rehome_current_route') || "home";
        navigate(lastRoute);
    } else {
        if (loader) loader.hidden = true;
        document.getElementById("app").hidden = true;
        document.getElementById("login").hidden = false;
    }

    const logoutBtn = document.querySelector("[data-logout]");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        await logoutUser();
        
        localStorage.removeItem('rehome_current_route');
        document.getElementById("app").hidden = true;
        document.getElementById("login").hidden = false;
        window.history.replaceState(null, document.title, window.location.pathname);
      });
    }
  } catch (err) {
    console.error("Boot error:", err);
    const loader = document.getElementById("loader");
    if (loader) loader.hidden = true;
    document.getElementById("app").hidden = true;
    document.getElementById("login").hidden = false;
  }
}

boot();

// ─── GLOBAL SEARCH ───
window.rehomeSearchQuery = '';

document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('global-search-toggle');
  const box = document.getElementById('global-search-box');
  const input = document.getElementById('global-search-input');
  
  if (toggle && box && input) {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = box.classList.contains('open');
      if (isOpen) {
        // If there's text, submit it
        if (input.value.trim()) {
          window.rehomeSearchQuery = input.value.trim();
          navigate('shop');
        }
        box.classList.remove('open');
      } else {
        box.classList.add('open');
        input.focus();
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        window.rehomeSearchQuery = input.value.trim();
        navigate('shop');
        box.classList.remove('open');
      }
      if (e.key === 'Escape') {
        box.classList.remove('open');
        input.value = '';
        window.rehomeSearchQuery = '';
      }
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!box.contains(e.target) && e.target !== toggle && !toggle.contains(e.target)) {
        box.classList.remove('open');
      }
    });
  }
});
