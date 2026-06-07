/**
 * Deep structural comparison utility for WCL API responses.
 * Compares two objects field-by-field and reports all differences.
 */

/**
 * @typedef {Object} Diff
 * @property {string} path - Dot-notation path to the differing field
 * @property {string} type - 'missing_in_b' | 'missing_in_a' | 'type_mismatch' | 'value_mismatch'
 * @property {*} [valueA] - Value in object A
 * @property {*} [valueB] - Value in object B
 */

/**
 * Sort an array of objects by a key for order-independent comparison.
 * Tries 'id', 'guid', 'name' in order. Falls back to JSON stringification.
 */
function sortArray(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return arr;

  const first = arr[0];
  if (typeof first !== 'object' || first === null) {
    // Primitive array — sort by value
    return [...arr].sort((a, b) => {
      if (a < b) return -1;
      if (a > b) return 1;
      return 0;
    });
  }

  // Object array — sort by id, guid, or name
  const sortKey = 'id' in first ? 'id' : ('guid' in first ? 'guid' : ('name' in first ? 'name' : null));
  if (sortKey) {
    return [...arr].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av < bv) return -1;
      if (av > bv) return 1;
      return 0;
    });
  }

  // Fallback: sort by JSON string
  return [...arr].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

/**
 * Deep compare two values and collect differences.
 * @param {*} a - First value (V1 baseline)
 * @param {*} b - Second value (V2 or Proxy)
 * @param {string} path - Current path in dot notation
 * @param {Diff[]} diffs - Accumulator for found differences
 * @param {Object} opts - Options
 * @param {number} opts.maxDiffs - Stop after this many diffs (default 200)
 * @param {Set<string>} opts.ignorePaths - Paths to skip during comparison
 * @param {number} [opts.maxDepth=15] - Maximum recursion depth
 * @param {number} [depth=0] - Current depth
 */
export function deepCompare(a, b, path = '$', diffs = [], opts = {}, depth = 0) {
  const maxDiffs = opts.maxDiffs || 200;
  const maxDepth = opts.maxDepth || 15;
  const ignorePaths = opts.ignorePaths || new Set();

  if (diffs.length >= maxDiffs) return diffs;
  if (depth > maxDepth) return diffs;
  if (ignorePaths.has(path)) return diffs;

  // Both null/undefined
  if (a === null && b === null) return diffs;
  if (a === undefined && b === undefined) return diffs;

  // One missing
  if (a === undefined || a === null) {
    if (b !== undefined && b !== null) {
      diffs.push({ path, type: 'missing_in_a', valueB: summarizeValue(b) });
    }
    return diffs;
  }
  if (b === undefined || b === null) {
    diffs.push({ path, type: 'missing_in_b', valueA: summarizeValue(a) });
    return diffs;
  }

  // Type mismatch
  const typeA = Array.isArray(a) ? 'array' : typeof a;
  const typeB = Array.isArray(b) ? 'array' : typeof b;

  if (typeA !== typeB) {
    diffs.push({ path, type: 'type_mismatch', valueA: `${typeA}(${summarizeValue(a)})`, valueB: `${typeB}(${summarizeValue(b)})` });
    return diffs;
  }

  // Arrays
  if (typeA === 'array') {
    if (a.length !== b.length) {
      diffs.push({ path, type: 'array_length', valueA: a.length, valueB: b.length });
    }

    const sortedA = sortArray(a);
    const sortedB = sortArray(b);
    const maxLen = Math.min(sortedA.length, sortedB.length, 50); // Cap array comparison at 50 elements

    for (let i = 0; i < maxLen; i++) {
      if (diffs.length >= maxDiffs) break;
      deepCompare(sortedA[i], sortedB[i], `${path}[${i}]`, diffs, opts, depth + 1);
    }
    return diffs;
  }

  // Objects
  if (typeA === 'object') {
    const keysA = new Set(Object.keys(a));
    const keysB = new Set(Object.keys(b));

    for (const key of keysA) {
      if (diffs.length >= maxDiffs) break;
      if (!keysB.has(key)) {
        diffs.push({ path: `${path}.${key}`, type: 'missing_in_b', valueA: summarizeValue(a[key]) });
      } else {
        deepCompare(a[key], b[key], `${path}.${key}`, diffs, opts, depth + 1);
      }
    }

    for (const key of keysB) {
      if (diffs.length >= maxDiffs) break;
      if (!keysA.has(key)) {
        diffs.push({ path: `${path}.${key}`, type: 'missing_in_a', valueB: summarizeValue(b[key]) });
      }
    }
    return diffs;
  }

  // Primitives
  if (a !== b) {
    // Allow small numeric differences (floating point)
    if (typeof a === 'number' && typeof b === 'number') {
      if (Math.abs(a - b) < 0.01) return diffs;
    }
    diffs.push({ path, type: 'value_mismatch', valueA: a, valueB: b });
  }

  return diffs;
}

