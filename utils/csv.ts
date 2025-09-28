
import type { SavedProduct, Category, Brand, Attribute, CsvProduct } from '../types';

export const generateCsvContent = (products: SavedProduct[], allCategories: Category[], allBrands: Brand[], allAttributes: Attribute[]): string => {
    if (products.length === 0) return '';

    const categoryMap = new Map<number, string>(allCategories.map(cat => [cat.id, cat.name]));
    const brandMap = new Map<number, string>(allBrands.map(brand => [brand.id, brand.name]));
    const attributeMap = new Map<number, string>(allAttributes.map(attr => [attr.id, attr.name]));

    const headers = ['SKU', 'Product Name', 'Short Description', 'Long Description', 'Product Type', 'Brand ID', 'Brand Name', 'Model', 'Price', 'Image Source', 'Suggested Tags', 'Category IDs', 'Category Names', 'Attribute IDs', 'Attribute Names', 'Variant SKU', 'Color', 'Size', 'Other Attribute', 'Reviewed'];
    
    const rows = products.map(product => {
        const categoryNames = product.categoryIds.map(id => categoryMap.get(id) || '').join('; ');
        const attributeNames = product.attributeIds.map(id => attributeMap.get(id) || '').join('; ');
        const brandName = product.brandId ? brandMap.get(product.brandId) || '' : '';
        const escapeCsvField = (field: any) => {
            if (field === null || field === undefined) return '';
            const str = String(field);
            if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
            return str;
        };
        
        return [
            escapeCsvField(product.sku), escapeCsvField(product.productName), escapeCsvField(product.shortDescription),
            escapeCsvField(product.longDescription), escapeCsvField(product.productType), escapeCsvField(product.brandId),
            escapeCsvField(brandName), escapeCsvField(product.model), escapeCsvField(product.price),
            escapeCsvField(product.imageSource), escapeCsvField(product.suggestedTags), escapeCsvField(product.categoryIds.join('; ')),
            escapeCsvField(categoryNames), escapeCsvField(product.attributeIds.join('; ')), escapeCsvField(attributeNames),
            escapeCsvField(product.variantSku), escapeCsvField(product.variantColor), escapeCsvField(product.variantSize),
            escapeCsvField(product.variantOther), escapeCsvField(product.isReviewed ? 'TRUE' : 'FALSE')
        ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
};

const CSV_HEADERS = {
    SKU: 'sku',
    TYPE: 'type',
    BRAND: 'brand',
    MODEL: 'model',
    PRICE: 'price',
    DETAILS: 'details',
    IMAGE_URL: 'imageurl',
};

const detectSeparator = (line: string): string => {
    const commaCount = (line.match(/,/g) || []).length;
    const tabCount = (line.match(/\t/g) || []).length;
    // If tabs are present and more numerous than commas, assume tab-separated.
    if (tabCount > 0 && tabCount > commaCount) {
        return '\t';
    }
    return ','; // Default to comma
};


export const parseCsv = (content: string, brands: Brand[]): CsvProduct[] => {
    const rawLines = content.trim().split(/\r\n|\n/);
    if (rawLines.length < 2) throw new Error("CSV file must have a header row and at least one data row.");

    const separator = detectSeparator(rawLines[0]);
    const header = rawLines[0].split(separator).map(h => h.trim().toLowerCase());
    const numColumns = header.length;

    // Pre-process to handle multi-line fields by joining them. This "minifies" the details column as requested.
    const lines: string[] = [];
    let lineBuffer = '';
    // We process data rows, so we skip the header
    for (const line of rawLines.slice(1)) {
        // Add the current line to the buffer.
        // We add a space to separate the parts of a field that were broken by a newline.
        if (lineBuffer) {
            lineBuffer += ' ' + line.trim();
        } else {
            lineBuffer = line.trim();
        }

        // A heuristic: if we have enough separators, we assume it's a complete row.
        // The number of separators is one less than the number of columns.
        const separatorRegex = new RegExp(separator, 'g');
        const columnCount = (lineBuffer.match(separatorRegex) || []).length;
        if (columnCount >= numColumns - 1) {
            lines.push(lineBuffer);
            lineBuffer = '';
        }
    }
    if (lineBuffer.trim()) {
        lines.push(lineBuffer); // Push any remaining content in the buffer
    }
    
    const requiredHeaders = Object.values(CSV_HEADERS);
    const missingHeaders = requiredHeaders.filter(rh => !header.includes(rh));
    if (missingHeaders.length > 0) {
        throw new Error(`CSV is missing required headers: ${missingHeaders.join(', ')}`);
    }

    const brandMap = new Map<string, number>(brands.map(b => [b.name.toLowerCase(), b.id]));
    const headerCount = header.length;
    const detailsIndex = header.indexOf(CSV_HEADERS.DETAILS);

    return lines.map((line, index) => {
        let values = line.split(separator);

        // Robustness: If a line has more columns than headers, assume the extra separators
        // are within the 'details' column and merge them.
        if (values.length > headerCount && detailsIndex !== -1) {
            const numExtraCols = values.length - headerCount;
            const detailsEndSlice = detailsIndex + numExtraCols + 1;
            
            const detailsContent = values.slice(detailsIndex, detailsEndSlice).join(separator);
            
            const newValues = [
                ...values.slice(0, detailsIndex),
                detailsContent,
                ...values.slice(detailsEndSlice)
            ];
            values = newValues;
        }


        const row: any = {};
        header.forEach((h, i) => {
            if(values[i]) row[h] = values[i].trim();
        });

        const product: Partial<CsvProduct> = {
            sku: row[CSV_HEADERS.SKU],
            productType: row[CSV_HEADERS.TYPE]?.toLowerCase(),
            brandName: row[CSV_HEADERS.BRAND],
            model: row[CSV_HEADERS.MODEL] || '',
            price: row[CSV_HEADERS.PRICE] || '',
            userProvidedDetails: row[CSV_HEADERS.DETAILS] || '',
            imageUrl: row[CSV_HEADERS.IMAGE_URL]
        };

        // Validation
        if (!product.sku) throw new Error(`Row ${index + 2}: SKU is missing.`);
        if (!product.productType || !['watch', 'glasses'].includes(product.productType)) throw new Error(`Row ${index + 2}: Type must be 'watch' or 'glasses'.`);
        if (!product.brandName) throw new Error(`Row ${index + 2}: Brand is missing.`);
        if (!brandMap.has(product.brandName.toLowerCase())) throw new Error(`Row ${index + 2}: Brand "${product.brandName}" not found in the brand list.`);
        if (!product.imageUrl) throw new Error(`Row ${index + 2}: Image URL is missing.`);

        // Clean up potential stray quotes from copy-pasting
        let cleanImageUrl = product.imageUrl;
        if (cleanImageUrl.startsWith('"')) cleanImageUrl = cleanImageUrl.slice(1);
        if (cleanImageUrl.endsWith('"')) cleanImageUrl = cleanImageUrl.slice(0, -1);

        try { 
            new URL(cleanImageUrl);
            product.imageUrl = cleanImageUrl; // Update with cleaned URL if valid
        } catch { 
            throw new Error(`Row ${index + 2}: Invalid Image URL: ${product.imageUrl}`); 
        }

        return product as CsvProduct;
    });
};

export const generateTemplateCsvUrl = (): string => {
    const headers = Object.values(CSV_HEADERS).join(',');
    const exampleRow = 'WATCH-001,watch,Rolex,Submariner,500000,"Automatic movement with date display.","https://example.com/watch.jpg"';
    const csvContent = `${headers}\n${exampleRow}`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    return URL.createObjectURL(blob);
};
