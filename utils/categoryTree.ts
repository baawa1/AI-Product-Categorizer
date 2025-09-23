
import type { Category, CategoryNode } from '../types';

export const buildCategoryTree = (categories: Category[]): CategoryNode[] => {
    const nodeMap = new Map<number, CategoryNode>();
    const roots: CategoryNode[] = [];

    // First pass: create a node for each category and store it in a map.
    categories.forEach(category => {
        nodeMap.set(category.id, { ...category, children: [] });
    });

    // Second pass: link children to their parents.
    categories.forEach(category => {
        const node = nodeMap.get(category.id);
        if (!node) return;

        if (category.parent === 0) {
            roots.push(node);
        } else {
            const parentNode = nodeMap.get(category.parent);
            if (parentNode) {
                parentNode.children.push(node);
            }
        }
    });

    return roots;
};
