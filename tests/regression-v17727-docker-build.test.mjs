import assert from 'node:assert/strict';
import fs from 'node:fs';

const dockerfile = fs.readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');
const compose = fs.readFileSync(new URL('../docker-compose.yml', import.meta.url), 'utf8');
const envExample = fs.readFileSync(new URL('../.env.example', import.meta.url), 'utf8');

assert.match(dockerfile, /ARG NPM_REGISTRY=/, 'Dockerfile must expose a configurable NPM_REGISTRY build arg');
assert.match(dockerfile, /COREPACK_NPM_REGISTRY/, 'Corepack download must use the configured npm registry');
assert.match(dockerfile, /npm_config_registry/, 'pnpm package downloads must use the configured npm registry');
assert.match(dockerfile, /pnpm prune --prod/, 'build stage must prune to production dependencies after compiling');

const runtimeSection = dockerfile.split(/FROM .* AS runtime/)[1] ?? '';
assert.ok(runtimeSection, 'Dockerfile must contain a runtime stage');
assert.doesNotMatch(runtimeSection, /pnpm install|corepack enable|corepack prepare/, 'runtime stage must not download/install packages');
assert.match(runtimeSection, /COPY --from=build \/app\/node_modules \.\/node_modules/, 'runtime stage must copy production node_modules from build stage');

assert.match(compose, /NPM_REGISTRY:\s*\$\{NPM_REGISTRY:-/, 'docker-compose must pass NPM_REGISTRY into the image build');
assert.match(envExample, /^NPM_REGISTRY=/m, '.env.example must document NPM_REGISTRY');

console.log('V17.7.27 Docker restricted-network regression checks passed');
