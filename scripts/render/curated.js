import { navigate } from "../router.js";
import { showToast } from "../ui.js";
import { callGeminiAPI, generateMockAIData } from "../ai.js";

export function renderCurated() {
  const uploadInput = document.getElementById("ai-photo-upload");
  const uploadBox = document.getElementById("ai-upload-box");
  const previewImg = document.getElementById("ai-image-preview");
  const btnValuation = document.getElementById("btn-get-valuation");
  const btnText = document.getElementById("btn-valuation-text");
  const btnIcon = document.getElementById("btn-valuation-icon");
  const resultPanel = document.getElementById("ai-result-panel");
  const scanOverlay = document.getElementById("ai-scan-overlay");
  const scanText = document.getElementById("ai-scan-text");
  const geminiBadge = document.getElementById("gemini-badge");
  
  let currentFileBase64 = null;
  let isScanComplete = false;
  let generatedData = null;

  const apiKey = localStorage.getItem("rehome_gemini_key");
  if (apiKey) {
    if (geminiBadge) geminiBadge.style.display = "flex";
  }

  if (uploadInput) {
    uploadInput.addEventListener("change", (e) => {
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (ev) => {
          currentFileBase64 = ev.target.result;
          previewImg.src = currentFileBase64;
          previewImg.style.display = "block";
          
          btnValuation.style.opacity = "1";
          btnValuation.style.pointerEvents = "auto";
          btnText.textContent = "Get AI Valuation";
          isScanComplete = false;
        };
        reader.readAsDataURL(file);
      }
    });
  }

  if (uploadBox) {
    uploadBox.addEventListener("dragover", e => { e.preventDefault(); uploadBox.style.borderColor = "#3d5a30"; });
    uploadBox.addEventListener("dragleave", e => { uploadBox.style.borderColor = "#c8c6c0"; });
    uploadBox.addEventListener("drop", e => {
      e.preventDefault();
      uploadBox.style.borderColor = "#c8c6c0";
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        uploadInput.files = e.dataTransfer.files;
        uploadInput.dispatchEvent(new Event('change'));
      }
    });
  }

  if (btnValuation) {
    btnValuation.addEventListener("click", async () => {
      if (isScanComplete) {
        // Navigate to sell
        localStorage.setItem('rehome_resell_data', JSON.stringify(generatedData));
        navigate("new-listing");
        return;
      }

      // Start scan
      btnValuation.disabled = true;
      btnValuation.style.opacity = "0.5";
      btnText.textContent = "Analyzing...";
      
      scanOverlay.style.display = "flex";
      scanOverlay.style.opacity = "1";
      
      const steps = ["Analyzing geometric structures...", "Cross-referencing global auctions...", "Calculating material quality...", "Computing Earth Credit..."];
      let stepIdx = 0;
      const interval = setInterval(() => {
        stepIdx = (stepIdx + 1) % steps.length;
        scanText.textContent = steps[stepIdx];
      }, 800);

      try {
        if (apiKey) {
          const category = document.querySelectorAll(".ai-input")[0]?.value || 'Furniture';
          const condition = document.querySelectorAll(".ai-input")[1]?.value || 'Good';
          generatedData = await callGeminiAPI(apiKey, currentFileBase64, category, condition);
        } else {
          await new Promise(r => setTimeout(r, 1000));
          generatedData = generateMockAIData();
        }
        generatedData.image_url = currentFileBase64;

        clearInterval(interval);
        scanOverlay.style.display = "none";
        
        // Update DOM
        document.getElementById("ai-price-value").textContent = window.formatCurrency(generatedData.price);
        document.querySelector("#ai-price-value + .price-currency").style.display = 'none';
        if (document.getElementById("ai-price-accuracy-title")) {
          document.getElementById("ai-price-accuracy-title").textContent = generatedData.estimated_fair_price ? "Fair Price: " + window.formatCurrency(generatedData.estimated_fair_price) : "Excellent Fair Price";
          document.getElementById("ai-price-accuracy-desc").textContent = generatedData.price_accuracy_note || "Within 3% of market average.";
        }
        if (document.getElementById("ai-market-sentiment")) {
          document.getElementById("ai-market-sentiment").textContent = generatedData.market_sentiment || "Strong Demand";
        }
        if (document.getElementById("ai-insight-1-title") && generatedData.market_insights?.length > 0) {
          const parts = generatedData.market_insights[0].split(":");
          document.getElementById("ai-insight-1-title").textContent = parts[0] || "Appreciating Value";
          document.getElementById("ai-insight-1-desc").textContent = parts[1] || "+12% vs last year";
        }
        if (document.getElementById("ai-insight-2-title") && generatedData.market_insights?.length > 1) {
          const parts = generatedData.market_insights[1].split(":");
          document.getElementById("ai-insight-2-title").textContent = parts[0] || "Fast Turnover";
          document.getElementById("ai-insight-2-desc").textContent = parts[1] || "Avg. 4 days to sell";
        }
        if (document.getElementById("ai-eco-score")) {
          document.getElementById("ai-eco-score").textContent = "Eco-Check Score: " + (generatedData.eco_score || 98) + "/100";
          document.getElementById("ai-eco-offset").textContent = "Reselling this item offsets " + (generatedData.eco_offset || 45) + "kg of CO2.";
        }
        
        resultPanel.style.filter = "blur(0)";
        resultPanel.style.opacity = "1";
        resultPanel.style.pointerEvents = "auto";

        btnValuation.disabled = false;
        btnValuation.style.opacity = "1";
        btnText.textContent = "Sell this Item";
        btnIcon.innerHTML = `<path d="M12 5v14M5 12h14"></path>`; // Plus icon
        isScanComplete = true;

        showToast("Valuation complete!");

      } catch (err) {
        clearInterval(interval);
        scanOverlay.style.display = "none";
        btnValuation.disabled = false;
        btnValuation.style.opacity = "1";
        btnText.textContent = "Get AI Valuation";
        showToast("AI Error: " + (err.message || "Valuation failed."));
      }
    });
  }
}