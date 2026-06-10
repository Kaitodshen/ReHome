// scripts/render/new-listing.js — Create New Listing form, connected to Supabase
import { getSupabaseClient } from "../supabaseClient.js";
import { navigate } from "../router.js";
import { showToast } from "../ui.js";
import { callGeminiAPI, generateMockAIData } from "../ai.js";

export async function renderNewListing() {
  const container = document.getElementById("router-view");
  if (!container) return;

  const supabase = await getSupabaseClient();
  if (!supabase) { showToast("Database not connected."); return; }

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) { navigate("home"); return; }

  let aiBasePrice = null;

  // ─── Pre-fill if reselling ───
  let resellData = null;
  try {
    const rawData = localStorage.getItem('rehome_resell_data');
    if (rawData) {
      resellData = JSON.parse(rawData);
      localStorage.removeItem('rehome_resell_data'); // clear it
      
      const form = document.getElementById('new-listing-form');
      if (form) {
        const setSelectValue = (name, val) => {
          const el = form.querySelector(`[name="${name}"]`);
          if (!el || !val) return;
          const searchVal = val.toLowerCase();
          const options = Array.from(el.options).filter(o => o.value);
          let match = options.find(o => o.text.toLowerCase() === searchVal || o.value.toLowerCase() === searchVal);
          if (!match) {
            match = options.find(o => searchVal.includes(o.text.toLowerCase()) || searchVal.includes(o.value.toLowerCase()));
          }
          if (match) el.value = match.value;
        };

        if (resellData.title) { const el = form.querySelector('[name="title"]'); if (el) el.value = resellData.title; }
        if (resellData.description) { const el = form.querySelector('[name="description"]'); if (el) el.value = resellData.description; }
        if (resellData.price) { const el = form.querySelector('[name="price"]'); if (el) el.value = resellData.price; }
        const offsetVal = resellData.carbon_offset || resellData.eco_offset;
        if (offsetVal) { const el = form.querySelector('[name="carbon_offset"]'); if (el) el.value = offsetVal; }
        setSelectValue('category', resellData.category);
        setSelectValue('condition', resellData.condition);

        if (resellData.quantity) {
          const el = form.querySelector('[name="stock"]');
          if (el) {
            el.value = resellData.quantity;
            el.max = resellData.quantity;
          }
        }
      }
      
      if (resellData.image_url) {
        const previewContainer = document.getElementById('nl-preview-row');
        const uploadArea = document.getElementById('nl-upload-area');
        if (previewContainer && uploadArea) {
          Array.from(uploadArea.children).forEach(child => {
            if (child.id !== 'nl-preview-row') child.style.display = 'none';
          });
          previewContainer.innerHTML = `<div style="position:relative;display:inline-block;"><img src="${resellData.image_url}" class="nl-preview-thumb"></div>`;
        }
      }
    }
  } catch (err) {
    console.error("Error reading resell data:", err);
  }

  // ─── Bind file upload ───
  const uploadArea = document.getElementById('nl-upload-area');
  const fileInput = document.getElementById('nl-file-input');
  const previewContainer = document.getElementById('nl-preview-row');
  let selectedFiles = [];

  if (uploadArea && fileInput) {
    uploadArea.addEventListener('click', (e) => {
      if (e.target.closest('#nl-preview-row')) return;
      fileInput.click();
    });

    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.style.borderColor = '#3d5a30';
      uploadArea.style.background = '#f0f4ea';
    });
    uploadArea.addEventListener('dragleave', () => {
      uploadArea.style.borderColor = '#c8c6c0';
      uploadArea.style.background = '#f5f4f1';
    });
    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.style.borderColor = '#c8c6c0';
      uploadArea.style.background = '#f5f4f1';
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        addFiles(e.target.files);
      }
    });
  }

  function addFiles(files) {
    const wasEmpty = selectedFiles.length === 0;
    for (let i = 0; i < files.length; i++) {
      if (selectedFiles.length >= 8) break;
      selectedFiles.push(files[i]);
    }
    renderPreviews();

    if (wasEmpty && selectedFiles.length > 0 && !resellData) {
      const form = document.getElementById('new-listing-form');
      if (form && !form.querySelector('[name="title"]').value) {
        runAIScan(selectedFiles[0]);
      }
    }
  }

  async function runAIScan(file) {
    const overlay = document.getElementById('nl-ai-scan-overlay');
    const scanText = document.getElementById('nl-ai-scan-text');
    const apiKey = localStorage.getItem("rehome_gemini_key");

    if (overlay) {
      overlay.style.display = 'flex';
      // Small delay to allow display:flex to apply before fading in
      setTimeout(() => { overlay.style.opacity = '1'; }, 10);
    }

    const steps = ["Analyzing item geometry...", "Cross-referencing global auctions...", "Calculating material quality...", "Computing Earth Credit..."];
    let stepIdx = 0;
    const interval = setInterval(() => {
      stepIdx = (stepIdx + 1) % steps.length;
      if (scanText) scanText.textContent = steps[stepIdx];
    }, 800);

    try {
      const reader = new FileReader();
      const base64Data = await new Promise((resolve) => {
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
      });

      let generatedData;
      if (apiKey) {
        generatedData = await callGeminiAPI(apiKey, base64Data);
      } else {
        await new Promise(r => setTimeout(r, 1000));
        generatedData = generateMockAIData();
      }

      // Populate form
      const form = document.getElementById('new-listing-form');
      if (form) {
        const setSelectValue = (name, val) => {
          const el = form.querySelector(`[name="${name}"]`);
          if (!el || !val) return;
          const searchVal = val.toLowerCase();
          const options = Array.from(el.options).filter(o => o.value);
          let match = options.find(o => o.text.toLowerCase() === searchVal || o.value.toLowerCase() === searchVal);
          if (!match) {
            match = options.find(o => searchVal.includes(o.text.toLowerCase()) || searchVal.includes(o.value.toLowerCase()));
          }
          if (match) el.value = match.value;
        };

        if (generatedData.title) form.querySelector('[name="title"]').value = generatedData.title;
        if (generatedData.description) form.querySelector('[name="description"]').value = generatedData.description;
        setSelectValue('category', generatedData.category);
        setSelectValue('condition', generatedData.condition);
        if (generatedData.eco_offset) form.querySelector('[name="carbon_offset"]').value = generatedData.eco_offset;
        
        if (generatedData.price) {
          form.querySelector('[name="price"]').value = generatedData.price;
          aiBasePrice = generatedData.price;
          
          const hint = document.getElementById('nl-ai-hint');
          if (hint) {
            const minP = Math.floor(aiBasePrice * 0.75);
            const maxP = Math.floor(aiBasePrice * 1.25);
            hint.innerHTML = `AI suggested price: <strong>$${aiBasePrice.toLocaleString()}</strong>. You can adjust between <strong>$${minP.toLocaleString()}</strong> and <strong>$${maxP.toLocaleString()}</strong>.`;
            hint.style.display = 'block';
          }
        }
      }
      showToast("AI Auto-fill complete!");
    } catch (err) {
      console.error("AI Scan Error:", err);
      showToast("AI Error: " + (err.message || "Auto-fill failed."));
    } finally {
      clearInterval(interval);
      if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => { overlay.style.display = 'none'; }, 300);
      }
    }
  }

  function renderPreviews() {
    if (!previewContainer) return;
    previewContainer.innerHTML = '';
    
    const children = Array.from(uploadArea.children);
    if (selectedFiles.length === 0) {
      children.forEach(child => {
        if (child.id !== 'nl-preview-row') child.style.display = '';
      });
      return;
    }
    
    // Hide default text but keep upload area visible for the preview row
    children.forEach(child => {
      if (child.id !== 'nl-preview-row') child.style.display = 'none';
    });

    selectedFiles.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const div = document.createElement('div');
        div.style.position = 'relative';
        div.style.display = 'inline-block';
        div.innerHTML = `
          <img src="${e.target.result}" class="nl-preview-thumb">
          <button type="button" class="nl-remove-img" style="position: absolute; top: -8px; right: -8px; width: 24px; height: 24px; border-radius: 50%; background: #1c1917; color: white; border: none; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; z-index: 2; padding: 0;">&times;</button>
        `;
        previewContainer.appendChild(div);

        div.querySelector('.nl-remove-img').addEventListener('click', (ev) => {
          ev.stopPropagation();
          selectedFiles.splice(index, 1);
          renderPreviews();
          if (selectedFiles.length === 0) fileInput.value = '';
        });
      };
      reader.readAsDataURL(file);
    });

    // Add a button to add more images
    if (selectedFiles.length < 8) {
      const addMoreDiv = document.createElement('div');
      addMoreDiv.className = 'nl-preview-thumb';
      addMoreDiv.style.display = 'flex';
      addMoreDiv.style.alignItems = 'center';
      addMoreDiv.style.justifyContent = 'center';
      addMoreDiv.style.background = '#eceae5';
      addMoreDiv.style.cursor = 'pointer';
      addMoreDiv.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#78716c" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
      addMoreDiv.addEventListener('click', (ev) => {
        ev.stopPropagation();
        fileInput.click();
      });
      previewContainer.appendChild(addMoreDiv);
    }
  }

  // ─── Upload image to Supabase Storage ───
  async function uploadImage(file) {
    if (!file) return null;
    const ext = file.name.split('.').pop();
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from('product-images')
      .upload(path, file, { cacheControl: '3600', upsert: false });
    if (error) {
      console.error('Upload error:', error);
      return null;
    }
    const { data: { publicUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(path);
    return publicUrl;
  }

  // ─── Save listing ───
  async function saveListing(status) {
    const form = document.getElementById('new-listing-form');
    if (!form) return;

    const fd = new FormData(form);
    const title = fd.get('title')?.trim();
    const price = parseFloat(fd.get('price'));
    const stockVal = parseInt(fd.get('stock')) || 1;

    if (!title || title.length < 2) {
      showToast("Please enter a valid title.");
      return;
    }
    if (isNaN(price) || price < 0) {
      showToast("Please enter a valid price.");
      return;
    }
    
    // Price Boundary Validation
    if (aiBasePrice !== null && price !== aiBasePrice) {
      const minP = Math.floor(aiBasePrice * 0.75);
      const maxP = Math.floor(aiBasePrice * 1.25);
      
      if (price < minP || price > maxP) {
        const modal = document.getElementById('nl-price-modal');
        const modalText = document.getElementById('nl-price-modal-text');
        const content = document.getElementById('nl-price-modal-content');
        const btnCancel = document.getElementById('btn-modal-cancel');
        const btnConfirm = document.getElementById('btn-modal-confirm');
        
        if (modal && modalText && btnCancel && btnConfirm) {
          modalText.textContent = `You are setting a price that is more than 25% different from the AI's fair market value ($${aiBasePrice.toLocaleString()}). Are you absolutely sure you want to list it at $${price.toLocaleString()}?`;
          
          const confirmed = await new Promise((resolve) => {
            modal.style.display = 'flex';
            setTimeout(() => { modal.style.opacity = '1'; content.style.transform = 'translateY(0)'; }, 10);
            
            const close = (res) => {
              modal.style.opacity = '0';
              content.style.transform = 'translateY(20px)';
              setTimeout(() => { modal.style.display = 'none'; }, 200);
              
              btnCancel.removeEventListener('click', onCancel);
              btnConfirm.removeEventListener('click', onConfirm);
              resolve(res);
            };
            
            const onCancel = () => close(false);
            const onConfirm = () => close(true);
            
            btnCancel.addEventListener('click', onCancel);
            btnConfirm.addEventListener('click', onConfirm);
          });
          
          if (!confirmed) return;
        }
      }
    }

    if (resellData && resellData.quantity && stockVal > resellData.quantity) {
      showToast(`You can only resell up to ${resellData.quantity} items.`);
      return;
    }

    // Show loading
    const btns = form.querySelectorAll('button');
    btns.forEach(b => { b.disabled = true; b.style.opacity = '0.6'; });

    let imageUrls = [];
    if (selectedFiles.length > 0) {
      const uploadPromises = selectedFiles.map(file => uploadImage(file));
      const results = await Promise.all(uploadPromises);
      imageUrls = results.filter(url => url !== null);
    } else if (resellData && resellData.image_url) {
      imageUrls = [resellData.image_url];
    }

    const record = {
      title,
      description: fd.get('description')?.trim() || '',
      category: fd.get('category') || 'Furniture',
      condition: fd.get('condition') || 'Excellent',
      price,
      stock: stockVal,
      carbon_offset: parseFloat(fd.get('carbon_offset')) || 0,
      seller_id: user.id,
      status,
      currency: 'USD',
    };
    if (imageUrls.length > 0) {
      record.image_url = imageUrls[0];
      record.image_urls = imageUrls;
    }

    const { error } = await supabase
      .from('products')
      .insert(record);

    btns.forEach(b => { b.disabled = false; b.style.opacity = '1'; });

    if (error) {
      showToast("Failed to create listing: " + error.message);
      console.error('Insert error:', error);
    } else {
      if (resellData && resellData.order_item_id && status === 'active') {
         await supabase.from('order_items').update({ delivery_status: 'resold' }).eq('id', resellData.order_item_id);
      }
      showToast(status === 'draft' ? "Draft saved!" : "Listing published!");
      navigate('sell');
    }
  }

  // ─── Bind buttons ───
  document.getElementById('btn-save-draft')?.addEventListener('click', (e) => {
    e.preventDefault();
    saveListing('draft');
  });

  document.getElementById('btn-publish-listing')?.addEventListener('click', (e) => {
    e.preventDefault();
    saveListing('active');
  });
}
