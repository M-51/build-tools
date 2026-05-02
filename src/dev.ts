import chokidar from 'chokidar';
import http from 'http';
import { parseArgs } from 'node:util';
import playwright from 'playwright';
import { debounce } from './utils/debounce.ts';
import { log } from './utils/logger.ts';
import { capitalize } from './utils/captilalize.ts';
import type { Callback } from './utils/debounce.ts';
import { progressBar } from './utils/progressbar.ts';
import { placeholder } from './utils/placeholder.ts';
import { formatLogLine } from './utils/format-log-line.ts';
import type { Status } from './utils/format-log-line.ts';

interface Config {
    watchers: {
        [key: string]: {
            compile: () => Promise<unknown>,
            glob: string | Array<string>,
        },
    },
    server?: {
        listener: ((req: http.IncomingMessage, res: http.ServerResponse) => void | Promise<void>),
        port?: number,
    },
    browsers?: {
        viewport?: {
            width: number,
            height: number,
        },
    },
}

async function dev(config: Config) : Promise<void> {
    const params = parseArgs({
        options: {
            browsers: { type: 'string', 'short': 'b', multiple: true },
            server: { type: 'boolean', 'short': 's' },
            url: { type: 'string', 'short': 'u' },
            watch: { type: 'boolean', 'short': 'w' },
        },
        strict: false,
    });
    const { addPlaceholder, deletePlaceholder } = placeholder('Waiting for change...');
    const port = typeof config.server?.port === 'number' && Number.isInteger(config.server.port) ? config.server.port : 8080;

    const closeServer = (() => {
        if (params.values.server === true && config.server?.listener) {
            const bar = progressBar(1);
            const logger = log(`${bar()} | Starting server...`);
            const server = http.createServer((req: http.IncomingMessage, res: http.ServerResponse) => {
                const maybePromise = config.server?.listener(req, res);
                if (maybePromise && 'catch' in maybePromise && typeof maybePromise.catch === 'function') {
                    maybePromise.catch((error: unknown) => {
                        console.log(error);
                    });
                }
            }).listen(port, () => {
                logger(`${bar(1)} | Server started in {time}ms. Listening on \x1b[35mhttp://localhost:${port}\x1b[0m`);
            });
            return async () => await new Promise((resolve, reject) => {
                server.close((err) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(true);
                });
            });
        }
        return undefined;
    })();

    const browsers = await (async () => {
        const availableBrowsers: Array<'firefox' | 'chromium' | 'webkit'> = ['firefox', 'chromium', 'webkit'];
        const browsersToStart = availableBrowsers.filter((browser) => params.values.browsers?.includes(browser) === true);
        const data = await Promise.all(browsersToStart.map(async (browserName) => {
            const bar = progressBar(4);
            const logger = log(`${bar()} | ${capitalize(browserName)} => Starting browser...`);
            let state = 'Creating browser context...';
            try {
                const browser = await playwright[browserName].launch({ headless: false, handleSIGINT: false });
                logger(`${bar(1)} | ${capitalize(browserName)} => ${state}`);
                const context = await browser.newContext({ viewport: config.browsers?.viewport ?? { width: 1500, height: 900 } });
                state = 'Opening new page...';
                logger(`${bar(2)} | ${capitalize(browserName)} => ${state}`);
                const contexts = browser.contexts();
                if (contexts[0]) {
                    const page = await contexts[0].newPage();
                    const url = typeof params.values.url === 'string' ? params.values.url : `http://localhost${params.values.server === true && config.server?.listener ? `:${port}` : ''}`;
                    state = `Navigating to ${url}...`;
                    logger(`${bar(3)} | ${capitalize(browserName)} => ${state}`);
                    await page.goto(url);
                    state = 'Ready';
                    logger(`${bar(4)} | ${capitalize(browserName)} => \x1b[32m${state} ✓\x1b[0m`);
                    return { page, browser, context };
                }
                throw new Error('Cannot find context');
            } catch (err) {
                logger(`${bar(undefined, true)} ${capitalize(browserName)} => ${state} | \x1b[31mFailed to launch browser ✖\x1b[0m`);
                throw err;
            }
        }));
        return data;
    })();

    const refresh: Callback = async (added, changed, types) => {
        deletePlaceholder();
        const now = Date.now();
        const usedTypes = Object.keys(config.watchers).filter((type) => types.includes(type));
        const status: Status = new Map(usedTypes.map((type) => [type, { status: 'compiling', startTime: now }]));
        const updateLogLine = formatLogLine(added, changed, status);

        try {
            await Promise.all(usedTypes.map(async (type) => {
                await (async () => {
                    const obj = status.get(type);
                    if (obj && config.watchers[type]) {
                        try {
                            await config.watchers[type].compile();
                            obj.status = 'compiled';
                            obj.finishTime = Date.now();
                            updateLogLine(status);
                        } catch (error) {
                            obj.status = 'error';
                            updateLogLine(status);
                            throw error;
                        }
                    }
                })();
            }));
        } catch (error) {
            console.error(error);
            addPlaceholder();
            return;
        }

        if (browsers.length > 0) {
            try {
                const pages = browsers.map((browserData) => browserData.page);
                await Promise.all(pages.map(async (page) => {
                    await page.reload();
                }));
            } catch (error) {
                console.error(error);
                addPlaceholder();
                return;
            }
        }
        addPlaceholder();
    };

    const shutdownPromises: Array<() => Promise<void>> = [];

    if (params.values.watch === true) {
        const debouncedRefresh = debounce(refresh);
        const watchers = Object.entries(config.watchers).map(([name, value]) => {
            const watcher = chokidar.watch(value.glob)
                .on('change', (filePath) => { debouncedRefresh('changed', filePath, name); })
                .on('add', (filePath) => { debouncedRefresh('added', filePath, name); });
            return watcher;
        });
        shutdownPromises.push(async () => {
            const logger = log('Closing watchers...');
            await Promise.all(watchers.map(async (watcher) => { await watcher.close(); }));
            logger('Watchers closed in {time}ms');
        });
    } else {
        await refresh([], [], Object.keys(config.watchers));
        deletePlaceholder();
    }

    if (closeServer) shutdownPromises.push(async () => { const logger = log('Closing server...'); await closeServer(); logger('Server closed in {time}ms'); });

    for (const { browser } of browsers) {
        shutdownPromises.push(async () => {
            const name = browser.browserType().name();
            const logger = log(`Closing ${name} contexts...`);
            await Promise.all(browser.contexts().map(async (context) => { await context.close(); }));
            logger(`Closing ${name}...`);
            await browser.close();
            logger(`${capitalize(name)} closed in {time}ms`);
        });
    }

    process.on('SIGINT', debounce(async () => await Promise.all(shutdownPromises.map(async (promise) => { await promise(); })).then(() => {
        process.exit(0);
    })));
}

export { dev };
