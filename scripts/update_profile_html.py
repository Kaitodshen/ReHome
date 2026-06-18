import json

html_content = """
<div style="max-width: 1440px; margin: 0 auto; padding: 0 24px 120px; font-family: var(--sans); color: #201a1a; box-sizing: border-box; background: #f7f9f8; min-height: 100vh;">

  <!-- Top Profile Container -->
  <section style="width: 100%; padding: 48px; padding-bottom: 24px; display: flex; align-items: flex-start; gap: 48px; border-bottom: 1px solid #e5e7eb;">
    <!-- Profile Picture -->
    <div style="position: relative; width: 192px; height: 192px; border-radius: 50%; border: 4px solid white; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); overflow: hidden; flex-shrink: 0; background: white;">
      <div id="profile-avatar-img" style="width: 100%; height: 100%; background: #1c1917; display: flex; align-items: center; justify-content: center; font-size: 64px; font-weight: 700; color: white;">
        <span id="profile-initial">V</span>
      </div>
      <!-- Verification Badge -->
      <div style="position: absolute; bottom: 16px; right: 16px; width: 32px; height: 32px; background: #536E5B; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05);">
        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.403 12.652a3 3 0 000-5.304 3 3 0 00-3.75-3.751 3 3 0 00-5.305 0 3 3 0 00-3.751 3.75 3 3 0 000 5.305 3 3 0 003.75 3.751 3 3 0 005.305 0 3 3 0 003.751-3.75zm-2.546-4.46a.75.75 0 00-1.214-.883l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd"></path></svg>
      </div>
    </div>
    
    <!-- Header Info & Actions -->
    <div style="flex: 1; display: flex; align-items: flex-start; justify-content: space-between; margin-top: 32px; gap: 24px;">
      <div>
        <div id="profile-join-date" style="font-size: 14px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; font-weight: 500;">Member since 2021</div>
        <h1 id="profile-name-display" style="font-size: 48px; font-family: var(--serif, 'Playfair Display', serif); color: #111827; margin: 0 0 12px; letter-spacing: -0.025em;">&nbsp;</h1>
        <p style="color: #6b7280; font-size: 18px; margin: 0;"><span id="profile-description"></span> &bull; <span id="profile-location"></span></p>
      </div>
      <div style="display: flex; align-items: center; gap: 16px;">
        <button data-route="sell" style="background: #536E5B; color: white; padding: 10px 24px; border-radius: 9999px; font-weight: 500; font-size: 14px; display: flex; align-items: center; gap: 8px; border: none; cursor: pointer; box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05); transition: opacity 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>
          Seller Dashboard
        </button>
        <button data-route="settings" style="width: 40px; height: 40px; border-radius: 50%; border: 1px solid #d1d5db; display: flex; align-items: center; justify-content: center; color: #4b5563; background: transparent; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='transparent'" title="Settings">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
        </button>
      </div>
    </div>
  </section>

  <div style="display: flex; width: 100%; padding-top: 32px;">
    <!-- Left Sidebar -->
    <aside style="width: 400px; flex-shrink: 0; padding: 0 48px; border-right: 1px solid #e5e7eb;">
      
      <!-- Account Info Card -->
      <div style="background: white; border-radius: 16px; padding: 24px; box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05); border: 1px solid #f3f4f6; margin-bottom: 24px;">
        <h3 style="font-family: var(--serif, 'Playfair Display', serif); font-size: 20px; margin: 0 0 24px; color: #111827;">Account Info</h3>
        <div style="display: flex; flex-direction: column; gap: 16px; margin-bottom: 32px;">
          <div style="display: flex; gap: 16px; align-items: flex-start;">
            <svg width="20" height="20" fill="none" stroke="#9ca3af" viewBox="0 0 24 24" style="margin-top: 2px; flex-shrink: 0;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
            <span id="profile-email-display" style="color: #4b5563; font-size: 14px; word-break: break-all;">&nbsp;</span>
          </div>
          <div style="display: flex; gap: 16px; align-items: flex-start;">
            <svg width="20" height="20" fill="none" stroke="#9ca3af" viewBox="0 0 24 24" style="margin-top: 2px; flex-shrink: 0;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            <span style="color: #4b5563; font-size: 14px;">Bengkong, Indonesia</span>
          </div>
          <div style="display: flex; gap: 16px; align-items: flex-start;">
            <svg width="20" height="20" fill="none" stroke="#9ca3af" viewBox="0 0 24 24" style="margin-top: 2px; flex-shrink: 0;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <span style="color: #4b5563; font-size: 14px;">Indonesia</span>
          </div>
        </div>
        <div data-route="edit-profile" style="padding-top: 16px; border-top: 1px solid #f3f4f6; display: flex; justify-content: space-between; align-items: center; cursor: pointer;" onmouseover="this.querySelector('span').style.color='#536E5B'; this.querySelector('svg').style.color='#536E5B'" onmouseout="this.querySelector('span').style.color='#111827'; this.querySelector('svg').style.color='#9ca3af'">
          <span style="font-size: 14px; font-weight: 500; color: #111827; transition: color 0.2s;">Edit Profile</span>
          <svg width="16" height="16" fill="none" stroke="#9ca3af" viewBox="0 0 24 24" style="transition: color 0.2s;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
        </div>
      </div>

      <!-- Impact Score Card -->
      <div style="background: #f8ede6; border-radius: 16px; padding: 24px; box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05); border: 1px solid #f0e0d5; margin-bottom: 24px;">
        <div style="display: flex; align-items: center; gap: 8px; color: #536E5B; margin-bottom: 16px;">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"></path></svg>
          <span style="font-weight: 500; font-size: 14px;">Impact Score</span>
        </div>
        <div id="profile-impact-score" style="font-size: 36px; font-family: var(--serif, 'Playfair Display', serif); color: #111827; margin-bottom: 8px;">0</div>
        <p style="font-size: 12px; color: #4b5563; line-height: 1.625; margin: 0;">Equivalent to planting <strong id="profile-tree-count">0</strong> trees through circular shopping.</p>
      </div>

      <button id="profile-logout-btn" style="width: 100%; padding: 12px; background: transparent; border: 1px solid #fca5a5; color: #dc2626; font-weight: 500; font-size: 14px; cursor: pointer; border-radius: 8px; transition: 0.2s;" onmouseover="this.style.background='#fef2f2'" onmouseout="this.style.background='transparent'">Sign Out</button>
    </aside>

    <!-- Main Dashboard Content -->
    <section style="flex: 1; padding: 0 48px;">
      <!-- Tab Navigation -->
      <div style="border-bottom: 1px solid #e5e7eb; margin-bottom: 32px; overflow-x: auto; scrollbar-width: none;">
        <nav style="display: flex; gap: 32px; white-space: nowrap;">
          <a href="#" class="profile-tab active" data-tab="purchase" style="padding-bottom: 16px; border-bottom: 2px solid #536E5B; color: #536E5B; font-weight: 500; font-size: 14px; text-decoration: none;">Purchase History</a>
          <a href="#" class="profile-tab" data-tab="selling" style="padding-bottom: 16px; border-bottom: 2px solid transparent; color: #6b7280; font-weight: 500; font-size: 14px; text-decoration: none;" onmouseover="this.style.color='#374151'" onmouseout="this.style.color='#6b7280'">Selling History</a>
          <a href="#" class="profile-tab" data-tab="offers" style="padding-bottom: 16px; border-bottom: 2px solid transparent; color: #6b7280; font-weight: 500; font-size: 14px; text-decoration: none;" onmouseover="this.style.color='#374151'" onmouseout="this.style.color='#6b7280'">My Offers</a>
          <a href="#" class="profile-tab" data-tab="saved" style="padding-bottom: 16px; border-bottom: 2px solid transparent; color: #6b7280; font-weight: 500; font-size: 14px; text-decoration: none; display: flex; align-items: center; gap: 8px;" onmouseover="this.style.color='#374151'" onmouseout="this.style.color='#6b7280'">
            Saved Items
            <span id="profile-saved-count" style="background: #f3f4f6; color: #4b5563; font-size: 12px; padding: 2px 8px; border-radius: 9999px;">0</span>
          </a>
        </nav>
      </div>

      <!-- Tab Contents -->
      <div id="tab-purchase" class="tab-content" style="display: block;">
        <div id="purchase-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 32px;">
          <!-- Items will be injected by profile.js -->
        </div>
      </div>

      <div id="tab-selling" class="tab-content" style="display: none;">
        <div style="background: white; border-radius: 24px; padding: 60px 40px; text-align: center; border: 1px solid #f3f4f6;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" stroke-width="2" style="margin-bottom: 16px; display: inline-block;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
          <h3 style="margin: 0 0 8px; font-size: 18px; color: #111827;">No Sales Yet</h3>
          <p style="color: #6b7280; margin: 0;">You haven't sold any items yet.</p>
        </div>
      </div>

      <div id="tab-offers" class="tab-content" style="display: none;">
        <div id="profile-offers-list" style="display: flex; flex-direction: column; gap: 24px;">
          <!-- Offers dynamically inserted here -->
        </div>
      </div>

      <div id="tab-saved" class="tab-content" style="display: none;">
        <div id="saved-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 32px;">
          <!-- Saved items injected by profile.js -->
        </div>
      </div>

    </section>
  </div>
</div>

<!-- Order Tracking Modal -->
<div id="order-tracking-modal" style="display:none; position:fixed; inset:0; z-index:1000; background:rgba(28,25,23,0.8); backdrop-filter:blur(4px); align-items:center; justify-content:center;">
  <div style="background:white; width:90%; max-width:480px; border-radius:24px; padding:32px; position:relative; box-shadow:0 20px 40px rgba(0,0,0,0.2);">
    <button id="btn-close-tracking" style="position:absolute; top:20px; right:20px; background:none; border:none; cursor:pointer; color:#a8a29e; padding:4px;">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    </button>
    
    <h2 style="margin:0 0 8px; font-size:20px; font-weight:700; color:#1c1917;">Order Details</h2>
    <p id="track-order-id" style="margin:0 0 24px; font-size:13px; color:#78716c;">Order #123456</p>
    
    <div style="display:flex; gap:16px; margin-bottom:32px; align-items:center; background:#fbfaf9; padding:16px; border-radius:16px;">
      <img id="track-img" src="" style="width:64px; height:64px; object-fit:cover; border-radius:12px; background:#e7e5e4;">
      <div>
        <div id="track-title" style="font-weight:700; font-size:15px; color:#1c1917; margin-bottom:4px;">Product Name</div>
        <div id="track-price" style="font-weight:600; font-size:14px; color:#536E5B;">$0.00</div>
      </div>
    </div>

    <h3 style="margin:0 0 16px; font-size:15px; font-weight:700; color:#1c1917;">Tracking Status</h3>
    <div style="position:relative; margin-left:12px;">
      <!-- Vertical Line -->
      <div style="position:absolute; top:8px; bottom:8px; left:6px; width:2px; background:#e7e5e4; z-index:1;"></div>
      
      <!-- Steps -->
      <div style="display:flex; gap:16px; margin-bottom:24px; position:relative; z-index:2;">
        <div style="width:14px; height:14px; border-radius:50%; background:#536E5B; border:4px solid white; box-shadow:0 0 0 1px #536E5B; flex-shrink:0;"></div>
        <div style="margin-top:-3px;">
          <div style="font-weight:700; font-size:14px; color:#1c1917;">Order Placed</div>
          <div style="font-size:12px; color:#78716c; margin-top:2px;">Payment confirmed successfully.</div>
        </div>
      </div>
      
      <div style="display:flex; gap:16px; margin-bottom:24px; position:relative; z-index:2;">
        <div style="width:14px; height:14px; border-radius:50%; background:#536E5B; border:4px solid white; box-shadow:0 0 0 1px #536E5B; flex-shrink:0;"></div>
        <div style="margin-top:-3px;">
          <div style="font-weight:700; font-size:14px; color:#1c1917;">Preparing Package</div>
          <div style="font-size:12px; color:#78716c; margin-top:2px;">Seller is packing your item using eco-materials.</div>
        </div>
      </div>
      
      <div style="display:flex; gap:16px; margin-bottom:24px; position:relative; z-index:2;">
        <div style="width:14px; height:14px; border-radius:50%; background:#e7e5e4; border:4px solid white; box-shadow:0 0 0 1px #e7e5e4; flex-shrink:0;" id="track-step-transit-dot"></div>
        <div style="margin-top:-3px;">
          <div style="font-weight:700; font-size:14px; color:#a8a29e;" id="track-step-transit-title">In Transit</div>
          <div style="font-size:12px; color:#a8a29e; margin-top:2px;" id="track-step-transit-desc">Low-emission delivery in progress.</div>
        </div>
      </div>
      
      <div style="display:flex; gap:16px; position:relative; z-index:2;">
        <div style="width:14px; height:14px; border-radius:50%; background:#e7e5e4; border:4px solid white; box-shadow:0 0 0 1px #e7e5e4; flex-shrink:0;" id="track-step-arrived-dot"></div>
        <div style="margin-top:-3px;">
          <div style="font-weight:700; font-size:14px; color:#a8a29e;" id="track-step-arrived-title">Delivered</div>
          <div style="font-size:12px; color:#a8a29e; margin-top:2px;" id="track-step-arrived-desc">Package has safely arrived.</div>
        </div>
      </div>
    </div>
  </div>
</div>
"""

with open("d:\\Desktop\\flutter\\TugasFigma\\views\\profile.html", "w", encoding="utf-8") as f:
    f.write(html_content)

print("Updated profile.html")