/**
 * Summarize a value for display (truncate large objects/arrays).
 */
function summarizeValue(val) {
  if (val === null) return 'null';
  if (val === undefined) return 'undefined';
  if (typeof val === 'string') return val.length > 80 ? val.substring(0, 80) + '...' : val;
  if (typeof val === 'number' || typeof val === 'boolean') return val;
  if (Array.isArray(val)) return `Array(${val.length})`;
  if (typeof val === 'object') return `Object(${Object.keys(val).length} keys)`;
  return String(val);
}

/**
 * Generate a summary report from diffs.
 * @param {string} testName - Name of the test
 * @param {Diff[]} diffs - Array of differences found
 * @returns {Object} Summary object
 */
export function summarizeDiffs(testName, diffs) {
  const missingInB = diffs.filter(d => d.type === 'missing_in_b').length;
  const missingInA = diffs.filter(d => d.type === 'missing_in_a').length;
  const typeMismatches = diffs.filter(d => d.type === 'type_mismatch').length;
  const valueMismatches = diffs.filter(d => d.type === 'value_mismatch').length;
  const arrayLengths = diffs.filter(d => d.type === 'array_length').length;

  return {
    testName,
    passed: diffs.length === 0,
    totalDiffs: diffs.length,
    missingInB,
    missingInA,
    typeMismatches,
    valueMismatches,
    arrayLengths,
    diffs
  };
}

/**
 * Format a comparison result as a markdown section.
 */
export function formatResultMarkdown(result) {
  const icon = result.passed ? '✅' : '❌';
  let md = `### ${icon} ${result.testName}\n\n`;

  if (result.passed) {
    md += `**PASS** — No differences found.\n\n`;
    return md;
  }

  md += `**FAIL** — ${result.totalDiffs} difference(s) found\n\n`;
  md += `| Category | Count |\n|----------|-------|\n`;
  if (result.missingInB > 0) md += `| Missing in V2/Proxy (V1 has, V2 doesn't) | ${result.missingInB} |\n`;
  if (result.missingInA > 0) md += `| Extra in V2/Proxy (V2 has, V1 doesn't) | ${result.missingInA} |\n`;
  if (result.typeMismatches > 0) md += `| Type mismatches | ${result.typeMismatches} |\n`;
  if (result.valueMismatches > 0) md += `| Value mismatches | ${result.valueMismatches} |\n`;
  if (result.arrayLengths > 0) md += `| Array length differences | ${result.arrayLengths} |\n`;

  md += `\n<details><summary>Show all differences</summary>\n\n`;
  md += `| Path | Type | V1 Value | V2 Value |\n|------|------|----------|----------|\n`;

  for (const d of result.diffs.slice(0, 100)) {
    const valA = d.valueA !== undefined ? String(d.valueA) : '—';
    const valB = d.valueB !== undefined ? String(d.valueB) : '—';
    md += `| \`${d.path}\` | ${d.type} | ${valA} | ${valB} |\n`;
  }

  if (result.diffs.length > 100) {
    md += `| ... | ... | ... | ... |\n`;
    md += `| *${result.diffs.length - 100} more differences omitted* | | | |\n`;
  }

  md += `\n</details>\n\n`;
  return md;
}
