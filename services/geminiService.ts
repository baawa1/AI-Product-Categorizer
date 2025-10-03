import { GoogleGenAI, Type } from "@google/genai";
import { CATEGORIES, BRANDS, ATTRIBUTES } from '../constants';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
const model = 'gemini-2.5-flash';

interface CategorizationResult {
  categoryIds: number[];
  attributeIds: number[];
  productName: string;
  titleTag: string;
  metaDescription: string;
  suggestedTags: string;
  shortDescription: string;
  longDescription: string;
  brandId: number | null;
}

const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
};

export const categorizeProduct = async (
    imageFile: File,
    productType: 'watch' | 'glasses',
    brandId: number | null,
    modelStr: string | undefined,
    price?: string,
    userProvidedDetails?: string,
    existingProductName?: string
): Promise<CategorizationResult> => {
  try {
    const imagePart = await fileToGenerativePart(imageFile);
    
    const brand = brandId ? BRANDS.find(b => b.id === brandId) : null;
    const providedBrandName = brand ? brand.name : 'Unknown Brand';
    const isEnrichmentMode = !!existingProductName;

    let contextInfo = `The product shown in the image is a "${productType}".`;
    if (!isEnrichmentMode) {
      contextInfo += ` The brand is "${providedBrandName}".`;
    }
    if (modelStr) {
        contextInfo += ` The model is "${modelStr}".`;
    }
    if (price) {
        contextInfo += ` The price is ${price} Naira.`;
    }
    contextInfo += ".";

    const relevantAttributes = ATTRIBUTES.filter(attr => attr.type === productType);
    const locationCategories = [
        { id: 4566, name: 'Watches Abeokuta' },
        { id: 4565, name: 'Watches Abuja' },
        { id: 4564, name: 'Watches Lagos' },
        { id: 4521, name: 'Watches Port Harcourt' },
    ];

    const productNameTask = isEnrichmentMode
      ? `1.  **Refine Product Name**: An existing product name is provided: "${existingProductName}". Use this as the foundation. Your task is to refine it for maximum SEO impact and clarity. Enhance it by incorporating the most valuable keywords you identify from the image and product details. Do not radically change the core identity, but improve it. Base the name on the CORRECT brand you identify.`
      : `1.  **Generate Product Name**: Create a clear, keyword-rich product name that incorporates the most impactful and searchable features you identify.
    -   **Foundation**: [Brand] [Model] [Key Feature 1] [Key Feature 2] [Gender] [Product Type].
    -   Draw keywords from the most relevant attributes and categories you select. For example, if the watch is a chronograph with a leather band, include those terms. If the glasses have acetate frames and blue light filtering, include those.
    -   **Examples**: "Casio G-Shock Men's Chronograph Leather Watch", "Ray-Ban Women's Acetate Titanium Blue Light Filter Glasses".`;

    const brandVerificationTask = isEnrichmentMode
        ? `2.  **Verify Brand**: The user suggests the brand is "${providedBrandName}". Your task is to verify this against the image. If it's correct, use it. If it is INCORRECT, identify the true brand from the image and select its corresponding ID from the 'Available Brands' list below. All subsequent content you generate MUST use the CORRECT brand.`
        : '';
    
    const taskNumberingOffset = isEnrichmentMode ? 1 : 0;

    const prompt = `${contextInfo}
You are an expert e-commerce copywriter with the wisdom of David Ogilvy, writing for a modern Nigerian online store. Your tone is factual, benefit-driven, and aspirational. You sell with information, not fluff. Your goal is to create content that is highly optimized for SEO and conversion.

Here are additional details provided by the user:
"${userProvidedDetails || 'No additional details provided. Rely solely on the image and product info.'}"

**Your Tasks:**

${productNameTask}
${brandVerificationTask}

${taskNumberingOffset + 2}.  **Generate SEO Title Tag**: Create a concise, keyword-rich title tag (50-60 characters). Start with the primary keyword (e.g., Brand + Model + Type). The title must be compelling for search engine users.

${taskNumberingOffset + 3}.  **Generate Meta Description**: Write a compelling meta description (150-160 characters). It must entice clicks and include the phrase "We deliver to all states in Nigeria, including Lagos, PH, Abuja, and Kaduna.".

${taskNumberingOffset + 4}.  **Generate Tags**: Identify distinct features, materials, or styles. List these as a comma-separated string. Example: "shock resistant, 200m water resistance, luminous hands, gold accents".

${taskNumberingOffset + 5}.  **Generate Short Description**: Write a powerful, concise summary (1-2 sentences). Hook the reader with the most compelling benefit. Example: "A testament to resilience and bold design, this G-Shock is crafted for the modern man who demands both extreme durability and undeniable style."

${taskNumberingOffset + 6}.  **Generate Long Description (Ogilvy Style for Nigeria)**:
    -   Write a detailed, SEO-optimized description.
    -   **Tone & Style**: Factual, confident, and benefit-oriented. Use sensory details (e.g., "the smooth, comfortable resin band," "the crisp, luminous display"). Subtly weave in local relevance (e.g., "built to withstand the hustle of a Lagos lifestyle," "a statement of sophistication in Abuja").
    -   **Structure**: Start with a strong opening paragraph. Use an 'h3' tag for "Key Features". List features in a 'ul' tag with 'strong' tags for the feature name. End with a short, aspirational "call to value" paragraph.
    -   **ABSOLUTE CRITICAL FORMATTING RULE**: The most important instruction is to generate the HTML for the long description with proper indentation and newlines for human readability. You have a large token budget, so do not minify the HTML to save space. Prioritize readability above all else. Your entire response is considered a failure if this rule is not followed. DO NOT return a minified, single-line HTML string.
        *Example of the EXACT required format:*
        \`\`\`html
        <h2>Casio G-Shock 4576 Men's White Resin Watch</h2>
        <p>
          A testament to resilience and bold design, this Casio G-Shock is crafted for the modern Nigerian man who demands both extreme durability and undeniable style. Built to withstand the toughest challenges, from the daily commute in Lagos to outdoor adventures, its legendary shock resistance ensures performance you can trust.
        </p>
        <h3>Key Features:</h3>
        <ul>
          <li><strong>Legendary Durability:</strong> The iconic shock-resistant construction protects against impacts and vibration.</li>
          <li><strong>Superior Water Resistance:</strong> With a 200-meter (20 BAR) water resistance rating, it's perfect for swimming and diving.</li>
          <li><strong>Crisp Display:</strong> The high-contrast analog-digital display features a luminous LED backlight for perfect readability in any light.</li>
        </ul>
        <p>
          Elevate your wrist game. This G-Shock is not just a timepiece; it's a statement of strength and sophistication.
        </p>
        \`\`\`

${taskNumberingOffset + 7}.  **Categorize & Attribute**:
    -   Select ALL relevant categories from the list provided. You MUST include the main parent category ('Watches Nigeria' or 'Glasses Nigeria').
    -   If it's a watch, you MUST RANDOMLY select exactly TWO location categories: ${locationCategories.map(c => `${c.name} (ID: ${c.id})`).join(', ')}.
    -   Select ALL relevant attributes from the provided list.

**Data Lists for Categorization:**
Available Categories:
${CATEGORIES.map(c => `- ID: ${c.id}, Name: ${c.name}`).join('\n')}

Available Attributes for a ${productType}:
${relevantAttributes.map(a => `- ID: ${a.id}, Name: ${a.name}, Group: ${a.group}`).join('\n')}

${isEnrichmentMode ? `Available Brands:\n${BRANDS.map(b => `- ID: ${b.id}, Name: ${b.name}`).join('\n')}`: ''}

Now, analyze the product and return the complete JSON object.
    `;

    const schemaProperties: any = {
        productName: { type: Type.STRING, description: 'A descriptive name for the product.' },
        titleTag: { type: Type.STRING, description: 'An SEO-optimized title tag for the product (50-60 characters).' },
        metaDescription: { type: Type.STRING, description: 'An SEO-optimized meta description for the product (150-160 characters), including the delivery information.' },
        suggestedTags: { type: Type.STRING, description: 'A comma-separated list of suggested tags.' },
        shortDescription: { type: Type.STRING, description: 'A concise, compelling short description (1-2 sentences).' },
        longDescription: { type: Type.STRING, description: 'A detailed, SEO-optimized long description formatted with readable, indented HTML for WooCommerce.' },
        categoryIds: { type: Type.ARRAY, items: { type: Type.INTEGER, description: 'The ID of a relevant product category.' } },
        attributeIds: { type: Type.ARRAY, items: { type: Type.INTEGER, description: 'The ID of a relevant product attribute.' } }
    };
    
    const requiredFields = ['productName', 'titleTag', 'metaDescription', 'suggestedTags', 'shortDescription', 'longDescription', 'categoryIds', 'attributeIds'];

    if (isEnrichmentMode) {
        schemaProperties.brandId = {
            type: Type.INTEGER,
            description: 'The ID of the correct brand, verified from the image.'
        };
        requiredFields.push('brandId');
    }

    const response = await ai.models.generateContent({
      model: model,
      contents: { parts: [imagePart, { text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: schemaProperties,
          required: requiredFields
        },
        temperature: 0.1, // Reduced for stricter adherence to formatting rules
        maxOutputTokens: 8192, // Increased token limit for detailed, formatted HTML
        thinkingConfig: { thinkingBudget: 2048 },
      }
    });
    
    const jsonString = response.text.trim();
    const result = JSON.parse(jsonString);

    if ( !result || typeof result.productName !== 'string' || typeof result.titleTag !== 'string' || typeof result.metaDescription !== 'string' || typeof result.suggestedTags !== 'string' || typeof result.shortDescription !== 'string' || typeof result.longDescription !== 'string' || !Array.isArray(result.categoryIds) || !Array.isArray(result.attributeIds)) {
      console.warn("Gemini response was missing required fields:", jsonString);
      throw new Error("Failed to parse the categorization response from the model.");
    }
    
    const validCategoryIds = result.categoryIds.filter((id: unknown) => 
        typeof id === 'number' && CATEGORIES.some(c => c.id === id)
    );
    const validAttributeIds = result.attributeIds.filter((id: unknown) =>
        typeof id === 'number' && ATTRIBUTES.some(a => a.id === id)
    );

    let finalBrandId: number | null;

    if (isEnrichmentMode) {
        if (typeof result.brandId !== 'number' && result.brandId !== null) {
            console.warn("Gemini response was missing brandId in enrichment mode:", jsonString);
            throw new Error("Model failed to provide a verified brand ID.");
        }
        // Final check to ensure the returned brand ID is valid
        finalBrandId = BRANDS.some(b => b.id === result.brandId) ? result.brandId : null;
    } else {
        // In creation mode, just use the brand ID that was passed in
        finalBrandId = brandId;
    }

    return { 
        categoryIds: validCategoryIds,
        attributeIds: validAttributeIds,
        productName: result.productName,
        titleTag: result.titleTag,
        metaDescription: result.metaDescription,
        suggestedTags: result.suggestedTags,
        shortDescription: result.shortDescription,
        longDescription: result.longDescription,
        brandId: finalBrandId,
    };

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error && error.message.includes('API key not valid')) {
       throw new Error("Invalid API Key. Please check your environment configuration.");
    }
    throw new Error("Failed to categorize product. The model may be unable to process this request.");
  }
};