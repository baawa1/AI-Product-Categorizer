import type { SavedProduct, Category, Brand } from '../types';

export const generateCsvContent = (products: SavedProduct[], allCategories: Category[], allBrands: Brand[]): string => {
    if (products.length === 0) {
        return '';
    }

    const categoryMap = new Map<number, string>(allCategories.map(cat => [cat.id, cat.name]));
    const brandMap = new Map<number, string>(allBrands.map(brand => [brand.id, brand.name]));

    const headers = [
        'SKU',
        'Product Name',
        'Product Type',
        'Brand ID',
        'Brand Name',
        'Model',
        'Price',
        'Image URL',
        'Suggested Tags',
        'Category IDs',
        'Category Names',
        'Variant SKU',
        'Color',
        'Size',
        'Other Attribute'
    ];
    
    const rows = products.map(product => {
        const categoryNames = product.categoryIds
            .map(id => categoryMap.get(id) || 'Unknown Category')
            .join('; '); // Using semicolon to avoid CSV issues with names containing commas
            
        const categoryIds = product.categoryIds.join('; ');

        const brandName = product.brandId ? brandMap.get(product.brandId) || 'Unknown Brand' : '';

        const escapeCsvField = (field: string | number | null | undefined) => {
            if (field === null || field === undefined) return '';
            const str = String(field);
            // If the field contains a comma, double quote, or newline, wrap it in double quotes.
            // Also, any double quotes within the field must be escaped by another double quote.
            if (/[",\n]/.test(str)) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };
        
        return [
            escapeCsvField(product.sku),
            escapeCsvField(product.productName),
            escapeCsvField(product.productType),
            escapeCsvField(product.brandId),
            escapeCsvField(brandName),
            escapeCsvField(product.model),
            escapeCsvField(product.price),
            escapeCsvField(product.imageUrl),
            escapeCsvField(product.suggestedTags),
            escapeCsvField(categoryIds),
            escapeCsvField(categoryNames),
            escapeCsvField(product.variantSku),
            escapeCsvField(product.variantColor),
            escapeCsvField(product.variantSize),
            escapeCsvField(product.variantOther)
        ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
};