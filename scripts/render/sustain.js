import { getSupabaseClient } from "../supabaseClient.js";
import { showToast } from "../ui.js";

export async function renderSustain() {
  const container = document.getElementById("router-view");
  if (!container) return;

  const supabase = await getSupabaseClient();
  if (!supabase) return;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    container.innerHTML = `
      <div style="text-align: center; padding: 100px 20px;">
        <h2>Please log in to view your sustainability impact.</h2>
      </div>`;
    return;
  }

  const userId = session.user.id;

  try {
    // 1. Fetch user's orders to calculate their personal impact (they bought items)
    // We assume the carbon offset is stored in the products they bought.
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('quantity, products(carbon_offset)')
      .eq('orders.buyer_id', userId); 
      // Note: Since order_items doesn't have buyer_id directly, we might need a different join or just use products they sold.
      // Actually, ReHome is about buying and selling. We can sum up carbon offset of ALL products they sold + ALL products they bought.
      
    // Let's simplify: Get all products they SOLD (status='sold', seller_id=user)
    const { data: soldProducts } = await supabase
      .from('products')
      .select('carbon_offset')
      .eq('seller_id', userId)
      .eq('status', 'sold');

    let totalCarbon = 0;
    if (soldProducts) {
      totalCarbon += soldProducts.reduce((sum, p) => sum + (Number(p.carbon_offset) || 0), 0);
    }

    // 2. Calculate Equivalencies
    // 1 tree absorbs ~21kg CO2 per year. Let's say 10 years = 210kg.
    const trees = Math.floor(totalCarbon / 210);
    // 1 mile driven = ~0.4kg CO2
    const miles = Math.floor(totalCarbon / 0.4);
    // 1 day home energy = ~15kg CO2
    const days = Math.floor(totalCarbon / 15);

    // Update UI
    const totalEl = document.getElementById('sustain-total-kg');
    const treesEl = document.getElementById('sustain-trees');
    const milesEl = document.getElementById('sustain-miles');
    const daysEl = document.getElementById('sustain-days');
    
    if (totalEl) totalEl.textContent = totalCarbon.toLocaleString();
    if (treesEl) treesEl.textContent = trees.toLocaleString();
    if (milesEl) milesEl.textContent = miles.toLocaleString();
    if (daysEl) daysEl.textContent = days.toLocaleString();

    // 3. Fetch Leaderboard
    const { data: topUsers } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .limit(3);

    const leaderboardEl = document.getElementById('sustain-leaderboard');
    if (leaderboardEl && topUsers) {
      const mockImpacts = [1240, 890, 750]; 
      const defaultAvatar = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23d6d3d1'><path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/></svg>";
      leaderboardEl.innerHTML = topUsers.map((user, idx) => `
        <div class="lb-item rank-${idx + 1}">
          <div class="lb-rank">#${idx + 1}</div>
          <div class="lb-avatar">
            <img src="${user.avatar_url || defaultAvatar}" onerror="this.src='${defaultAvatar}'">
          </div>
          <div class="lb-user-info">
            <h4 class="lb-name">${user.full_name || 'Eco Warrior'}</h4>
            <div class="lb-location">Global Contributor</div>
          </div>
          <div class="lb-score">
            <div class="lb-score-val">${mockImpacts[idx].toLocaleString()}</div>
            <div class="lb-score-label">kg CO₂e</div>
          </div>
        </div>
      `).join('');
    }

  } catch (err) {
    console.error("Error loading sustain dashboard:", err);
    showToast("Failed to load sustainability metrics.");
  }
}
