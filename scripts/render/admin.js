// scripts/render/admin.js
//
// ─── REQUIRED SUPABASE RLS POLICIES ──────────────────────────────────────────
// Run these in the Supabase SQL Editor so the admin can read all data:
//
// CREATE POLICY "Admin view all orders" ON public.orders
//   FOR SELECT TO authenticated
//   USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
//
// CREATE POLICY "Admin view all order items" ON public.order_items
//   FOR SELECT TO authenticated
//   USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
//
// CREATE POLICY "Admin delete products" ON public.products
//   FOR DELETE TO authenticated
//   USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
//
// CREATE POLICY "Admin update any profile role" ON public.profiles
//   FOR UPDATE TO authenticated
//   USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
// ─────────────────────────────────────────────────────────────────────────────

import { getSupabaseClient } from '../supabaseClient.js';
import { navigate } from '../router.js';
import { showToast } from '../ui.js';

/* ── helpers ──────────────────────────────────────────────────────────────── */

function sanitize(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, tag =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatMoney(n) {
  const num = Number(n) || 0;
  return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function roleBadge(role) {
  const r = sanitize(role || 'buyer').toLowerCase();
  return `<span class="adm-role-badge ${r}">${r.charAt(0).toUpperCase() + r.slice(1)}</span>`;
}

function statusBadge(status) {
  const s = sanitize(status || 'active').toLowerCase();
  return `<span class="adm-status-badge ${s}">${s.charAt(0).toUpperCase() + s.slice(1)}</span>`;
}

function avatarHtml(url, name) {
  const initial = (name || '?').charAt(0).toUpperCase();
  if (url) {
    return `<div class="adm-avatar"><img src="${sanitize(url)}" alt="${sanitize(name)}" onerror="this.parentElement.innerHTML='${initial}'"></div>`;
  }
  return `<div class="adm-avatar">${initial}</div>`;
}

/* ── main render ─────────────────────────────────────────────────────────── */

export async function renderAdmin() {
  let supabase;
  try {
    supabase = await getSupabaseClient();
  } catch {
    showToast('Failed to initialise database connection.');
    navigate('home');
    return;
  }

  /* ── 1. Auth check ─────────────────────────────────────────────────── */
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    showToast('Please sign in first.');
    navigate('home');
    return;
  }

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!myProfile || myProfile.role !== 'admin') {
    showToast('Access denied — admin only.');
    navigate('home');
    return;
  }

  /* ── 2. Fetch all data in parallel ─────────────────────────────────── */
  const [profilesRes, productsRes, ordersRes] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('products').select('*, profiles(full_name)').order('created_at', { ascending: false }),
    supabase.from('orders').select('*, order_items(id, title, quantity, price)').order('created_at', { ascending: false }),
  ]);

  const profiles = profilesRes.data || [];
  const products = productsRes.data || [];
  const orders   = ordersRes.data   || [];

  // Build a quick user-id → profile map for order buyer lookups
  const profileMap = new Map(profiles.map(p => [p.id, p]));

  /* ── 3. Populate stat cards ────────────────────────────────────────── */
  const totalRevenue = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  const elUsers    = document.getElementById('stat-users');
  const elProducts = document.getElementById('stat-products');
  const elOrders   = document.getElementById('stat-orders');
  const elRevenue  = document.getElementById('stat-revenue');

  if (elUsers)    elUsers.textContent    = profiles.length;
  if (elProducts) elProducts.textContent = products.length;
  if (elOrders)   elOrders.textContent   = orders.length;
  if (elRevenue)  elRevenue.textContent  = `${window.formatCurrency(totalRevenue)}`;

  // Tab counts
  const cntUsers    = document.getElementById('adm-count-users');
  const cntProducts = document.getElementById('adm-count-products');
  const cntOrders   = document.getElementById('adm-count-orders');
  if (cntUsers)    cntUsers.textContent    = profiles.length;
  if (cntProducts) cntProducts.textContent = products.length;
  if (cntOrders)   cntOrders.textContent   = orders.length;

  /* ── 4. Render users table ─────────────────────────────────────────── */
  const usersBody = document.getElementById('admin-users-body');
  if (usersBody) {
    if (profiles.length === 0) {
      usersBody.innerHTML = '<tr><td colspan="6" class="adm-empty">No users found.</td></tr>';
    } else {
      usersBody.innerHTML = profiles.map(p => {
        const isMe = p.id === user.id;
        const toggleRole = p.role === 'admin' ? 'buyer' : 'admin';
        const btnLabel   = p.role === 'admin' ? 'Make Buyer' : 'Make Admin';
        return `<tr>
          <td>${avatarHtml(p.avatar_url, p.full_name)}</td>
          <td style="font-weight:600;">${sanitize(p.full_name || '—')}</td>
          <td style="color:#78716c;">${sanitize(p.email || '—')}</td>
          <td>${roleBadge(p.role)}</td>
          <td><span style="font-weight:600; color:#3d5a30;">${p.impact_score ?? 0}</span></td>
          <td>${isMe
            ? '<span style="font-size:12px;color:#a8a29e;">You</span>'
            : `<div style="display:flex;gap:8px;"><button class="adm-btn adm-btn-role" data-action="role" data-uid="${p.id}" data-role="${toggleRole}">${btnLabel}</button><button class="adm-btn adm-btn-delete" data-action="delete-user" data-uid="${p.id}">Delete</button></div>`
          }</td>
        </tr>`;
      }).join('');
    }

    // Delegate clicks
    usersBody.addEventListener('click', async (e) => {
      const roleBtn = e.target.closest('[data-action="role"]');
      const delBtn = e.target.closest('[data-action="delete-user"]');

      if (roleBtn) {
        const uid  = roleBtn.dataset.uid;
        const role = roleBtn.dataset.role;
        roleBtn.disabled = true;
        roleBtn.textContent = 'Updating…';

        const { error } = await supabase.from('profiles').update({ role }).eq('id', uid);

        if (error) {
          showToast(`Failed to update role: ${error.message}`);
          roleBtn.disabled = false;
          roleBtn.textContent = role === 'admin' ? 'Make Admin' : 'Make Buyer';
        } else {
          showToast(`Role updated to ${role}.`);
          renderAdmin(); // refresh
        }
      }

      if (delBtn) {
        const uid = delBtn.dataset.uid;
        if (!confirm('Are you sure you want to completely delete this user and all their data?')) return;
        delBtn.disabled = true;
        delBtn.textContent = 'Deleting…';
        
        // Due to Supabase restrictions, regular admins often cannot delete from auth.users directly via SQL unless using service_role.
        // We will try to delete from profiles, and if it cascades or succeeds, great. If not, tell the user.
        const { error } = await supabase.from('profiles').delete().eq('id', uid);
        if (error) {
           showToast(`Delete failed (You might need service_role privileges): ${error.message}`);
           delBtn.disabled = false;
           delBtn.textContent = 'Delete';
        } else {
           showToast('User profile deleted.');
           renderAdmin(); // refresh
        }
      }
    });
  }

  /* ── 5. Render products table ──────────────────────────────────────── */
  const productsBody = document.getElementById('admin-products-body');
  if (productsBody) {
    if (products.length === 0) {
      productsBody.innerHTML = '<tr><td colspan="7" class="adm-empty">No products found.</td></tr>';
    } else {
      productsBody.innerHTML = products.map(p => {
        const sellerName = p.profiles?.full_name || '—';
        return `<tr>
          <td><img class="adm-thumb" src="${sanitize(p.image_url || '')}" alt="${sanitize(p.title)}" onerror="this.style.background='#f4f3ef';this.alt='No image'"></td>
          <td style="font-weight:600; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${sanitize(p.title)}</td>
          <td style="font-weight:600; color:#3d5a30;">${window.formatCurrency(p.price)}</td>
          <td>${p.stock ?? 0}</td>
          <td>${statusBadge(p.status)}</td>
          <td style="color:#78716c;">${sanitize(sellerName)}</td>
          <td><button class="adm-btn adm-btn-delete" data-action="delete-product" data-pid="${p.id}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-2 14H7L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg>
            Delete
          </button></td>
        </tr>`;
      }).join('');
    }

    // Delegate product-delete clicks
    productsBody.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action="delete-product"]');
      if (!btn) return;

      const pid = btn.dataset.pid;
      if (!confirm('Are you sure you want to delete this product?')) return;

      btn.disabled = true;
      btn.textContent = 'Deleting…';

      const { error } = await supabase.from('products').delete().eq('id', pid);
      if (error) {
        showToast(`Delete failed: ${error.message}`);
        btn.disabled = false;
        btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-2 14H7L5 6"></path></svg> Delete`;
      } else {
        showToast('Product deleted.');
        btn.closest('tr').remove();
        // Update counts
        const newCount = productsBody.querySelectorAll('tr').length;
        if (elProducts) elProducts.textContent = newCount;
        if (cntProducts) cntProducts.textContent = newCount;
      }
    });
  }

  /* ── 6. Render orders table ────────────────────────────────────────── */
  const ordersBody = document.getElementById('admin-orders-body');
  if (ordersBody) {
    if (orders.length === 0) {
      ordersBody.innerHTML = '<tr><td colspan="6" class="adm-empty">No orders found.</td></tr>';
    } else {
      ordersBody.innerHTML = orders.map(o => {
        const buyer = profileMap.get(o.user_id);
        const buyerName = buyer ? sanitize(buyer.full_name) : sanitize(o.user_id?.slice(0, 8) || '—');
        const itemCount = (o.order_items || []).reduce((s, i) => s + (i.quantity || 1), 0);
        const itemNames = (o.order_items || []).map(i => sanitize(i.title)).join(', ') || '—';
        return `<tr>
          <td><code style="font-size:13px; background:#f4f3ef; padding:3px 8px; border-radius:6px; color:#57534e;">${sanitize((o.id || '').slice(0, 8))}</code></td>
          <td style="font-weight:600;">${buyerName}</td>
          <td style="color:#78716c; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${itemNames}">${itemCount} item${itemCount !== 1 ? 's' : ''}</td>
          <td style="font-weight:600; color:#3d5a30;">${window.formatCurrency(o.total)}</td>
          <td>${statusBadge(o.status)}</td>
          <td style="color:#78716c; white-space:nowrap;">${formatDate(o.created_at)}</td>
          <td><button class="adm-btn adm-btn-delete" data-action="delete-order" data-oid="${o.id}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-2 14H7L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg> Delete
          </button></td>
        </tr>`;
      }).join('');
    }

    ordersBody.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action="delete-order"]');
      if (!btn) return;

      const oid = btn.dataset.oid;
      if (!confirm('Are you sure you want to delete this order?')) return;

      btn.disabled = true;
      btn.textContent = 'Deleting…';

      const { error } = await supabase.from('orders').delete().eq('id', oid);
      if (error) {
        showToast(`Delete failed: ${error.message}`);
        btn.disabled = false;
        btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-2 14H7L5 6"></path></svg> Delete`;
      } else {
        showToast('Order deleted.');
        renderAdmin();
      }
    });
  }

  /* ── 7. Wire tab switching ─────────────────────────────────────────── */
  const tabs = document.querySelectorAll('.admin-tab[data-tab]');
  const panes = document.querySelectorAll('.adm-tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const target = tab.dataset.tab;

      // Toggle active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Toggle active pane
      panes.forEach(p => p.classList.remove('active'));
      const targetPane = document.getElementById(`admin-tab-${target}`);
      if (targetPane) targetPane.classList.add('active');
    });
  });
}
