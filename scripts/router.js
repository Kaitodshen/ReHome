import { showToast } from "./ui.js";

let routeParams = JSON.parse(localStorage.getItem('rehome_route_params')) || {};

export function setRouteParams(params) {
  routeParams = params;
  localStorage.setItem('rehome_route_params', JSON.stringify(params));
}

export function getRouteParams() {
  return routeParams;
}

const viewCache = {};
let isNavigating = false;

document.addEventListener("click", (e) => {
  const navBtn = e.target.closest("[data-route]");
  if (navBtn) {
    e.preventDefault();
    navigate(navBtn.dataset.route);
  }
});

export async function navigate(route) {
  if (isNavigating) return;
  isNavigating = true;

  try {
    const container = document.getElementById("router-view");
    if (!container) return;

    localStorage.setItem('rehome_current_route', route);

    document.querySelectorAll("[data-route]").forEach((button) => {
      button.classList.toggle("active", button.dataset.route === route);
    });

    if (!viewCache[route]) {
      const response = await fetch(`views/${route}.html`, { cache: 'no-store' });
      if (response.ok) viewCache[route] = await response.text();
      else viewCache[route] = `<div style="padding:100px;text-align:center;color:#78716c;font-family:sans-serif;"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#3d5a30" stroke-width="2" style="animation: spin 1s linear infinite;"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg><style>@keyframes spin{100%{transform:rotate(360deg)}}</style><h2 style="margin-top:16px;">Loading...</h2></div>`;
    }
    container.innerHTML = viewCache[route];
    window.scrollTo({ top: 0, behavior: "auto" });

    const STATIC_ROUTES = ['shipping', 'returns', 'terms', 'help-center', 'contact', 'seller-guide'];
    if (!STATIC_ROUTES.includes(route)) {
      try {
        const module = await import(`./render/${route}.js?t=${Date.now()}`);
        const renderFunctionName = "render" + route.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
        if (module[renderFunctionName]) module[renderFunctionName]();
      } catch (e) {
        if (!e.message.includes("Failed to fetch dynamically imported module")) {
          console.error(`Router error executing ${route}.js:`, e);
        }
      }
    }

  } catch (error) {
    showToast("Gagal memuat halaman.");
  } finally {
    isNavigating = false;
  }
}

export const Maps = navigate;

export async function showApp(route) {
  document.getElementById("login").hidden = true;
  document.getElementById("app").hidden = false;
  
  const targetRoute = route || localStorage.getItem('rehome_current_route') || "home";
  await navigate(targetRoute);
}