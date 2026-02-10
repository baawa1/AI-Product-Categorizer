
import type { SavedProduct, Category, Brand, Attribute, CsvProduct, EnrichmentCsvProduct } from '../types';

export const generateCsvContent = (products: SavedProduct[], allCategories: Category[], allBrands: Brand[], allAttributes: Attribute[]): string => {
    if (products.length === 0) return '';

    const categoryMap = new Map<number, string>(allCategories.map(cat => [cat.id, cat.name]));
    const brandMap = new Map<number, string>(allBrands.map(brand => [brand.id, brand.name]));
    const attributeMap = new Map<number, string>(allAttributes.map(attr => [attr.id, attr.name]));

    const hasEnrichmentData = products.some(p => p.originalId || p.originalName);

    const baseHeaders = ['SKU', 'Product Name', 'Primary Category ID', 'Primary Category Name', 'Title Tag', 'Meta Description', 'Short Description', 'Long Description', 'Product Type', 'Brand ID', 'Brand Name', 'Model', 'Price', 'Image Source', 'Suggested Tags', 'Category IDs', 'Category Names', 'Attribute IDs', 'Attribute Names', 'Variant Color', 'Variant Size', 'Variant Other', 'Reviewed'];
    const enrichmentHeaders = ['Original ID', 'Original Name'];
    const headers = hasEnrichmentData ? [...enrichmentHeaders, ...baseHeaders] : baseHeaders;
    
    const escapeCsvField = (field: any) => {
        if (field === null || field === undefined) return '';
        const str = String(field);
        if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
        return str;
    };

    const csvRows: string[] = [];

    products.forEach(product => {
        const categoryNames = product.categoryIds.map(id => categoryMap.get(id) || '').join('; ');
        const primaryCategoryName = product.primaryCategoryId ? categoryMap.get(product.primaryCategoryId) || '' : '';
        const attributeNames = product.attributeIds.map(id => attributeMap.get(id) || '').join('; ');
        const brandName = product.brandId ? brandMap.get(product.brandId) || '' : '';

        // Function to create a base array of shared fields
        const createBaseRowData = (vSku: string, vColor: string, vSize: string, vPrice: string, vOther: string) => [
            escapeCsvField(vSku), 
            escapeCsvField(product.productName),
            escapeCsvField(product.primaryCategoryId),
            escapeCsvField(primaryCategoryName),
            escapeCsvField(product.titleTag), 
            escapeCsvField(product.metaDescription), 
            escapeCsvField(product.shortDescription),
            escapeCsvField(product.longDescription), 
            escapeCsvField(product.productType), 
            escapeCsvField(product.brandId),
            escapeCsvField(brandName), 
            escapeCsvField(product.model), 
            escapeCsvField(vPrice || product.price),
            escapeCsvField(product.imageSource), 
            escapeCsvField(product.suggestedTags), 
            escapeCsvField(product.categoryIds.join('; ')),
            escapeCsvField(categoryNames), 
            escapeCsvField(product.attributeIds.join('; ')), 
            escapeCsvField(attributeNames),
            escapeCsvField(vColor), 
            escapeCsvField(vSize),
            escapeCsvField(vOther), 
            escapeCsvField(product.isReviewed ? 'TRUE' : 'FALSE')
        ];

        if (product.variants && product.variants.length > 0) {
            product.variants.forEach(variant => {
                const rowData = createBaseRowData(variant.sku, variant.color, variant.size, variant.price, variant.other);
                if (hasEnrichmentData) {
                    csvRows.push([escapeCsvField(product.originalId), escapeCsvField(product.originalName), ...rowData].join(','));
                } else {
                    csvRows.push(rowData.join(','));
                }
            });
        } else {
            // No variants, just export the master row
            const rowData = createBaseRowData(product.sku, '', '', product.price, '');
            if (hasEnrichmentData) {
                csvRows.push([escapeCsvField(product.originalId), escapeCsvField(product.originalName), ...rowData].join(','));
            } else {
                csvRows.push(rowData.join(','));
            }
        }
    });

    return [headers.join(','), ...csvRows].join('\n');
};

