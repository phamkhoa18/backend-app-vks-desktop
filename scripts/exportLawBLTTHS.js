import { exportLawBLTTHSJson } from '../utils/parseLawBLHS.js';

try {
  const path = exportLawBLTTHSJson();
  console.log(`Exported BLTTHS JSON to: ${path}`);
  process.exit(0);
} catch (err) {
  console.error('Failed to export BLTTHS JSON:', err);
  process.exit(1);
}


