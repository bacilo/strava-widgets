/**
 * Markdown list of failing test names from a vitest JSON report (Phase 36.1).
 * Pure summarizeFailures(jsonText); main() prints it and always exits 0 —
 * the final workflow step decides the job's exit code.
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function summarizeFailures(jsonText) {
  let report;
  try {
    report = JSON.parse(jsonText);
  } catch {
    return 'JSON report unavailable (unparseable)';
  }
  const results = report && Array.isArray(report.testResults) ? report.testResults : null;
  if (!results) return 'JSON report unavailable (no testResults array)';
  const lines = [];
  for (const file of results) {
    const asserts = Array.isArray(file && file.assertionResults) ? file.assertionResults : [];
    for (const a of asserts) {
      if (a && a.status === 'failed') {
        lines.push(`- ${file.name} > ${a.fullName ?? a.title ?? '(unnamed)'}`);
      }
    }
  }
  if (lines.length === 0) return 'No failing assertions found in the JSON report';
  return lines.join('\n');
}

function main() {
  let text;
  try {
    text = readFileSync(process.argv[2] ?? '', 'utf8');
  } catch {
    console.log('JSON report unavailable (file missing)');
    return;
  }
  console.log(summarizeFailures(text));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