const CSV_HEADERS = {
    SKU: 'sku',
    TYPE: 'type',
    BRAND: 'brand',
    MODEL: 'model',
    PRICE: 'price',
    DETAILS: 'details',
    IMAGE_URL: 'imageurl',
    COLORS: 'colors',
};

const detectSeparator = (line: string): string => {
    const commaCount = (line.match(/,/g) || []).length;
    const tabCount = (line.match(/\t/g) || []).length;
    if (tabCount > 0 && tabCount > commaCount) {
        return '\t';
    }
    return ','; 
};

export const parseCsv = (content: string, brands: Brand[]): CsvProduct[] => {
    const rawLines = content.trim().split(/\r\n|\n/);
    if (rawLines.length < 2) throw new Error("CSV file must have a header row and at least one data row.");

    const separator = detectSeparator(rawLines[0]);
    const header = rawLines[0].split(separator).map(h => h.trim().toLowerCase());
    const numColumns = header.length;

    const lines: string[] = [];
    let lineBuffer = '';
    for (const line of rawLines.slice(1)) {
        if (lineBuffer) {
            lineBuffer += ' ' + line.trim();
        } else {
            lineBuffer = line.trim();
        }

        const separatorRegex = new RegExp(separator, 'g');
        const columnCount = (lineBuffer.match(separatorRegex) || []).length;
        if (columnCount >= numColumns - 1) {
            lines.push(lineBuffer);
            lineBuffer = '';
        }
    }
    if (lineBuffer.trim()) {
        lines.push(lineBuffer); 
    }
    
    const requiredHeaders = [CSV_HEADERS.SKU, CSV_HEADERS.TYPE, CSV_HEADERS.BRAND, CSV_HEADERS.IMAGE_URL];
    const missingHeaders = requiredHeaders.filter(rh => !header.includes(rh));
    if (missingHeaders.length > 0) {
        throw new Error(`CSV is missing required headers: ${missingHeaders.join(', ')}`);
    }

    const brandMap = new Map<string, number>(brands.map(b => [b.name.toLowerCase(), b.id]));
    const headerCount = header.length;

    return lines.map((line, index) => {
        let values = line.split(separator);

        const row: any = {};
        header.forEach((h, i) => {
            if(values[i]) row[h] = values[i].trim().replace(/^"|"$/g, '');
        });

        const product: Partial<CsvProduct> = {
            sku: row[CSV_HEADERS.SKU],
            productType: row[CSV_HEADERS.TYPE]?.toLowerCase(),
            brandName: row[CSV_HEADERS.BRAND],
            model: row[CSV_HEADERS.MODEL] || '',
            price: row[CSV_HEADERS.PRICE] || '',
            userProvidedDetails: row[CSV_HEADERS.DETAILS] || '',
            imageUrl: row[CSV_HEADERS.IMAGE_URL],
            variantColors: row[CSV_HEADERS.COLORS] || '',
        };

        if (!product.sku) throw new Error(`Row ${index + 2}: SKU is missing.`);
        if (!product.productType || !['watch', 'glasses'].includes(product.productType)) throw new Error(`Row ${index + 2}: Type must be 'watch' or 'glasses'.`);
        if (!product.brandName) throw new Error(`Row ${index + 2}: Brand is missing.`);
        if (!brandMap.has(product.brandName.toLowerCase())) throw new Error(`Row ${index + 2}: Brand "${product.brandName}" not found in the brand list.`);
        if (!product.imageUrl) throw new Error(`Row ${index + 2}: Image URL is missing.`);

        return product as CsvProduct;
    });
};

export const generateTemplateCsvUrl = (): string => {
    const headers = Object.values(CSV_HEADERS).join(',');
    const exampleRow1 = 'WATCH-001,watch,Rolex,Submariner,500000,"Automatic movement.","https://example.com/watch.jpg","Black, Silver"';
    const exampleRow2 = 'GLASS-001,glasses,Ray-Ban,Aviator,75000,"Polarized lenses.","https://example.com/glasses.jpg","Gold, Black"';
    const csvContent = `${headers}\n${exampleRow1}\n${exampleRow2}`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    return URL.createObjectURL(blob);
};

