/**
 * Table sorting utilities with locale-aware string comparison
 * Uses Intl.Collator for performance (reusable instance)
 */
/**
 * Table sorting utility class with static methods
 * No instantiation needed - pure utility functions
 */
export class TableSorter {
    // Reusable collator instance for locale-aware string sorting
    // Create once, use many times (research pitfall: don't create per sort call)
    static collator = new Intl.Collator(undefined, {
        numeric: false,
        sensitivity: 'base' // Case-insensitive, accent-insensitive
    });
    /**
     * Sort array by string column with locale-aware comparison
     * @param data Source array (not mutated)
     * @param key Property key to sort by
     * @param direction Sort direction
     * @returns New sorted array
     */
    static sortByString(data, key, direction) {
        // CRITICAL: Always sort a COPY - never mutate original array (research pitfall #5)
        const sorted = [...data].sort((a, b) => {
            const valA = String(a[key]);
            const valB = String(b[key]);
            return TableSorter.collator.compare(valA, valB);
        });
        return direction === 'ascending' ? sorted : sorted.reverse();
    }
    /**
     * Sort array by numeric column with explicit number coercion
     * @param data Source array (not mutated)
     * @param key Property key to sort by
     * @param direction Sort direction
     * @returns New sorted array
     */
    static sortByNumber(data, key, direction) {
        // CRITICAL: Always sort a COPY - never mutate original array (research pitfall #5)
        const sorted = [...data].sort((a, b) => {
            // Explicit Number() coercion with || 0 fallback (research pitfall #4)
            const valA = Number(a[key]) || 0;
            const valB = Number(b[key]) || 0;
            return valA - valB;
        });
        return direction === 'ascending' ? sorted : sorted.reverse();
    }
    /**
     * Sort array with type detection (delegates to string or number sort)
     * @param data Source array (not mutated)
     * @param key Property key to sort by
     * @param direction Sort direction
     * @param type Data type of column
     * @returns New sorted array
     */
    static sort(data, key, direction, type) {
        return type === 'number'
            ? TableSorter.sortByNumber(data, key, direction)
            : TableSorter.sortByString(data, key, direction);
    }
}
//# sourceMappingURL=table-sorter.js.map