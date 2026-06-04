import { GlobalConfig } from '@n8n/config';
import { AuthenticatedRequest } from '@n8n/db';
import { Get, Options, Post, RestController } from '@n8n/decorators';
import { NextFunction, Response } from 'express';
import { createProxyMiddleware, fixRequestBody } from 'http-proxy-middleware';

@RestController('/telemetry')
export class TelemetryController {
	proxy;

	constructor(private readonly globalConfig: GlobalConfig) {
		this.proxy = createProxyMiddleware({
			target: this.globalConfig.diagnostics.frontendConfig.split(';')[1],
			changeOrigin: true,
			pathRewrite: {
				'^/proxy/': '/', // /proxy/v1/track -> /v1/track
			},
			on: {
				proxyReq: (proxyReq, req) => {
					proxyReq.removeHeader('cookie');
					fixRequestBody(proxyReq, req);
					return;
				},
				proxyRes: (proxyRes) => {
					// Allow MCP app UIs (sandboxed iframes on a third-party host origin)
					// to read the proxied response. Overwrites any value from the target
					// so there is never a duplicate header.
					proxyRes.headers['access-control-allow-origin'] = '*';
				},
			},
		});
	}

	/**
	 * CORS for the telemetry endpoints. They are unauthenticated and
	 * cookie-stripped passthroughs to a fixed target, so allowing any origin
	 * carries no credentialed-data risk and lets MCP app UIs running in
	 * third-party host iframes reach them. `Authorization` is allowed because
	 * the RudderStack SDK sends the write key as a Basic auth header.
	 */
	private applyCors(res: Response) {
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
		res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
		res.setHeader('Access-Control-Max-Age', '600');
	}

	@Options('/proxy/:version/:action', { skipAuth: true })
	proxyPreflight(_req: AuthenticatedRequest, res: Response) {
		this.applyCors(res);
		res.status(204).end();
	}

	@Post('/proxy/:version/track', { skipAuth: true, ipRateLimit: { limit: 100, windowMs: 60_000 } })
	async track(req: AuthenticatedRequest, res: Response, next: NextFunction) {
		await this.proxy(req, res, next);
	}

	@Post('/proxy/:version/identify', {
		skipAuth: true,
		ipRateLimit: { limit: 100, windowMs: 60_000 },
	})
	async identify(req: AuthenticatedRequest, res: Response, next: NextFunction) {
		await this.proxy(req, res, next);
	}

	@Post('/proxy/:version/page', { skipAuth: true, ipRateLimit: { limit: 50, windowMs: 60_000 } })
	async page(req: AuthenticatedRequest, res: Response, next: NextFunction) {
		await this.proxy(req, res, next);
	}

	@Options('/rudderstack/sourceConfig', { skipAuth: true })
	sourceConfigPreflight(_req: AuthenticatedRequest, res: Response) {
		this.applyCors(res);
		res.status(204).end();
	}

	@Get('/rudderstack/sourceConfig', {
		skipAuth: true,
		ipRateLimit: { limit: 50, windowMs: 60_000 },
		usesTemplates: true,
	})
	async sourceConfig(_: Request, res: Response) {
		this.applyCors(res);

		const response = await fetch('https://api-rs.n8n.io/sourceConfig', {
			headers: {
				authorization:
					'Basic ' + btoa(`${this.globalConfig.diagnostics.frontendConfig.split(';')[0]}:`),
			},
		});

		if (!response.ok) {
			throw new Error(`Failed to fetch source config: ${response.statusText}`);
		}

		const config: unknown = await response.json();

		// write directly to response to avoid wrapping the config in `data` key which is not expected by RudderStack sdk
		res.json(config);
	}
}
