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
    titleTag: string;
    metaDescription: string;
    suggestedTags: string;
    shortDescription: string;
    longDescription: string;
    categoryIds: number[];
    attributeIds: number[];
    brandId: number | null;
    model: string;
    isReviewed?: boolean;
    originalId?: string;
    originalName?: string;
    // Variant-specific fields
    variantSku?: string;
    variantColor?: string;
    variantSize?: string;
    variantOther?: string;
}

// Types for Bulk Create Feature
export interface CsvProduct {
    sku: string;
    productType: 'watch' | 'glasses' | '';
    brandName: string;
    model: string;
    price: string;
    userProvidedDetails: string;
    imageUrl: string;
}

// Types for Bulk Enrich Feature
export interface EnrichmentCsvProduct {
    id: string;
    sku: string;
    name: string;
    productType: 'watch' | 'glasses' | '';
    brandName: string;
    price: string;
    imageUrl: string;
}

export interface BulkProduct {
    id: number; // For stable keys in React
    source: CsvProduct | EnrichmentCsvProduct;
    status: 'pending' | 'processing' | 'completed' | 'error';
    isReviewed: boolean;
    error?: string;
    imageFile?: File;
    result?: SavedProduct;
}
