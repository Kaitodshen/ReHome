import { navigate } from "../router.js";
import state from "../state.js";
import { clampInteger, sanitizeShortText, toSafeNumber } from "../security.js";
import { getSupabaseClient } from "../supabaseClient.js";
import { showToast } from "../ui.js";

async function checkoutCart() {
  const supabase = await getSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Please sign in before checkout.");

  const { data: cartItems, error: cartError } = await supabase
    .from("cart_items")
    .select("id, quantity, product_id, products(id, title, price, carbon_offset, stock, seller_id)")
    .eq("user_id", user.id);

  if (cartError) throw cartError;
  if (!cartItems?.length) throw new Error("Your cart is empty.");

  // Apply accepted offer discounts
  const { data: offers } = await supabase
    .from("offers")
    .select("product_id, amount")
    .eq("buyer_id", user.id)
    .eq("status", "accepted");

  if (offers && offers.length > 0) {
    cartItems.forEach(item => {
      const offer = offers.find(o => o.product_id === item.product_id || (item.products && o.product_id === item.products.id));
      if (offer && item.products) {
        item.products.price = offer.amount;
      }
    });
  }

  const subtotal = cartItems.reduce((sum, item) => {
    const quantity = clampInteger(item.quantity, 1, 99, 1);
    return sum + (toSafeNumber(item.products?.price) * quantity);
  }, 0);
  const totalCarbonOffset = cartItems.reduce((sum, item) => {
    const quantity = clampInteger(item.quantity, 1, 99, 1);
    return sum + (toSafeNumber(item.products?.carbon_offset) * quantity);
  }, 0);
  
  const shipping = subtotal > 0 ? 50 : 0;
  const total = subtotal + shipping;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      user_id: user.id,
      status: "pending",
      subtotal,
      shipping,
      carbon_credit: totalCarbonOffset,
      total
    })
    .select("id")
    .single();

  if (orderError) throw orderError;

  const orderItems = cartItems.map((item) => {
    if (item.products?.seller_id === user.id) {
      throw new Error(`You cannot purchase your own item: ${item.products.title}`);
    }
    return {
      order_id: order.id,
      product_id: item.products?.id,
      title: sanitizeShortText(item.products?.title, "Untitled item"),
      quantity: clampInteger(item.quantity, 1, 99, 1),
      price: toSafeNumber(item.products?.price)
    };
  });

  const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
  if (itemsError) throw itemsError;

  // Prepare arrays for RPC
  const productIds = [];
  const quantities = [];
  for (const item of cartItems) {
    if (item.products?.id) {
      productIds.push(item.products.id);
      quantities.push(clampInteger(item.quantity, 1, 99, 1));
    }
  }

  // Call the secure RPC to reduce stock bypassing RLS restrictions
  if (productIds.length > 0) {
    const { error: rpcError } = await supabase.rpc('reduce_stock_on_checkout', {
      p_product_ids: productIds,
      p_quantities: quantities
    });
    
    // Fallback if RPC doesn't exist (user hasn't run the SQL yet)
    if (rpcError) {
      console.warn("RPC reduce_stock_on_checkout failed. Falling back to direct update:", rpcError);
      for (const item of cartItems) {
        const p = item.products;
        if (p && p.id) {
          const q = clampInteger(item.quantity, 1, 99, 1);
          const newStock = Math.max(0, (toSafeNumber(p.stock, 1)) - q);
          const newStatus = newStock === 0 ? 'sold' : 'active';
          
          await supabase.from("products").update({
            stock: newStock,
            status: newStatus
          }).eq("id", p.id);
        }
      }
    }
  }
  
  // Mark used offers as completed so they cannot be reused
  if (productIds.length > 0) {
    await supabase.from("offers")
      .update({ status: 'completed' })
      .eq("buyer_id", user.id)
      .eq("status", "accepted")
      .in("product_id", productIds);
  }

  // Add impact points to user profile
  if (totalCarbonOffset > 0) {
    const points = Math.floor(totalCarbonOffset * 10);
    const { data: prof } = await supabase.from("profiles").select("impact_score").eq("id", user.id).single();
    if (prof) {
      await supabase.from("profiles").update({ impact_score: (prof.impact_score || 0) + points }).eq("id", user.id);
    }
  }

  const { error: clearError } = await supabase.from("cart_items").delete().eq("user_id", user.id);
  if (clearError) throw clearError;
}

