export interface Category {
  id: number;
  name: string;
  parent: number;
}

export interface CategoryNode extends Category {
  children: CategoryNode[];
}

export interface SavedProduct {
    sku: string;
    productType: 'watch' | 'glasses';
    price: string;
    imageUrl: string;
    productName: string;
    additionalFeatures: string;
    categoryIds: number[];
}
