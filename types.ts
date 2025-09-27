export interface Category {
  id: number;
  name: string;
  parent: number;
}

export interface Brand {
  id: number;
  name: string;
}

export interface Attribute {
    id: number;
    name: string;
    group: string;
    type: 'watch' | 'glasses';
}

export interface CategoryNode extends Category {
  children: CategoryNode[];
}

export interface Variant {
    id: number;
    sku: string;
    color: string;
    size: string;
    other: string;
}

export interface SavedProduct {
    sku: string; // Main product SKU
    productType: 'watch' | 'glasses';
    price: string;
    imageSource: string;
    productName: string;
    suggestedTags: string;
    shortDescription: string;
    longDescription: string;
    categoryIds: number[];
    attributeIds: number[];
    brandId: number | null;
    model: string;
    // Variant-specific fields
    variantSku?: string;
    variantColor?: string;
    variantSize?: string;
    variantOther?: string;
}