export async function renderCheckout() {
  const content = document.getElementById("checkout-content");
  const emptyState = document.getElementById("checkout-empty-state");
  const submitBtn = document.getElementById("btn-submit-checkout");
  const summaryBox = document.getElementById("co-summary-items");

  try {
    const supabase = await getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      if (content) content.style.display = "none";
      if (emptyState) {
        emptyState.style.display = "block";
        emptyState.querySelector("h2").textContent = "Please sign in";
        emptyState.querySelector("p").textContent = "You need to be signed in to checkout.";
      }
      return;
    }

    // Profile for shipping info
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    const shippingEl = document.getElementById("co-shipping-info");
    if (shippingEl) {
      shippingEl.innerHTML = `${profile?.full_name || "User"}<br>${profile?.location || "No address provided"}`;
    }

    // Cart items
    const { data: cartItems } = await supabase
      .from("cart_items")
      .select("id, quantity, products(id, title, price)")
      .eq("user_id", user.id);

    if (!cartItems || cartItems.length === 0) {
      if (content) content.style.display = "none";
      if (emptyState) emptyState.style.display = "block";
      return;
    }

    if (content) content.style.display = "grid";
    if (emptyState) emptyState.style.display = "none";

    let subtotal = 0;
    if (summaryBox) summaryBox.innerHTML = "";
    
    cartItems.forEach(item => {
      const p = item.products;
      if (!p) return;
      const q = clampInteger(item.quantity, 1, 99, 1);
      const price = toSafeNumber(p.price) * q;
      subtotal += price;
      
      if (summaryBox) {
        const div = document.createElement("div");
        div.className = "summary-item";
        div.innerHTML = `<span>${p.title} ${q > 1 ? 'x'+q : ''}</span>${window.formatCurrency(price)}`;
        summaryBox.appendChild(div);
      }
    });

    const shipping = subtotal > 0 ? 50 : 0;
    const total = subtotal + shipping;

    const elSub = document.getElementById("co-subtotal");
    const elShip = document.getElementById("co-shipping");
    const elTot = document.getElementById("co-total");

    if (elSub) elSub.textContent = "$" + subtotal.toLocaleString();
    if (elShip) elShip.textContent = shipping === 0 ? "Free" : "$" + shipping;
    if (elTot) elTot.textContent = "$" + total.toLocaleString();

    // QRIS Real-Time Sync Logic
    const payOptions = document.querySelectorAll('.pay-option');
    let paymentVerified = false;
    let selectedMethod = 'cc';
    
    // Reset button state
    if (submitBtn) {
      submitBtn.textContent = "Place Order Securely";
      submitBtn.disabled = false;
      submitBtn.style.background = "#3d5a30";
      paymentVerified = false;
    }

    let qrisChannel = null;
    let currentPaymentId = null;

    const setupQrisSync = async () => {
      if (qrisChannel) {
        supabase.removeChannel(qrisChannel);
      }
      
      currentPaymentId = crypto.randomUUID();
      const baseUrl = window.location.origin + window.location.pathname;
      const payUrl = `${baseUrl}?simulate_pay=${currentPaymentId}&amount=${total}`;
      
      const qrisImg = document.getElementById('qris-img');
      if (qrisImg) {
        qrisImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(payUrl)}`;
      }

      qrisChannel = supabase.channel(`payment-${currentPaymentId}`);
      
      qrisChannel.on('broadcast', { event: 'payment_success' }, (payload) => {
        paymentVerified = true;
        
        const waitText = document.getElementById('qris-wait-text');
        if (waitText) {
          waitText.innerHTML = '<span style="color:#166534; font-weight:700;">Payment Received from Mobile</span>';
        }

        if (submitBtn) {
          submitBtn.textContent = "Payment Verified - Complete Order";
          submitBtn.disabled = false;
          submitBtn.style.background = "#3d5a30";
        }
        showToast("QRIS Payment Sync Successful!");
        
        // Auto submit checkout after 1 second for seamless experience
        setTimeout(() => {
          if (!submitBtn.disabled) submitBtn.click();
        }, 1000);
      }).subscribe();
    };

    payOptions.forEach(opt => {
      const radio = opt.querySelector('input[type="radio"]');
      if (!radio) return;
      radio.addEventListener('change', () => {
        payOptions.forEach(o => o.classList.remove('selected'));
        document.querySelectorAll('.pay-details').forEach(d => d.style.display = 'none');
        
        if (radio.checked) {
          opt.classList.add('selected');
          const detailsId = `pay-details-${radio.value}`;
          const detailsEl = document.getElementById(detailsId);
          if (detailsEl) detailsEl.style.display = 'block';
          selectedMethod = radio.value;

          if (selectedMethod === 'qris') {
             setupQrisSync();
          }

          if (selectedMethod === 'qris' || selectedMethod === 'va') {
            paymentVerified = false;
            if (submitBtn) {
              submitBtn.textContent = "Waiting for Payment...";
              submitBtn.disabled = true;
              submitBtn.style.background = "#a8a29e";
            }
          } else {
            paymentVerified = true;
            if (submitBtn) {
              submitBtn.textContent = "Place Order Securely";
              submitBtn.disabled = false;
              submitBtn.style.background = "#3d5a30";
            }
          }
        }
      });
    });

    // VA Simulator Logic
    const vaDetails = document.getElementById('pay-details-va');
    if (vaDetails) {
      const copyBtn = vaDetails.querySelector('button');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          copyBtn.textContent = "Copied!";
          copyBtn.style.background = "#dcfce7";
          copyBtn.style.color = "#166534";
          
          showToast("Virtual Account copied! Simulating payment...");
          
          // Simulate bank callback after 2 seconds
          setTimeout(() => {
            paymentVerified = true;
            if (submitBtn) {
              submitBtn.textContent = "Payment Verified - Complete Order";
              submitBtn.disabled = false;
              submitBtn.style.background = "#3d5a30";
            }
            showToast("Bank Transfer Verified!");
            
            const waitingText = vaDetails.querySelector('p:last-child');
            if (waitingText) {
              waitingText.innerHTML = '<span style="color:#166534; font-weight:700;">Payment Received</span>';
            }
          }, 2000);
        });
      }
    }

    if (submitBtn && submitBtn.dataset.checkoutBound !== "true") {
      submitBtn.dataset.checkoutBound = "true";
      submitBtn.addEventListener("click", async () => {
        if (!paymentVerified && selectedMethod !== 'cc') {
          showToast("Please complete the payment process first.");
          return;
        }

        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = "Processing...";
        
        try {
          // If credit card, simulate a brief loading state
          if (selectedMethod === 'cc') {
             submitBtn.textContent = "Authorizing Card...";
             await new Promise(r => setTimeout(r, 1500));
          }

          await checkoutCart();
          if (window.updateGlobalCartBadge) await window.updateGlobalCartBadge();
          navigate("confirmation");
        } catch (err) {
          showToast(err.message || "Failed to checkout.");
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      });
    }

  } catch (error) {
    showToast("Error loading checkout data.");
  }
}