const ENRICHMENT_CSV_HEADERS = {
    ID: 'id',
    SKU: 'sku',
    NAME: 'name',
    TYPE: 'type',
    BRAND: 'brand',
    PRICE: 'price',
    IMAGE_URL: 'imageurl',
    COLORS: 'colors',
};

export const parseEnrichmentCsv = (content: string, brands: Brand[]): EnrichmentCsvProduct[] => {
    const rawLines = content.trim().split(/\r\n|\n/);
    if (rawLines.length < 2) throw new Error("CSV file must have a header row and at least one data row.");

    const separator = detectSeparator(rawLines[0]);
    const header = rawLines[0].split(separator).map(h => h.trim().toLowerCase());
    const lines = rawLines.slice(1).filter(line => line.trim() !== '');

    const requiredHeaders = [ENRICHMENT_CSV_HEADERS.ID, ENRICHMENT_CSV_HEADERS.SKU, ENRICHMENT_CSV_HEADERS.NAME, ENRICHMENT_CSV_HEADERS.TYPE, ENRICHMENT_CSV_HEADERS.BRAND, ENRICHMENT_CSV_HEADERS.IMAGE_URL];
    const missingHeaders = requiredHeaders.filter(rh => !header.includes(rh));
    if (missingHeaders.length > 0) {
        throw new Error(`CSV is missing required headers for enrichment: ${missingHeaders.join(', ')}`);
    }

    const brandMap = new Map<string, number>(brands.map(b => [b.name.toLowerCase(), b.id]));

    return lines.map((line, index) => {
        const values = line.split(separator);
        const row: any = {};
        header.forEach((h, i) => { if(values[i]) row[h] = values[i].trim().replace(/^"|"$/g, ''); });

        const product: Partial<EnrichmentCsvProduct> = {
            id: row[ENRICHMENT_CSV_HEADERS.ID],
            sku: row[ENRICHMENT_CSV_HEADERS.SKU],
            name: row[ENRICHMENT_CSV_HEADERS.NAME],
            productType: row[ENRICHMENT_CSV_HEADERS.TYPE]?.toLowerCase(),
            brandName: row[ENRICHMENT_CSV_HEADERS.BRAND],
            price: row[ENRICHMENT_CSV_HEADERS.PRICE] || '',
            imageUrl: row[ENRICHMENT_CSV_HEADERS.IMAGE_URL],
            variantColors: row[ENRICHMENT_CSV_HEADERS.COLORS] || '',
        };

        if (!product.id) throw new Error(`Row ${index + 2}: ID is missing.`);
        if (!product.sku) throw new Error(`Row ${index + 2}: SKU is missing.`);
        if (!product.name) throw new Error(`Row ${index + 2}: Name is missing.`);
        if (!product.productType || !['watch', 'glasses'].includes(product.productType)) throw new Error(`Row ${index + 2}: Type must be 'watch' or 'glasses'.`);
        if (!product.brandName) throw new Error(`Row ${index + 2}: Brand is missing.`);
        if (!brandMap.has(product.brandName.toLowerCase())) throw new Error(`Row ${index + 2}: Brand "${product.brandName}" not found in the brand list.`);
        if (!product.imageUrl) throw new Error(`Row ${index + 2}: Image URL is missing.`);

        return product as EnrichmentCsvProduct;
    });
};

export const generateEnrichmentTemplateCsvUrl = (): string => {
    const headers = Object.values(ENRICHMENT_CSV_HEADERS).join(',');
    const exampleRow = '123,WATCH-001,"Rolex Submariner",watch,Rolex,250000,"https://example.com/watch.jpg","Black, Blue"';
    const csvContent = `${headers}\n${exampleRow}`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    return URL.createObjectURL(blob);
};
