// Technologies a repository can reveal, and the phrases a rule uses to announce them.
// Aliases are matched case-sensitively, so list every spelling worth recognising. A name that is also
// an ordinary word (react, express, rust, yarn...) is listed only capitalised: the lowercase form counts
// as a mention only inside a code span, where the check capitalises it. Every regular
// expression here is linear-time: no nested quantifiers.
export const AS_OF = '2026-11-12';
export const TECH = [
    { name: 'TypeScript', aliases: ['Typescript', 'typescript'], category: 'language', language: 'TypeScript' },
    { name: 'JavaScript', aliases: ['Javascript', 'javascript'], category: 'language', language: 'JavaScript' },
    { name: 'Python', aliases: ['python'], category: 'language', language: 'Python' },
    { name: 'Go', aliases: ['Golang', 'golang'], category: 'language', language: 'Go' },
    { name: 'Rust', aliases: [], category: 'language', language: 'Rust' },
    { name: 'React', aliases: ['ReactJS', 'React.js'], category: 'framework', packages: ['react'] },
    { name: 'Next.js', aliases: ['NextJS', 'next.js'], category: 'framework', packages: ['next'] },
    { name: 'Vue', aliases: ['vue', 'Vue.js', 'VueJS'], category: 'framework', packages: ['vue'] },
    { name: 'Nuxt', aliases: ['nuxt', 'Nuxt.js'], category: 'framework', packages: ['nuxt'] },
    { name: 'Angular', aliases: [], category: 'framework', packages: ['@angular/core'] },
    { name: 'Svelte', aliases: ['svelte'], category: 'framework', packages: ['svelte'] },
    { name: 'SvelteKit', aliases: ['sveltekit'], category: 'framework', packages: ['@sveltejs/kit'] },
    { name: 'Solid', aliases: ['SolidJS', 'Solid.js'], category: 'framework', packages: ['solid-js'] },
    { name: 'Astro', aliases: [], category: 'framework', packages: ['astro'] },
    { name: 'Remix', aliases: [], category: 'framework', packages: ['@remix-run/react'] },
    { name: 'Express', aliases: ['Express.js', 'ExpressJS'], category: 'framework', packages: ['express'] },
    { name: 'Fastify', aliases: ['fastify'], category: 'framework', packages: ['fastify'] },
    { name: 'Koa', aliases: ['koa'], category: 'framework', packages: ['koa'] },
    { name: 'Hono', aliases: ['hono'], category: 'framework', packages: ['hono'] },
    { name: 'NestJS', aliases: ['Nest.js', 'nestjs'], category: 'framework', packages: ['@nestjs/core'] },
    { name: 'Electron', aliases: [], category: 'framework', packages: ['electron'] },
    { name: 'Jest', aliases: [], category: 'test-runner', packages: ['jest'] },
    { name: 'Vitest', aliases: ['vitest'], category: 'test-runner', packages: ['vitest'] },
    { name: 'Mocha', aliases: [], category: 'test-runner', packages: ['mocha'] },
    { name: 'Jasmine', aliases: [], category: 'test-runner', packages: ['jasmine'] },
    { name: 'AVA', aliases: ['Ava'], category: 'test-runner', packages: ['ava'] },
    { name: 'Playwright', aliases: ['playwright'], category: 'test-runner', packages: ['@playwright/test', 'playwright'] },
    { name: 'Cypress', aliases: [], category: 'test-runner', packages: ['cypress'] },
    { name: 'Vite', aliases: ['vite'], category: 'bundler', packages: ['vite'] },
    { name: 'webpack', aliases: ['Webpack'], category: 'bundler', packages: ['webpack'] },
    { name: 'esbuild', aliases: ['Esbuild'], category: 'bundler', packages: ['esbuild'] },
    { name: 'Rollup', aliases: [], category: 'bundler', packages: ['rollup'] },
    { name: 'Parcel', aliases: [], category: 'bundler', packages: ['parcel'] },
    { name: 'tsup', aliases: ['Tsup'], category: 'bundler', packages: ['tsup'] },
    { name: 'npm', aliases: ['NPM', 'Npm'], category: 'package-manager', lockfile: 'package-lock.json' },
    { name: 'pnpm', aliases: ['Pnpm'], category: 'package-manager', lockfile: 'pnpm-lock.yaml', replacesDefault: true },
    { name: 'Yarn', aliases: [], category: 'package-manager', lockfile: 'yarn.lock', replacesDefault: true },
    { name: 'Bun', aliases: [], category: 'package-manager', lockfile: 'bun.lock', replacesDefault: true },
    { name: 'ESLint', aliases: ['eslint', 'Eslint'], category: 'linter', packages: ['eslint'] },
    { name: 'Biome', aliases: ['biome'], category: 'linter', packages: ['@biomejs/biome'] },
    { name: 'Prettier', aliases: ['prettier'], category: 'formatter', packages: ['prettier'] },
    { name: 'Prisma', aliases: ['prisma'], category: 'orm', packages: ['prisma', '@prisma/client'] },
    { name: 'Drizzle', aliases: ['Drizzle ORM'], category: 'orm', packages: ['drizzle-orm'] },
    { name: 'TypeORM', aliases: ['typeorm'], category: 'orm', packages: ['typeorm'] },
    { name: 'Sequelize', aliases: ['sequelize'], category: 'orm', packages: ['sequelize'] },
    { name: 'Mongoose', aliases: ['mongoose'], category: 'orm', packages: ['mongoose'] },
    { name: 'Knex', aliases: ['knex'], category: 'orm', packages: ['knex'] },
    { name: 'MikroORM', aliases: ['Mikro-orm', 'mikro-orm'], category: 'orm', packages: ['@mikro-orm/core'] },
    { name: 'Node.js', aliases: ['Node', 'NodeJS', 'node.js'], category: 'runtime', packages: ['@types/node'] },
];
// Scripts every project is expected to have; a rule that only points at one tells nothing new.
export const OBVIOUS_SCRIPTS = ['test', 'build', 'lint', 'dev', 'start', 'format', 'typecheck'];
const B = String.raw `(?<![\p{L}\p{N}_])`;
const E = String.raw `(?![\p{L}\p{N}_])`;
// Templates that announce a technology, in English and Spanish. Longer phrases come first because
// the check removes them in order and counts what is left.
export const AFFIRM = [
    new RegExp(`${B}(?:this|the)\\s+(?:project|repo|repository|app|codebase|service|library|package)\\s+(?:uses|is\\s+(?:built|written|made|developed)\\s+(?:with|in|on|using))${E}`, 'iu'),
    new RegExp(`${B}(?:este|el|esta|la)\\s+(?:proyecto|repo|repositorio|app|aplicación|servicio|librería|biblioteca|paquete)\\s+(?:usa|utiliza|emplea|está\\s+(?:hecho|hecha|escrito|escrita|construido|construida|desarrollado|desarrollada)\\s+(?:con|en))${E}`, 'iu'),
    new RegExp(`${B}(?:we|i)\\s+(?:use|are\\s+using|build\\s+with|rely\\s+on)${E}`, 'iu'),
    new RegExp(`${B}(?:usamos|utilizamos|empleamos|trabajamos\\s+con|construimos\\s+con)${E}`, 'iu'),
    new RegExp(`${B}(?:built|written|made|implemented|developed)\\s+(?:with|in|on|using)${E}`, 'iu'),
    new RegExp(`${B}(?:hecho|hecha|escrito|escrita|construido|construida|desarrollado|desarrollada|basado|basada)\\s+(?:con|en)${E}`, 'iu'),
    new RegExp(`${B}(?:use|uses|using|usa|usar|utiliza|utilizar|emplea|emplear)${E}`, 'iu'),
];
// A rule that negates, contrasts or forbids says something the repository does not.
export const NEGATION = new RegExp(`${B}(?:not|never|no|instead\\s+of|rather\\s+than|avoid|nunca|jamás|evita|en\\s+vez\\s+de|en\\s+lugar\\s+de|sin|salvo|excepto|sólo|solo|without|except|unless|only|dont|cannot|(?:do|does|did|is|are|was|were|should|would|could|must|have|has|had)n[’']t|can[’']?t|won[’']t)${E}`, 'iu');
