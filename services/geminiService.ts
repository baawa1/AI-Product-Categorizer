import { GoogleGenAI, Type } from "@google/genai";
import { CATEGORIES } from '../constants';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
const model = 'gemini-2.5-flash';

interface CategorizationResult {
  categoryIds: number[];
  productName: string;
  additionalFeatures: string;
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
    price?: string
): Promise<CategorizationResult> => {
  try {
    const imagePart = await fileToGenerativePart(imageFile);
    
    const priceInfo = price ? `and its price is ${price} Naira` : '';

    const prompt = `You are an expert e-commerce product categorizer for a store in Nigeria.
The product shown in the image is a "${productType}" ${priceInfo}. Your task is to analyze the product and return a structured JSON response.

Instructions:
1.  Generate a descriptive product name. Include brand (if visible), model, key features, and gender. Example: "Cartier TY786C Men's Leather Chronograph Watch".
2.  Identify any other distinct features or characteristics visible in the image that are not covered by the categories list. List these as a comma-separated string. Example: "luminous hands, date display, sapphire crystal".
3.  Analyze the product's specific features (style, material, gender, type, etc.) from the image to select relevant categories.
4.  If a price is provided, use it to select the correct price range category (e.g., 'Watches Under 20000 Naira').
5.  Select ALL applicable sub-categories from the list that accurately describe the product.
6.  You MUST also select the top-level parent category for the given product type ('Watches Nigeria' (ID 4287) for a watch, or 'Glasses Nigeria' (ID 4296) for glasses).

Here is the complete list of available categories with their ID, Name, and Parent ID:
${CATEGORIES.map(c => `- ID: ${c.id}, Name: ${c.name}, Parent: ${c.parent}`).join('\n')}

Analyze the image and return a JSON object containing:
- "productName": The generated product name.
- "additionalFeatures": A comma-separated string of extra features.
- "categoryIds": An array of the IDs for all categories that best describe the product.

Only return IDs from the list provided.
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: { parts: [imagePart, { text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            productName: {
              type: Type.STRING,
              description: 'A descriptive name for the product.'
            },
            additionalFeatures: {
              type: Type.STRING,
              description: 'A comma-separated list of additional features or tags.'
            },
            categoryIds: {
              type: Type.ARRAY,
              items: {
                type: Type.INTEGER,
                description: 'The ID of a relevant product category.'
              }
            }
          },
          required: ['productName', 'additionalFeatures', 'categoryIds']
        },
        temperature: 0.1,
      }
    });

    const jsonString = response.text;
    const result = JSON.parse(jsonString);

    if (result && typeof result.productName === 'string' && typeof result.additionalFeatures === 'string' && Array.isArray(result.categoryIds)) {
      const validIds = result.categoryIds.filter((id: unknown) => 
        typeof id === 'number' && CATEGORIES.some(c => c.id === id)
      );
      return { 
          categoryIds: validIds,
          productName: result.productName,
          additionalFeatures: result.additionalFeatures,
      };
    }
    
    console.warn("Gemini response was not in the expected format:", jsonString);
    throw new Error("Failed to parse the categorization response from the model.");

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error && error.message.includes('API key not valid')) {
       throw new Error("Invalid API Key. Please check your environment configuration.");
    }
    throw new Error("Failed to categorize product. The model may be unable to process this request.");
  }
};
