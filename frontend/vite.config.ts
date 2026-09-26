import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { handleAnalyzeMovementRequest } from './src/api/analyzeMovement.ts';
import { handlePaymentOnboard, handleSubscribe, handleWebhook } from './src/api/paymentGateway.ts';

function algorandApiPlugin(): Plugin {
  return {
    name: 'algorand-api-server',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && (req.url === '/api/rehab/analyze-movement' || req.url.startsWith('/api/rehab/analyze-movement?'))) {
          if (req.method === 'POST') {
            let rawBody = '';
            req.on('data', (chunk) => {
              rawBody += chunk;
            });
            req.on('end', async () => {
              try {
                const parsedBody = rawBody ? JSON.parse(rawBody) : {};

                // Pass all request headers so handler can read X-PAYMENT
                const reqHeaders: Record<string, string | undefined> = {};
                for (const [key, val] of Object.entries(req.headers)) {
                  reqHeaders[key.toLowerCase()] = Array.isArray(val) ? val[0] : val;
                }

                const response = await handleAnalyzeMovementRequest(parsedBody, reqHeaders);

                res.statusCode = response.status;

                // Set x402 response headers if provided
                if (response.responseHeaders) {
                  for (const [key, val] of Object.entries(response.responseHeaders)) {
                    res.setHeader(key, val);
                  }
                } else {
                  res.setHeader('Content-Type', 'application/json');
                }

                res.end(JSON.stringify(response.body));
              } catch (err: any) {
                console.error('Error handling /api/rehab/analyze-movement:', err);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'internal_error', message: err.message }));
              }
            });
            return;
          }
        }
        next();
      });
    },
  };
}


function multiGatewayApiPlugin(): Plugin {
  return {
    name: 'multi-gateway-api-server',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api/payments/')) {
          let rawBody = '';
          req.on('data', chunk => { rawBody += chunk; });
          req.on('end', async () => {
            try {
              const parsedBody = rawBody ? JSON.parse(rawBody) : {};
              let response = { status: 404, body: { error: 'Not found' } };
              
              if (req.url === '/api/payments/onboard' && req.method === 'POST') {
                response = await handlePaymentOnboard(parsedBody);
              } else if (req.url === '/api/payments/subscribe' && req.method === 'POST') {
                response = await handleSubscribe(parsedBody);
              } else if (req.url?.startsWith('/api/payments/webhook/')) {
                const gateway = req.url.split('/').pop() || '';
                response = await handleWebhook(gateway, parsedBody);
              }
              
              res.statusCode = response.status;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify(response.body));
            } catch (err: any) {
              console.error(`Error in ${req.url}:`, err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'internal_error', message: err.message }));
            }
          });
          return;
        }
        next();
      });
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    algorandApiPlugin(),
    multiGatewayApiPlugin(),
  ],
  optimizeDeps: {
    exclude: ['@mediapipe/tasks-vision'],
  },
  server: {
    headers: {
      // Allow the WASM pose runtime to fetch its own assets during local development.
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
    watch: {
      ignored: ['**/supabase/**', '**/supabase - Copy/**'],
    },
  },
});

