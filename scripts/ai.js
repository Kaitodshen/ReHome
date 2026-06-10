export async function callGeminiAPI(key, base64Image, categoryHint = 'Furniture', conditionHint = 'Good') {
  let targetModel = "gemini-1.5-flash";
  try {
    const modelsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
    if (modelsRes.ok) {
      const modelsData = await modelsRes.json();
      const availableModels = modelsData.models.map(m => m.name);
      // console.log("Available Gemini models:", availableModels);
      if (availableModels.includes("models/gemini-1.5-flash")) targetModel = "gemini-1.5-flash";
      else if (availableModels.includes("models/gemini-1.5-pro")) targetModel = "gemini-1.5-pro";
      else if (availableModels.includes("models/gemini-1.0-pro-vision-latest")) targetModel = "gemini-1.0-pro-vision-latest";
      else if (availableModels.length > 0) targetModel = availableModels[0].replace("models/", "");
    }
  } catch (e) {
    console.warn("Could not fetch models list, defaulting to gemini-1.5-flash");
  }

  // console.log("Using model:", targetModel);

  let mimeType = "image/jpeg";
  if (base64Image.startsWith("data:")) {
    mimeType = base64Image.split(";")[0].split(":")[1];
  }
  const base64Data = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

  const prompt = `You are an expert luxury furniture appraiser. Analyze this image. 
  Category context: ${categoryHint}. Condition context: ${conditionHint}. 
  Return ONLY a raw JSON object with no markdown formatting. The JSON must have these exact keys:
  {
    "title": "A short, elegant title for the item",
    "price": 1250,
    "description": "A sophisticated 2-sentence description of the item and its design legacy.",
    "maker": "Designer or Brand",
    "category": "${categoryHint}",
    "condition": "${conditionHint}",
    "estimated_fair_price": 1200,
    "price_accuracy_note": "A short note like 'Within 3% of market average'",
    "market_sentiment": "Short sentiment phrase like 'Strong Demand' or 'Steady'",
    "market_insights": ["Insight 1 Title: Insight 1 Description", "Insight 2 Title: Insight 2 Description"],
    "eco_score": 95,
    "eco_offset": 45
  }`;

  const requestBody = {
    contents: [{
      parts: [
        { text: prompt },
        { inlineData: { mimeType: mimeType, data: base64Data } }
      ]
    }],
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
    ]
  };

  if (targetModel.includes("1.5")) {
    requestBody.generationConfig = { responseMimeType: "application/json" };
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
     const err = await response.json();
     throw new Error("Gemini API Error: " + (err.error?.message || "Unknown error"));
  }

  const data = await response.json();
  
  if (data.promptFeedback && data.promptFeedback.blockReason) {
    throw new Error("Image blocked by safety filter: " + data.promptFeedback.blockReason);
  }

  let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!rawText) {
    if (data.candidates?.[0]?.finishReason) {
      throw new Error("Gemini blocked response: " + data.candidates[0].finishReason);
    }
    throw new Error("No response text from Gemini");
  }

  // Clean markdown and trailing commas
  rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
  rawText = rawText.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']'); // Remove trailing commas
  
  try {
    return JSON.parse(rawText);
  } catch (e) {
    // console.error("Gemini raw output:", rawText);
    throw new Error("Failed to parse Gemini response as JSON");
  }
}

export function generateMockAIData() {
  return {
    title: "Mid-Century Modern Lounge Chair",
    price: 850,
    description: "An authentic mid-century piece featuring warm walnut tones and pristine original upholstery. Designed to bring character and sustainable style to any modern living space.",
    maker: "Herman Miller Era",
    category: "Seating",
    condition: "Excellent",
    estimated_fair_price: 820,
    price_accuracy_note: "Within 4% of market average",
    market_sentiment: "High Demand",
    market_insights: [
      "Appreciating Value: +8% vs last year",
      "Fast Turnover: Avg. 6 days to sell"
    ],
    eco_score: 92,
    eco_offset: 65
  };
}
