// scripts/render/sell.js — Seller Dashboard fully wired to Supabase
import { getSupabaseClient } from "../supabaseClient.js";
import { navigate } from "../router.js";
import { showToast } from "../ui.js";

function sanitize(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, tag => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[tag] || tag));
}

function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function statusColor(status) {
  const map = {
    active: { bg: '#edf7ed', color: '#166534', label: 'Active' },
    draft:  { bg: '#fef9c3', color: '#854d0e', label: 'Draft'  },
    sold:   { bg: '#dbeafe', color: '#1e40af', label: 'Sold'   },
  };
  return map[status] || { bg: '#f5f5f4', color: '#57534e', label: status || 'Unknown' };
}

export async function renderSell() {
  try {
    const container = document.getElementById("router-view");
    if (!container) return;

  const supabase = await getSupabaseClient();
  if (!supabase) { showToast("Database not connected."); return; }

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) { navigate("home"); return; }

  // ─── Fetch seller's products ───
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('id, title, maker, description, category, condition, price, currency, image_url, carbon_offset, status, created_at')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false });

  if (prodErr) console.error('Seller products error:', prodErr);

  const allProducts = products || [];

  // ─── Fetch sold order items for this seller's products ───
  const productIds = allProducts.map(p => p.id);
  let orderItems = [];
  if (productIds.length > 0) {
    const { data: oi } = await supabase
      .from('order_items')
      .select('product_id, price, quantity, order_id, orders(created_at)')
      .in('product_id', productIds);
    orderItems = oi || [];
  }

  // ─── Aggregate stats ───
  const totalSalesAmount = orderItems.reduce((sum, oi) => sum + (Number(oi.price) * (oi.quantity || 1)), 0);
  const totalItemsSold = orderItems.reduce((sum, oi) => sum + (oi.quantity || 1), 0);
  const totalCarbonOffset = allProducts.reduce((sum, p) => sum + Number(p.carbon_offset || 0), 0);
  const activeCount = allProducts.filter(p => p.status === 'active').length;
  const draftCount = allProducts.filter(p => p.status === 'draft').length;
  const soldCount = allProducts.filter(p => p.status === 'sold').length;

  // ─── Weekly sales for chart (last 4 weeks) ───
  const now = new Date();
  const weeklyData = [0, 0, 0, 0];
  orderItems.forEach(oi => {
    const orderDate = new Date(oi.orders?.created_at || now);
    const diffDays = Math.floor((now - orderDate) / (1000 * 60 * 60 * 24));
    const weekIndex = Math.min(3, Math.floor(diffDays / 7));
    weeklyData[3 - weekIndex] += Number(oi.price) * (oi.quantity || 1);
  });
  const maxWeekly = Math.max(...weeklyData, 1);

  // ─── Carbon goal progress ───
  const yearlyGoalKg = 500;
  const carbonPct = Math.min(100, Math.round((totalCarbonOffset / yearlyGoalKg) * 100));

  // ─── Build the full page ───
  container.innerHTML = `
    <div style="max-width: 1100px; margin: 0 auto; padding: 40px 24px 120px 24px; font-family: var(--sans); color: #1c1917; box-sizing: border-box;">
       
       <h1 style="font-family: var(--serif); font-size: 36px; margin: 0 0 8px 0; color: #526442;">Seller Dashboard</h1>
       <p style="color: #78716c; margin: 0 0 40px 0; font-size: 16px;">Manage your conscious listings and track your environmental impact.</p>
       
       <!-- ═══ TOP ROW: Performance + Impact ═══ -->
       <div style="display: grid; grid-template-columns: 1.8fr 1fr; gap: 24px; margin-bottom: 24px;">
          
          <!-- Sales Performance -->
          <div style="background: white; border-radius: 16px; padding: 32px; border: 1px solid #e7e5e4; display: flex; flex-direction: column; justify-content: space-between;">
             <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px;">
                <div>
                   <h3 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 600;">Sales Performance</h3>
                   <span style="font-size: 11px; color: #a8a29e; font-weight: 700; letter-spacing: 1px;">LAST 30 DAYS</span>
                </div>
                <button id="btn-download-report" style="border: 1px solid #d6d3d1; background: white; padding: 8px 16px; border-radius: 8px; font-weight: 600; cursor:pointer; color: #57534e; font-size: 13px; transition: 0.2s;" onmouseover="this.style.borderColor='#3d5a30'" onmouseout="this.style.borderColor='#d6d3d1'">Download Report</button>
             </div>
             
             <!-- Bar chart -->
             <div style="height: 180px; display: flex; align-items: flex-end; gap: 16px;">
                ${weeklyData.map((val, i) => {
                  const pct = Math.max(5, Math.round((val / maxWeekly) * 100));
                  const isMax = val === maxWeekly && val > 0;
                  return `<div style="flex:1; position: relative; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center;">
                    ${isMax ? `<div style="position: absolute; top: ${100 - pct - 12}%; left: 50%; transform: translateX(-50%); background: #1c1917; color: white; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; white-space: nowrap; z-index: 2;">
                       ${window.formatCurrency(val)}
                       <div style="position: absolute; bottom: -4px; left: 50%; transform: translateX(-50%) rotate(45deg); width: 8px; height: 8px; background: #1c1917;"></div>
                    </div>` : ''}
                    <div style="width: 100%; height: ${pct}%; background: ${isMax ? '#9caf88' : '#e2e6db'}; border-radius: 6px 6px 0 0; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#9caf88'" onmouseout="this.style.background='${isMax ? '#9caf88' : '#e2e6db'}'"></div>
                  </div>`;
                }).join('')}
             </div>
             <div style="display: flex; justify-content: space-between; margin-top: 16px; font-size: 11px; color: #a8a29e; font-weight: 700; letter-spacing: 0.5px;">
                <span>WEEK 1</span><span>WEEK 2</span><span>WEEK 3</span><span>WEEK 4</span>
             </div>

             <!-- Summary row -->
             <div style="display: flex; gap: 32px; margin-top: 24px; padding-top: 20px; border-top: 1px solid #f0ede8;">
               <div><div style="font-size: 24px; font-weight: 700; color: #3d5a30;">${window.formatCurrency(totalSalesAmount)}</div><div style="font-size: 12px; color: #78716c;">Total Revenue</div></div>
               <div><div style="font-size: 24px; font-weight: 700; color: #1c1917;">${totalItemsSold}</div><div style="font-size: 12px; color: #78716c;">Items Sold</div></div>
               <div><div style="font-size: 24px; font-weight: 700; color: #1c1917;">${allProducts.length}</div><div style="font-size: 12px; color: #78716c;">Total Listings</div></div>
             </div>
          </div>

          <!-- Sustainable Impact -->
          <div style="background: #fdf8f3; border-radius: 16px; padding: 32px; border: 1px solid #ede8df; display: flex; flex-direction: column;">
             <div style="width: 48px; height: 48px; border-radius: 50%; background: #f0f4ea; display: flex; align-items: center; justify-content: center; margin-bottom: 24px; color: #526442;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10S2 17.52 2 12c0-2.76 1.12-5.26 2.93-7.07"/><path d="M12 6v6l4 2"/></svg>
             </div>
             <h3 style="font-family: var(--serif); font-size: 26px; margin: 0 0 16px 0; color: #526442;">Sustainable Impact</h3>
             <p style="color: #57534e; font-size: 15px; line-height: 1.5; margin-bottom: auto;">Your circular sales have diverted <strong>${totalCarbonOffset.toFixed(1)}kg</strong> of waste from landfills.</p>
             <div style="margin-top: 40px;">
                <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 800; color: #57534e; letter-spacing: 1px; margin-bottom: 8px;">
                   <span>YEARLY GOAL</span><span style="color:#526442;">${carbonPct}%</span>
                </div>
                <div style="width: 100%; height: 6px; background: #d6d3d1; border-radius: 99px; overflow: hidden;">
                   <div style="width: ${carbonPct}%; height: 100%; background: linear-gradient(90deg, #3d5a30, #7a9e6e); border-radius: 99px; transition: width 0.5s;"></div>
                </div>
             </div>
          </div>
       </div>

       <!-- ═══ QUICK ACTIONS ═══ -->
       <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-bottom: 60px;">
         <div id="btn-upload-item" style="background: white; border: 1px solid #e7e5e4; border-radius: 16px; padding: 24px; cursor: pointer; transition: 0.2s;" onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform='none'">
            <div style="width: 40px; height: 40px; border-radius: 50%; background: #f0f4ea; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; color: #526442;">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
            </div>
            <h4 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 700;">Upload Item</h4>
            <p style="margin: 0; font-size: 14px; color: #78716c;">List a new curated piece</p>
         </div>
         <div id="btn-sales-history" style="background: white; border: 1px solid #e7e5e4; border-radius: 16px; padding: 24px; cursor: pointer; transition: 0.2s;" onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform='none'">
            <div style="width: 40px; height: 40px; border-radius: 50%; background: #fff7ed; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; color: #c2410c;">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
            </div>
            <h4 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 700;">Sales History</h4>
            <p style="margin: 0; font-size: 14px; color: #78716c;">View all past transactions</p>
         </div>
         <div id="btn-seller-support" style="background: white; border: 1px solid #e7e5e4; border-radius: 16px; padding: 24px; cursor: pointer; transition: 0.2s;" onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform='none'">
            <div style="width: 40px; height: 40px; border-radius: 50%; background: #f5f5f4; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; color: #57534e;">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
            </div>
            <h4 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 700;">Seller Support</h4>
            <p style="margin: 0; font-size: 14px; color: #78716c;">Get help with shipping & returns</p>
         </div>
       </div>

       <!-- ═══ LISTINGS SECTION ═══ -->
       <div style="display: flex; flex-direction: column; margin-bottom: 24px; margin-top: 40px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 40px;">
            <div>
              <h2 id="section-title" style="font-family: var(--serif, 'Playfair Display', serif); font-size: 48px; font-weight: 600; margin: 0 0 12px 0; color: #1c1917; letter-spacing: -0.02em;">My Listings</h2>
              <p style="color: #78716c; margin: 0; font-size: 18px;">Manage your curated collection of high-end pieces.</p>
            </div>
            <div id="listing-filter-tabs" style="display: flex; gap: 32px; border-bottom: 1px solid #e7e5e4; padding-bottom: 8px;">
               <button class="sell-filter-tab active" data-filter="all" style="border: none; background: transparent; padding: 0 0 8px 0; margin-bottom: -9px; border-bottom: 2px solid #1c1917; font-size: 12px; font-weight: 600; cursor: pointer; color: #1c1917; text-transform: uppercase; letter-spacing: 0.1em; transition: 0.2s;">All</button>
               <button class="sell-filter-tab" data-filter="draft" style="border: none; background: transparent; padding: 0 0 8px 0; margin-bottom: -9px; border-bottom: 2px solid transparent; font-size: 12px; font-weight: 600; color: #78716c; cursor: pointer; text-transform: uppercase; letter-spacing: 0.1em; transition: 0.2s;" onmouseover="this.style.color='#1c1917'" onmouseout="this.className.includes('active')?'':this.style.color='#78716c'">Drafts</button>
               <button class="sell-filter-tab" data-filter="sold" style="border: none; background: transparent; padding: 0 0 8px 0; margin-bottom: -9px; border-bottom: 2px solid transparent; font-size: 12px; font-weight: 600; color: #78716c; cursor: pointer; text-transform: uppercase; letter-spacing: 0.1em; transition: 0.2s;" onmouseover="this.style.color='#1c1917'" onmouseout="this.className.includes('active')?'':this.style.color='#78716c'">Sold</button>
               <button class="sell-filter-tab" data-filter="offers" style="border: none; background: transparent; padding: 0 0 8px 0; margin-bottom: -9px; border-bottom: 2px solid transparent; font-size: 12px; font-weight: 600; color: #78716c; cursor: pointer; text-transform: uppercase; letter-spacing: 0.1em; transition: 0.2s;" onmouseover="this.style.color='#1c1917'" onmouseout="this.className.includes('active')?'':this.style.color='#78716c'">Offers <span id="offers-badge"></span></button>
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div id="items-count-label" style="color: #78716c; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em;">${allProducts.length} Items</div>
            <button style="display: flex; align-items: center; gap: 8px; border: none; background: transparent; color: #1c1917; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; cursor: pointer; transition: 0.2s;" onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
              Filter
            </button>
          </div>
       </div>

       <div id="listings-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px;"></div>
       
       <div id="offers-grid" style="display: none; gap: 16px; flex-direction: column;">
         <div class="glass-panel" style="text-align: center; padding: 48px; color: #78716c;">
           <div style="margin-bottom: 16px; color: #3d5a30;"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg></div>
           <div style="font-weight: 600; color:#1c1917;">No offers yet</div>
           <div style="font-size: 13px; margin-top: 4px;">Offers from buyers will appear here.</div>
         </div>
       </div>

    </div>
  `;

  // ─── Fetch and render offers ───
  async function loadOffers() {
    try {
      const { data: offers, error: offersErr } = await supabase
        .from('offers')
        .select('*, products(title, price, image_url)')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });
      
      const offersGrid = document.getElementById('offers-grid');
      const offersBadge = document.getElementById('offers-badge');
      if (!offersGrid || !offers) return;

      const pendingCount = offers.filter(o => o.status === 'pending').length;
      if (offersBadge) offersBadge.textContent = pendingCount;

      if (offers.length === 0) return;

      // Fetch buyer profiles manually to avoid PostgREST foreign key issues
      const buyerIds = [...new Set(offers.map(o => o.buyer_id))];
      let profilesMap = {};
      if (buyerIds.length > 0) {
        const { data: buyers } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', buyerIds);
        if (buyers) {
          buyers.forEach(b => { profilesMap[b.id] = b; });
        }
      }

      offersGrid.innerHTML = offers.map(offer => {
        const buyer = profilesMap[offer.buyer_id] || {};
        const buyerName = buyer.full_name || 'Anonymous';
        const defaultAvatar = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23d6d3d1'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/></svg>";
        const buyerAvatar = buyer.avatar_url || defaultAvatar;
        const productTitle = offer.products?.title || 'Unknown';
        const productPrice = Number(offer.products?.price || 0);
        const offerPrice = Number(offer.amount || 0);
        const discount = productPrice > 0 ? Math.round((1 - offerPrice / productPrice) * 100) : 0;
        const statusMap = {
          pending: { bg: '#fef9c3', color: '#854d0e', label: 'Pending' },
          accepted: { bg: '#dcfce7', color: '#166534', label: 'Accepted' },
          rejected: { bg: '#fecaca', color: '#991b1b', label: 'Rejected' },
        };
        const st = statusMap[offer.status] || statusMap.pending;
        const isPending = offer.status === 'pending';

        return `
          <div class="glass-panel" style="padding: 24px; display: flex; align-items: center; gap: 20px; transition: 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
            <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(255, 255, 255, 0.5); overflow: hidden; flex-shrink: 0;">
              ${buyerAvatar ? `<img src="${sanitize(buyerAvatar)}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-weight:700;color:#78716c;font-size:18px;">${buyerName.charAt(0)}</div>`}
            </div>
            <div style="flex:1; min-width:0;">
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                <strong style="font-size:15px; color:#1c1917;">${sanitize(buyerName)}</strong>
                <span style="background:${st.bg}; color:${st.color}; padding:2px 8px; border-radius:99px; font-size:10px; font-weight:800; text-transform:uppercase;">${st.label}</span>
              </div>
              <div style="font-size:13px; color:#78716c; margin-bottom:4px;">offered <strong style="color:#3d5a30;">${window.formatCurrency(offerPrice)}</strong> for <strong>${sanitize(productTitle)}</strong> <span style="color:#c2410c; font-size:12px;">(-${discount}%)</span></div>
              ${offer.message ? `<div style="font-size:13px; color:#78716c; font-style:italic; margin-top:4px;">"${sanitize(offer.message)}"</div>` : ''}
            </div>
            <div style="display:flex; gap:8px; flex-shrink:0;">
              ${isPending ? `
                <button class="btn-accept-offer" data-offer-id="${offer.id}" data-product-id="${offer.product_id}" data-buyer-id="${offer.buyer_id}" data-amount="${offer.amount}" style="background:#3d5a30; color:white; border:none; padding:8px 20px; border-radius:8px; font-size:13px; font-weight:700; cursor:pointer; transition:0.2s;">Accept</button>
                <button class="btn-reject-offer" data-offer-id="${offer.id}" style="background:rgba(255, 255, 255, 0.5); border:1px solid rgba(255, 255, 255, 0.8); padding:8px 20px; border-radius:8px; font-size:13px; font-weight:700; cursor:pointer; color:#dc2626; transition:0.2s;" onmouseover="this.style.background='rgba(254, 202, 202, 0.5)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.5)'">Reject</button>
              ` : ''}
            </div>
          </div>`;
      }).join('');

      // Wire accept/reject buttons
      offersGrid.querySelectorAll('.btn-accept-offer').forEach(btn => {
        btn.addEventListener('click', async () => {
          btn.disabled = true; btn.textContent = '...';
          try {
            await supabase.from('offers').update({ status: 'accepted', updated_at: new Date().toISOString() }).eq('id', btn.dataset.offerId);
            
            showToast("Offer accepted! The buyer can now checkout at the agreed price.");
            loadOffers();
          } catch (err) { showToast('Error: ' + err.message); }
        });
      });

      offersGrid.querySelectorAll('.btn-reject-offer').forEach(btn => {
        btn.addEventListener('click', async () => {
          btn.disabled = true; btn.textContent = '...';
          try {
            await supabase.from('offers').update({ status: 'rejected', updated_at: new Date().toISOString() }).eq('id', btn.dataset.offerId);
            showToast('Offer rejected.');
            loadOffers();
          } catch (err) { showToast('Error: ' + err.message); }
        });
      });
    } catch (err) {
      console.error('Offers error:', err);
    }
  }

  loadOffers();

  // ─── Render listings into grid ───
  function renderListings(filter) {
    const grid = document.getElementById("listings-grid");
    if (!grid) return;

    const filtered = filter === 'all' 
      ? allProducts 
      : allProducts.filter(p => p.status === filter);

    if (filtered.length === 0 && filter !== 'all') {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 0; color: #78716c;">
          <div style="margin-bottom: 16px; color: #c8c6c0;">
            ${filter === 'draft' 
              ? '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>' 
              : '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>'}
          </div>
          <div style="font-weight: 600; font-size: 16px; margin-bottom: 4px; color: #1c1917;">No ${filter} items</div>
          <div style="font-size: 14px;">Items with "${filter}" status will appear here.</div>
        </div>
      `;
      return;
    }

    let html = filtered.map(p => {
      const sc = statusColor(p.status);
      const soldQty = orderItems.filter(oi => oi.product_id === p.id).reduce((s, oi) => s + (oi.quantity || 1), 0);
      const imgSrc = p.image_url || '';
      const hasImg = !!imgSrc;

      return `
        <article class="prod-card" data-id="${p.id}" style="background: white; border-radius: 8px; overflow: hidden; border: 1px solid rgba(197, 200, 188, 0.4); display: flex; flex-direction: column; cursor: pointer; transition: all 0.3s ease; box-shadow: 0 4px 20px rgba(0,0,0,0.02);" onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 30px rgba(0,0,0,0.06)'" onmouseout="this.style.transform='none'; this.style.boxShadow='0 4px 20px rgba(0,0,0,0.02)'">
          <div style="position: relative; width: 100%; aspect-ratio: 1; background: #f5f4f0; overflow: hidden; display: block;" onmouseover="this.querySelector('.hover-overlay').style.opacity='0.05'; this.querySelector('img').style.transform='scale(1.05)';" onmouseout="this.querySelector('.hover-overlay').style.opacity='0'; this.querySelector('img').style.transform='scale(1)'">
            <div style="position: absolute; top: 12px; right: 12px; z-index: 10; ${sc.bg}; color: ${sc.color}; padding: 4px 10px; border-radius: 999px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.2);">${sc.label}</div>
            ${hasImg ? `<img src="${sanitize(imgSrc)}" alt="${sanitize(p.title)}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.7s ease; display: block;" onerror="this.style.display='none'">` : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #a8a29e; font-size: 14px; font-weight: 600;">No Image</div>`}
            <div class="hover-overlay" style="position: absolute; inset: 0; background: black; opacity: 0; transition: opacity 0.3s ease; pointer-events: none;"></div>
          </div>
          <div style="padding: 24px; display: flex; flex-direction: column; flex-grow: 1;">
            <p style="font-size: 11px; font-weight: 600; color: #78716c; letter-spacing: 1.5px; text-transform: uppercase; margin: 0 0 8px 0; font-family: var(--sans, sans-serif);">${sanitize(p.category)} &bull; ${sanitize(p.condition)}</p>
            <h3 style="margin: 0 0 24px 0; font-size: 20px; font-weight: 500; color: #1c1917; font-family: var(--serif, 'Playfair Display', serif); line-height: 1.3;">${sanitize(p.title)}</h3>
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: auto;">
              <p style="font-size: 16px; font-weight: 400; color: #1c1917; margin: 0; font-family: var(--sans, sans-serif);">${window.formatCurrency(p.price)}</p>
              <button class="btn-edit-listing" data-id="${p.id}" style="background: transparent; border: none; color: #78716c; cursor: pointer; padding: 6px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: background 0.2s, color 0.2s; margin-bottom: -6px; margin-right: -6px;" onmouseover="this.style.background='#f5f4f0'; this.style.color='#1c1917';" onmouseout="this.style.background='transparent'; this.style.color='#78716c';">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
              </button>
            </div>
          </div>
        </article>`;
    }).join('');

    // New listing card
    html += `
      <div id="btn-create-listing" style="border: 1px dashed #d6d3d1; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 250px; cursor: pointer; transition: all 0.3s ease; background: transparent;" onmouseover="this.style.borderColor='#1c1917'; this.style.backgroundColor='#fdf8f8'" onmouseout="this.style.borderColor='#d6d3d1'; this.style.backgroundColor='transparent'">
         <div style="width: 40px; height: 40px; border-radius: 50%; border: 1px solid #e7e5e4; display: flex; align-items: center; justify-content: center; margin-bottom: 12px; color: #1c1917; background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
         </div>
         <h4 style="margin: 0; font-size: 13px; font-weight: 600; color: #1c1917; font-family: var(--sans, sans-serif); letter-spacing: 0.5px; text-transform: uppercase;">Create Listing</h4>
      </div>`;

    grid.innerHTML = html;

    // Bind edit buttons
    grid.querySelectorAll('.btn-edit-listing').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(btn.dataset.id);
      });
    });

    // Bind create listing
    const createBtn = document.getElementById('btn-create-listing');
    if (createBtn) createBtn.addEventListener('click', () => navigate('new-listing'));
  }

  renderListings('all');

  // ─── Tab filtering ───
  const tabs = document.querySelectorAll('.sell-filter-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => {
        t.classList.remove('active');
        t.style.borderBottomColor = 'transparent';
        t.style.color = '#78716c';
      });
      tab.classList.add('active');
      tab.style.borderBottomColor = '#1c1917';
      tab.style.color = '#1c1917';
      
      const filter = tab.dataset.filter;
      const countEl = document.getElementById('items-count-label');
      if (countEl) {
        if (filter === 'all') countEl.textContent = `${allProducts.length} Items`;
        else if (filter === 'draft') countEl.textContent = `${draftCount} Items`;
        else if (filter === 'sold') countEl.textContent = `${soldCount} Items`;
      }

      if (filter === 'offers') {
        document.getElementById('listings-grid').style.display = 'none';
        document.getElementById('offers-grid').style.display = 'grid';
        document.getElementById('section-title').textContent = 'Incoming Offers';
      } else {
        document.getElementById('offers-grid').style.display = 'none';
        document.getElementById('listings-grid').style.display = 'grid';
        document.getElementById('section-title').textContent = 'My Listings';
        renderListings(filter);
      }
    });
  });

  // ─── Quick Actions ───
  document.getElementById('btn-upload-item')?.addEventListener('click', () => navigate('new-listing'));
  document.getElementById('btn-sales-history')?.addEventListener('click', () => navigate('sales-history'));
  document.getElementById('btn-seller-support')?.addEventListener('click', () => {
    showToast("Opening Seller Support...");
    // Show inline support panel
    const supportHTML = `
      <div id="seller-support-overlay" style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center; animation: fadeIn 0.2s;">
        <div style="background: white; border-radius: 20px; padding: 40px; max-width: 500px; width: 90%; box-shadow: 0 24px 48px rgba(0,0,0,0.15);">
          <h2 style="font-family: var(--serif); font-size: 24px; color: #3d5a30; margin: 0 0 8px;">Seller Support</h2>
          <p style="color: #78716c; font-size: 14px; margin: 0 0 24px; line-height: 1.6;">Get help with shipping, returns, and listing optimization.</p>
          
          <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px;">
            <a href="mailto:support@rehome.com" style="display: flex; align-items: center; gap: 12px; padding: 16px; background: #f5f4f0; border-radius: 12px; text-decoration: none; color: #1c1917; font-weight: 600; font-size: 14px; transition: 0.2s;" onmouseover="this.style.background='#edf2ea'" onmouseout="this.style.background='#f5f4f0'">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#526442" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
              Email: support@rehome.com
            </a>
            <div style="display: flex; align-items: center; gap: 12px; padding: 16px; background: #f5f4f0; border-radius: 12px; color: #1c1917; font-weight: 600; font-size: 14px;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#526442" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              Response Time: Within 24 hours
            </div>
            <div style="display: flex; align-items: center; gap: 12px; padding: 16px; background: #f5f4f0; border-radius: 12px; color: #1c1917; font-weight: 600; font-size: 14px;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#526442" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              Shipping Partner: EcoShip Express
            </div>
          </div>

          <button id="close-support" style="width: 100%; padding: 14px; background: #3d5a30; color: white; border: none; border-radius: 10px; font-weight: 700; font-size: 14px; cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='#2e4424'" onmouseout="this.style.background='#3d5a30'">Close</button>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', supportHTML);
    document.getElementById('close-support')?.addEventListener('click', () => {
      document.getElementById('seller-support-overlay')?.remove();
    });
    document.getElementById('seller-support-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'seller-support-overlay') e.target.remove();
    });
  });

  // ─── Download Report (CSV) ───
  document.getElementById('btn-download-report')?.addEventListener('click', () => {
    let csv = 'Title,Category,Condition,Price,Status,Carbon Offset (kg),Created At\n';
    allProducts.forEach(p => {
      csv += `"${p.title}","${p.category}","${p.condition}",${p.price},"${p.status}",${p.carbon_offset},"${p.created_at}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rehome-seller-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Report downloaded successfully!");
  });

  // ─── Edit Modal ───
  async function openEditModal(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;

    const curr = localStorage.getItem('rehome_currency') || 'USD';
    const displayPrice = curr === 'IDR' ? product.price * 16000 : product.price;

    const overlay = document.createElement('div');
    overlay.id = 'edit-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(28,27,27,0.4);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);padding:16px;';
    overlay.innerHTML = `
      <div class="glass-panel" style="background:#fdf8f8;width:100%;max-width:42rem;border-radius:0.75rem;box-shadow:0 4px 40px rgba(0,0,0,0.1);display:flex;flex-direction:column;max-height:90vh;overflow:hidden;transform:transition-all;">
        <!-- Modal Header -->
        <div style="padding:24px;border-bottom:1px solid #e5e2e1;display:flex;justify-content:space-between;align-items:center;background:#fdf8f8;position:sticky;top:0;z-index:10;">
          <h2 style="font-family:var(--serif, 'Playfair Display', serif);font-size:32px;color:#000000;margin:0;font-weight:500;line-height:1.3;">Edit Listing</h2>
          <button id="close-edit-modal" style="background:transparent;border:none;color:#615e58;cursor:pointer;padding:12px;border-radius:9999px;display:flex;align-items:center;justify-content:center;transition:background 0.3s;" onmouseover="this.style.background='#f1edec'" onmouseout="this.style.background='transparent'">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
        <!-- Modal Body -->
        <form id="edit-listing-form" style="display:flex;flex-direction:column;flex:1;overflow-y:auto;margin:0;">
          <div style="padding:24px;display:flex;flex-direction:column;gap:24px;">
            <!-- Title Field -->
            <div style="display:flex;flex-direction:column;gap:12px;">
              <label style="font-family:var(--sans, sans-serif);font-size:12px;color:#444748;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">Title</label>
              <input name="title" type="text" value="${sanitize(product.title)}" style="width:100%;background:#ffffff;border:1px solid #c4c7c7;color:#1c1b1b;font-family:var(--sans, sans-serif);font-size:16px;border-radius:8px;padding:12px 24px;outline:none;transition:border-color 0.2s;" onfocus="this.style.borderColor='#000000';this.previousElementSibling.style.color='#000000';" onblur="this.style.borderColor='#c4c7c7';this.previousElementSibling.style.color='#444748';" required/>
            </div>
            <!-- Description Field -->
            <div style="display:flex;flex-direction:column;gap:12px;">
              <label style="font-family:var(--sans, sans-serif);font-size:12px;color:#444748;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">Description</label>
              <textarea name="description" rows="4" style="width:100%;background:#ffffff;border:1px solid #c4c7c7;color:#1c1b1b;font-family:var(--sans, sans-serif);font-size:16px;border-radius:8px;padding:12px 24px;outline:none;transition:border-color 0.2s;resize:vertical;min-height:100px;" onfocus="this.style.borderColor='#000000';this.previousElementSibling.style.color='#000000';" onblur="this.style.borderColor='#c4c7c7';this.previousElementSibling.style.color='#444748';" required>${sanitize(product.description || '')}</textarea>
            </div>
            <!-- Price and Status Row -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
              <div style="display:flex;flex-direction:column;gap:12px;">
                <label style="font-family:var(--sans, sans-serif);font-size:12px;color:#444748;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">Price (${curr === 'IDR' ? 'Rp' : '$'})</label>
                <input name="price" type="number" step="${curr === 'IDR' ? '1' : '0.01'}" value="${displayPrice}" style="width:100%;background:#ffffff;border:1px solid #c4c7c7;color:#1c1b1b;font-family:var(--sans, sans-serif);font-size:16px;border-radius:8px;padding:12px 24px;outline:none;transition:border-color 0.2s;" onfocus="this.style.borderColor='#000000';this.previousElementSibling.style.color='#000000';" onblur="this.style.borderColor='#c4c7c7';this.previousElementSibling.style.color='#444748';" required/>
              </div>
              <div style="display:flex;flex-direction:column;gap:12px;">
                <label style="font-family:var(--sans, sans-serif);font-size:12px;color:#444748;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">Status</label>
                <div style="position:relative;">
                  <select name="status" style="width:100%;background:#ffffff;border:1px solid #c4c7c7;color:#1c1b1b;font-family:var(--sans, sans-serif);font-size:16px;border-radius:8px;padding:12px 24px;outline:none;transition:border-color 0.2s;appearance:none;cursor:pointer;" onfocus="this.style.borderColor='#000000';this.parentElement.previousElementSibling.style.color='#000000';" onblur="this.style.borderColor='#c4c7c7';this.parentElement.previousElementSibling.style.color='#444748';">
                    <option value="active" ${product.status === 'active' ? 'selected' : ''}>Active</option>
                    <option value="draft" ${product.status === 'draft' ? 'selected' : ''}>Draft</option>
                    <option value="sold" ${product.status === 'sold' ? 'selected' : ''}>Sold</option>
                  </select>
                  <div style="pointer-events:none;position:absolute;inset:0 12px 0 auto;display:flex;align-items:center;color:#615e58;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </div>
                </div>
              </div>
            </div>
            <!-- Category and Condition Row -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
              <div style="display:flex;flex-direction:column;gap:12px;">
                <label style="font-family:var(--sans, sans-serif);font-size:12px;color:#444748;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">Category</label>
                <div style="position:relative;">
                  <select name="category" style="width:100%;background:#ffffff;border:1px solid #c4c7c7;color:#1c1b1b;font-family:var(--sans, sans-serif);font-size:16px;border-radius:8px;padding:12px 24px;outline:none;transition:border-color 0.2s;appearance:none;cursor:pointer;" onfocus="this.style.borderColor='#000000';this.parentElement.previousElementSibling.style.color='#000000';" onblur="this.style.borderColor='#c4c7c7';this.parentElement.previousElementSibling.style.color='#444748';">
                    ${['None','Furniture','Seating','Decor','Storage & Tables','Lighting'].map(c => `<option value="${c.toLowerCase()}" ${product.category?.toLowerCase() === c.toLowerCase() ? 'selected' : ''}>${c}</option>`).join('')}
                  </select>
                  <div style="pointer-events:none;position:absolute;inset:0 12px 0 auto;display:flex;align-items:center;color:#615e58;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </div>
                </div>
              </div>
              <div style="display:flex;flex-direction:column;gap:12px;">
                <label style="font-family:var(--sans, sans-serif);font-size:12px;color:#444748;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;">Condition</label>
                <div style="position:relative;">
                  <select name="condition" style="width:100%;background:#ffffff;border:1px solid #c4c7c7;color:#1c1b1b;font-family:var(--sans, sans-serif);font-size:16px;border-radius:8px;padding:12px 24px;outline:none;transition:border-color 0.2s;appearance:none;cursor:pointer;" onfocus="this.style.borderColor='#000000';this.parentElement.previousElementSibling.style.color='#000000';" onblur="this.style.borderColor='#c4c7c7';this.parentElement.previousElementSibling.style.color='#444748';">
                    ${['Pristine','Like New','Excellent','Good','Fair'].map(c => `<option value="${c}" ${product.condition === c ? 'selected' : ''}>${c}</option>`).join('')}
                  </select>
                  <div style="pointer-events:none;position:absolute;inset:0 12px 0 auto;display:flex;align-items:center;color:#615e58;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <!-- Modal Footer -->
          <div style="padding:24px;border-top:1px solid #e5e2e1;display:flex;justify-content:flex-end;gap:16px;background:#ffffff;position:sticky;bottom:0;z-index:10;">
            <button type="button" id="cancel-edit" style="padding:12px 32px;background:transparent;border:1px solid #c4c7c7;color:#1c1b1b;font-family:var(--sans, sans-serif);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;border-radius:8px;cursor:pointer;transition:background 0.3s;" onmouseover="this.style.background='#f7f3f2'" onmouseout="this.style.background='transparent'">Cancel</button>
            <button type="submit" style="padding:12px 32px;background:#161e13;border:none;color:#ffffff;font-family:var(--sans, sans-serif);font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;border-radius:8px;cursor:pointer;box-shadow:0 2px 10px rgba(22,30,19,0.15);transition:all 0.3s;" onmouseover="this.style.background='#000000';this.style.boxShadow='0 4px 15px rgba(22,30,19,0.25)';" onmouseout="this.style.background='#161e13';this.style.boxShadow='0 2px 10px rgba(22,30,19,0.15)';">Save Changes</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.getElementById('cancel-edit')?.addEventListener('click', () => overlay.remove());
    document.getElementById('close-edit-modal')?.addEventListener('click', () => overlay.remove());

    document.getElementById('edit-listing-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      
      const inputPrice = parseFloat(fd.get('price'));
      const dbPrice = curr === 'IDR' ? inputPrice / 16000 : inputPrice;
      
      const updates = {
        title: fd.get('title'),
        description: fd.get('description'),
        price: dbPrice,
        status: fd.get('status'),
        category: fd.get('category'),
        condition: fd.get('condition'),
      };

      const { error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', productId)
        .eq('seller_id', user.id);

      if (error) {
        showToast("Failed to update: " + error.message);
      } else {
        showToast("Listing updated successfully!");
        overlay.remove();
        renderSell(); // Re-render the whole page with fresh data
      }
    });
  }
  } catch (err) {
    alert("Runtime error in renderSell: " + err.message + "\n" + err.stack);
    console.error(err);
  }
}