import { exportLawBLHSJson } from '../utils/parseLawBLHS.js';

try {
  const path = exportLawBLHSJson();
  console.log(`Exported BLHS JSON to: ${path}`);
  process.exit(0);
} catch (err) {
  console.error('Failed to export BLHS JSON:', err);
  process.exit(1);
}


