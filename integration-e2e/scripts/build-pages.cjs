const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repositoryRoot = path.resolve(__dirname, '../..');
const integrationRoot = path.resolve(__dirname, '..');
const validatePagesConfig = require(path.join(repositoryRoot, 'scripts/validate-pages-config.cjs'));
const stageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'barangay-phase5b-pages-'));
const wrangler = path.join(integrationRoot, 'node_modules/.bin/wrangler');
const wranglerEnv = {
  ...process.env,
  XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME || path.join(os.tmpdir(), 'barangay-cf-config'),
};
const projects = [
  { app: 'frontend-website', stage: 'resident', config: 'wrangler.resident.jsonc', projectName: 'barangay-document-resident' },
  { app: 'frontend-admin', stage: 'staff', config: 'wrangler.staff.jsonc', projectName: 'barangay-document-staff' },
];

function run(command, args, cwd, env = process.env) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
  return result.status === 0;
}

try {
  for (const project of projects) {
    const configPath = path.join(repositoryRoot, project.config);
    validatePagesConfig(JSON.parse(fs.readFileSync(configPath, 'utf8')), project.projectName);
    const appRoot = path.join(repositoryRoot, project.app);
    const buildEnv = { ...process.env, VITE_API_BASE_URL: '/api/v1' };
    if (!run('npm', ['run', 'build'], appRoot, buildEnv)) break;

    const output = path.join(appRoot, 'dist');
    const routesPath = path.join(output, '_routes.json');
    const expectedRoutes = { version: 1, include: ['/api/v1/*'], exclude: [] };
    if (JSON.stringify(JSON.parse(fs.readFileSync(routesPath, 'utf8'))) !== JSON.stringify(expectedRoutes)) {
      throw new Error(`${project.app} build must invoke Pages Functions only for /api/v1/*`);
    }
    for (const file of ['index.html', '_headers']) {
      if (!fs.existsSync(path.join(output, file))) throw new Error(`${project.app} build is missing ${file}`);
    }

    const stage = path.join(stageRoot, project.stage);
    fs.mkdirSync(stage, { recursive: true });
    fs.cpSync(output, path.join(stage, 'dist'), { recursive: true });
    fs.cpSync(path.join(repositoryRoot, 'functions'), path.join(stage, 'functions'), { recursive: true });
    fs.copyFileSync(configPath, path.join(stage, 'wrangler.jsonc'));

    const bundle = path.join(stageRoot, `${project.stage}-functions.bundle.js`);
    const generatedRoutes = path.join(stageRoot, `${project.stage}-routes.json`);
    if (!run(wrangler, [
      'pages', 'functions', 'build', 'functions', '--project-directory', stage,
      '--outfile', bundle, '--output-routes-path', generatedRoutes,
    ], stage, wranglerEnv)) break;
    if (!fs.existsSync(bundle) || fs.statSync(bundle).size === 0) {
      throw new Error(`Wrangler did not compile the shared Function for ${project.stage}`);
    }
  }

  if (process.exitCode === 0 || process.exitCode === undefined) {
    const playwrightCli = path.join(integrationRoot, 'node_modules/@playwright/test/cli.js');
    const testEnv = {
      ...process.env,
      PHASE5B_PAGES_STAGE_ROOT: stageRoot,
      XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME || path.join(os.tmpdir(), 'barangay-cf-config'),
    };
    run(process.execPath, [playwrightCli, 'test', '--config=playwright.proxy.config.cjs'], integrationRoot, testEnv);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  fs.rmSync(stageRoot, { recursive: true, force: true });
}
