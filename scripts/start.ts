/* eslint-disable import/no-extraneous-dependencies */
import esbuild from 'esbuild';
import path from 'path';
import { readFile } from 'node:fs/promises';
import postcss from 'postcss';
import postcssPresetEnv from 'postcss-preset-env';
import atImport from 'postcss-import';

import { main } from '../src/index.js';

const rootDir = path.join(new URL(import.meta.url).pathname, '../../');

const paths = {
    htmlFile: path.join(rootDir, './scripts/content/index.html'),
    cssFile: path.join(rootDir, './scripts/content/style.css'),
    tsFile: path.join(rootDir, './scripts/content/scripts.ts'),
};

const cache: Map<string, string> = new Map();

function sleepRandom() {
    return new Promise((resolve) => {
        setTimeout(resolve, Math.round(Math.random() * 3000));
    });
}

main({
    watchers: {
        CSS: {
            compile: async () => {
                const input = await readFile(paths.cssFile, 'utf-8');
                const { css } = await postcss([atImport(), postcssPresetEnv({ stage: 1 })])
                    .process(input, { from: paths.cssFile, map: { inline: true } });
                cache.set('css', css);
                await sleepRandom();
                return css;
            },
            glob: path.join(rootDir, './scripts/content/style.css'),
        },
        HTML: {
            compile: async () => {
                const html = await readFile(paths.htmlFile, { encoding: 'utf-8' });
                cache.set('html', html);
                await sleepRandom();
                return html;
            },
            glob: path.join(rootDir, './scripts/content/index.html'),
        },
        Typescript: {
            compile: async () => {
                const build = await esbuild.build({
                    entryPoints: [paths.tsFile],
                    write: false,
                    bundle: true,
                    format: 'esm',
                    logLevel: 'silent',
                    sourcemap: 'inline',
                    target: 'es2020',
                });
                const js = build.outputFiles[0].text;
                cache.set('js', js);
                await sleepRandom();
                return js;
            },
            glob: path.join(rootDir, './scripts/content/scripts.ts'),
        },
    },
    server: {
        listener: async (req, res) => {
            if (req.url === '/') {
                const file = cache.get('html');
                res.writeHead(200, { 'Content-Type': 'text/html' });
                return res.end(file);
            }
            if (req.url === '/style.css') {
                const file = cache.get('css');
                res.writeHead(200, { 'Content-Type': 'text/css' });
                return res.end(file);
            }
            if (req.url === '/script.js') {
                const file = cache.get('js');
                res.writeHead(200, { 'Content-Type': 'application/javascript' });
                return res.end(file);
            }
            if (req.url?.startsWith('/audio/')) {
                try {
                    const filename = req.url.split('/').at(-1);
                    const buffer = await readFile(path.join(rootDir, `./audio/${filename}`));
                    res.writeHead(200, { 'Content-Type': 'audio/x-matroska' });
                    return res.end(buffer);
                } catch (error) {
                    if (error.code === 'ENOENT') return null;
                    throw error;
                }
            }
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            return res.end('404');
        },
        port: 8080,
    },
});
