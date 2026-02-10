
/**
 * Generates a SKU based on product type, brand, and model name.
 * Format: CAT-BR-MDL-XXXX
 * CAT = "WAT" for watches, "GLA" for glasses, or "PRD" otherwise.
 * BR = first 2 letters of brand name, uppercased, or "XX" if no brand.
 * MDL = first 3 letters of model name, uppercased, or "PRO" if no model.
 * XXXX = random 4-digit number from 1000–9999.
 */
export const generateSmartSku = (
    productType?: string,
    brandName?: string,
    modelName?: string
): string => {
    let cat = "PRD";
    const type = productType?.toLowerCase() || "";
    if (type.includes("watch")) cat = "WAT";
    else if (type.includes("glass")) cat = "GLA";

    const br = (brandName || "XX").substring(0, 2).toUpperCase().padEnd(2, 'X');
    const mdl = (modelName || "PRO").substring(0, 3).toUpperCase().padEnd(3, 'X');
    const xxxx = Math.floor(Math.random() * 9000 + 1000);

    // Basic cleaning to remove spaces/special chars from the parts
    const clean = (str: string) => str.replace(/[^A-Z0-9]/g, '');

    return `${clean(cat)}-${clean(br)}-${clean(mdl)}-${xxxx}`;
};
