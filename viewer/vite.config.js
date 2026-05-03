import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { promises as fs, watch } from 'node:fs';
import path from 'node:path';
const ARCH_DIR = path.resolve(__dirname, '..', 'architectures');
/**
 * Plugin: expone /api/architectures/* (GET listar, GET por slug, POST guardar).
 * Observa architectures/ y notifica al cliente vía HMR cuando un JSON cambia.
 */
function architectureApi() {
    return {
        name: 'architecture-api',
        configureServer(server) {
            // Watch architectures/
            const watcher = watch(ARCH_DIR, { persistent: true }, (_event, filename) => {
                if (filename && filename.endsWith('.json')) {
                    server.ws.send({
                        type: 'custom',
                        event: 'architecture-changed',
                        data: { slug: filename.replace(/\.json$/, '') },
                    });
                }
            });
            server.httpServer?.once('close', () => watcher.close());
            // List all cases
            server.middlewares.use('/api/cases', async (req, res, next) => {
                if (req.method !== 'GET')
                    return next();
                try {
                    const files = await fs.readdir(ARCH_DIR);
                    const cases = await Promise.all(files
                        .filter((f) => f.endsWith('.json'))
                        .map(async (f) => {
                        const slug = f.replace(/\.json$/, '');
                        const stat = await fs.stat(path.join(ARCH_DIR, f));
                        return { slug, mtime: stat.mtimeMs };
                    }));
                    cases.sort((a, b) => b.mtime - a.mtime);
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(cases));
                }
                catch (err) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: String(err) }));
                }
            });
            // GET /api/architecture/<slug>
            // POST /api/architecture/<slug>  body: full JSON
            server.middlewares.use('/api/architecture/', async (req, res, next) => {
                const slug = (req.url || '').replace(/^\//, '').split('?')[0];
                if (!slug)
                    return next();
                const filePath = path.join(ARCH_DIR, `${slug}.json`);
                if (req.method === 'GET') {
                    try {
                        const content = await fs.readFile(filePath, 'utf-8');
                        res.setHeader('Content-Type', 'application/json');
                        res.end(content);
                    }
                    catch {
                        res.statusCode = 404;
                        res.end(JSON.stringify({ error: `case '${slug}' not found` }));
                    }
                    return;
                }
                if (req.method === 'POST' || req.method === 'PUT') {
                    let body = '';
                    for await (const chunk of req)
                        body += chunk;
                    try {
                        const parsed = JSON.parse(body);
                        await fs.writeFile(filePath, JSON.stringify(parsed, null, 2) + '\n', 'utf-8');
                        res.setHeader('Content-Type', 'application/json');
                        res.end(JSON.stringify({ ok: true }));
                    }
                    catch (err) {
                        res.statusCode = 400;
                        res.end(JSON.stringify({ error: String(err) }));
                    }
                    return;
                }
                next();
            });
        },
    };
}
export default defineConfig({
    plugins: [react(), architectureApi()],
    server: {
        port: 5173,
        open: true,
        fs: {
            // Permitir leer architectures/ que está fuera del root
            allow: ['..'],
        },
    },
});
