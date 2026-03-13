// src/services/formula-engine.ts — expr-eval wrapper for variable formulas
// Zero-dependency formula parser: same engine used in frontend + backend
// NO eval() — safe for untrusted user input

import { Parser } from 'expr-eval';

const parser = new Parser({
    operators: {
        logical: true,
        comparison: true,
        concatenate: false,
        conditional: true,
        assignment: false,
    },
});

// Register custom functions matching SmartSCADA spec
parser.functions.IF = (cond: number, then: number, otherwise: number) =>
    cond ? then : otherwise;
parser.functions.ISNULL = (val: any) => (val === null || val === undefined || isNaN(val) ? 1 : 0);
parser.functions.ABS = Math.abs;
parser.functions.ROUND = (val: number, dec: number = 0) => {
    const factor = Math.pow(10, dec);
    return Math.round(val * factor) / factor;
};
parser.functions.MIN = Math.min;
parser.functions.MAX = Math.max;
parser.functions.SQRT = Math.sqrt;
parser.functions.POW = Math.pow;
parser.functions.LOG = Math.log10;
parser.functions.LN = Math.log;
parser.functions.COALESCE = (val: number, fallback: number) =>
    (val === null || val === undefined || isNaN(val)) ? fallback : val;

export type NullPolicy = 'zero' | 'null';

export interface FormulaValidationResult {
    valid: boolean;
    variables: string[];
    error?: string;
}

export interface FormulaEvalResult {
    value: number | null;
    nullInputs?: string[];
    error?: string;
}

/**
 * Validate a formula expression without evaluating it.
 * Returns the list of referenced variables (prefixed with i_).
 */
export function validateFormula(expression: string): FormulaValidationResult {
    try {
        const parsed = parser.parse(expression);
        const variables = parsed.variables();
        return { valid: true, variables };
    } catch (err: any) {
        return { valid: false, variables: [], error: err.message };
    }
}

/**
 * Evaluate a formula with the given variable bindings.
 * nullPolicy controls how null values are handled:
 *   'zero' — substitute with 0 (professional SCADA default)
 *   'null' — propagate as NaN → result becomes null
 */
export function evaluateFormula(
    expression: string,
    bindings: Record<string, number | null>,
    nullPolicy: NullPolicy = 'zero'
): FormulaEvalResult {
    try {
        const parsed = parser.parse(expression);
        const nullInputs: string[] = [];
        const safeBindings: Record<string, number> = {};

        for (const [key, val] of Object.entries(bindings)) {
            if (val === null || val === undefined) {
                nullInputs.push(key);
                safeBindings[key] = nullPolicy === 'zero' ? 0 : NaN;
            } else {
                safeBindings[key] = val;
            }
        }

        const value = parsed.evaluate(safeBindings);
        if (typeof value !== 'number' || !isFinite(value)) {
            return { value: null, nullInputs: nullInputs.length > 0 ? nullInputs : undefined };
        }
        return { value, nullInputs: nullInputs.length > 0 ? nullInputs : undefined };
    } catch (err: any) {
        return { value: null, error: err.message };
    }
}

export interface BatchQuality {
    [alias: string]: { partial: boolean; nullInputs: string[] };
}

/**
 * Evaluate multiple formulas in topological order (by depends_on).
 * Each formula's result is available to subsequent formulas.
 * Returns values + quality metadata tracking which formulas had null inputs.
 */
export function evaluateFormulasBatch(
    formulas: Array<{ alias: string; expression: string; depends_on: number[] }>,
    columnValues: Record<string, number | null>,
    nullPolicy: NullPolicy = 'zero'
): { values: Record<string, number | null>; quality: BatchQuality } {
    const results: Record<string, number | null> = { ...columnValues };
    const quality: BatchQuality = {};

    // Topological sort by depends_on (simple — assumes no cycles, validated on save)
    const sorted = [...formulas].sort((a, b) => {
        if (b.depends_on.length === 0) return 1;
        if (a.depends_on.length === 0) return -1;
        return 0;
    });

    for (const formula of sorted) {
        const { value, nullInputs } = evaluateFormula(formula.expression, results, nullPolicy);
        results[formula.alias] = value;
        if (nullInputs && nullInputs.length > 0) {
            quality[formula.alias] = { partial: true, nullInputs };
        }
    }

    return { values: results, quality };
}

/**
 * Check for circular dependencies in a set of formulas.
 * Returns true if a cycle is detected.
 */
export function detectCycles(
    formulas: Array<{ id: number; depends_on: number[] }>
): boolean {
    const visited = new Set<number>();
    const inStack = new Set<number>();
    const idMap = new Map(formulas.map((f) => [f.id, f]));

    function dfs(id: number): boolean {
        if (inStack.has(id)) return true;
        if (visited.has(id)) return false;
        visited.add(id);
        inStack.add(id);
        const formula = idMap.get(id);
        if (formula) {
            for (const dep of formula.depends_on) {
                if (dfs(dep)) return true;
            }
        }
        inStack.delete(id);
        return false;
    }

    return formulas.some((f) => dfs(f.id));
}
