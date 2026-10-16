const fs = require('node:fs');

const EXPECTED_API_ORIGIN = 'https://barangay-document-request-system-backend.onrender.com';

function validatePagesConfig(config, expectedProject) {
  if (config.name !== expectedProject || config.pages_build_output_dir !== './dist') {
    throw new Error('Pages Wrangler config does not match the selected project and dist output.');
  }

  for (const [scope, vars] of [
    ['shared', config.vars],
    ['production', config.env?.production?.vars],
  ]) {
    const value = vars?.API_ORIGIN;
    let origin;
    try { origin = new URL(value); } catch { origin = null; }
    if (!origin || origin.origin !== EXPECTED_API_ORIGIN || origin.pathname !== '/' || origin.search || origin.hash ||
        origin.username || origin.password || value !== EXPECTED_API_ORIGIN) {
      throw new Error(`Pages Wrangler config must set the approved HTTPS API_ORIGIN in ${scope} vars.`);
    }
  }

  function containsPlaintextSecret(value) {
    if (!value || typeof value !== 'object') return false;
    if (Object.hasOwn(value, 'CLIENT_IP_HMAC_SECRET')) return true;
    return Object.values(value).some(containsPlaintextSecret);
  }
  if (containsPlaintextSecret(config.vars) || containsPlaintextSecret(config.env)) {
    throw new Error('CLIENT_IP_HMAC_SECRET must be configured as an encrypted Pages secret.');
  }
}

module.exports = validatePagesConfig;

if (require.main === module) {
  const [configPath, expectedProject] = process.argv.slice(2);
  if (!configPath || !expectedProject) {
    console.error('Usage: node scripts/validate-pages-config.cjs <wrangler-config> <expected-project>');
    process.exitCode = 2;
  } else {
    try {
      validatePagesConfig(JSON.parse(fs.readFileSync(configPath, 'utf8')), expectedProject);
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
