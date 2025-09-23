import type { SavedProduct, Category } from '../types';

export const generateCsvContent = (products: SavedProduct[], allCategories: Category[]): string => {
    if (products.length === 0) {
        return '';
    }

    const categoryMap = new Map<number, string>(allCategories.map(cat => [cat.id, cat.name]));

    const headers = [
        'SKU',
        'Product Name',
        'Product Type',
        'Price',
        'Image URL',
        'Additional Features',
        'Category IDs',
        'Category Names'
    ];
    
    const rows = products.map(product => {
        const categoryNames = product.categoryIds
            .map(id => categoryMap.get(id) || 'Unknown Category')
            .join(', ');
            
        const categoryIds = product.categoryIds.join(', ');

        const escapeCsvField = (field: string | number) => {
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
            escapeCsvField(product.price),
            escapeCsvField(product.imageUrl),
            escapeCsvField(product.additionalFeatures),
            escapeCsvField(categoryIds),
            escapeCsvField(categoryNames)
        ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
};
