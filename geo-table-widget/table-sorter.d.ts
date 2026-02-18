/**
 * Table sorting utilities with locale-aware string comparison
 * Uses Intl.Collator for performance (reusable instance)
 */
/**
 * Sort state interface
 */
export interface SortState {
    column: string;
    direction: 'ascending' | 'descending';
}
/**
 * Table sorting utility class with static methods
 * No instantiation needed - pure utility functions
 */
export declare class TableSorter {
    private static collator;
    /**
     * Sort array by string column with locale-aware comparison
     * @param data Source array (not mutated)
     * @param key Property key to sort by
     * @param direction Sort direction
     * @returns New sorted array
     */
    static sortByString<T>(data: T[], key: keyof T, direction: 'ascending' | 'descending'): T[];
    /**
     * Sort array by numeric column with explicit number coercion
     * @param data Source array (not mutated)
     * @param key Property key to sort by
     * @param direction Sort direction
     * @returns New sorted array
     */
    static sortByNumber<T>(data: T[], key: keyof T, direction: 'ascending' | 'descending'): T[];
    /**
     * Sort array with type detection (delegates to string or number sort)
     * @param data Source array (not mutated)
     * @param key Property key to sort by
     * @param direction Sort direction
     * @param type Data type of column
     * @returns New sorted array
     */
    static sort<T>(data: T[], key: keyof T, direction: 'ascending' | 'descending', type: 'string' | 'number'): T[];
}
//# sourceMappingURL=table-sorter.d.ts.map