import {
	MCP_APP_TELEMETRY_GLOBAL,
	RUDDERSTACK_CDN_ORIGIN,
	type McpAppTelemetryConfig,
} from '../telemetry-contract';
import type { RudderStack } from './types';

/**
 * MCP app lifecycle telemetry events. Title Case to match n8n's existing
 * RudderStack event naming convention.
 */
export const MCP_APP_EVENTS = {
	PREVIEW_RENDERED: 'MCP App preview rendered',
	PREVIEW_RENDER_FAILED: 'MCP App preview render failed',
} as const;

/**
 * Loads the RudderStack browser SDK using the v1 stub-array snippet: a stub on
 * `window.rudderanalytics` buffers calls until `ra.min.js` loads and replaces
 * it, so events fired right after `load()` are not lost.
 */
function loadRudderStack(writeKey: string, dataPlaneUrl: string, options: object): void {
	const stub = (window.rudderanalytics ?? []) as RudderStack;
	window.rudderanalytics = stub;

	stub.methods = [
		'load',
		'page',
		'track',
		'identify',
		'group',
		'ready',
		'reset',
		'getAnonymousId',
		'setAnonymousId',
	];

	stub.factory =
		(method: string) =>
		(...args: unknown[]) => {
			stub.push([method, ...args]);
			return stub;
		};

	for (const method of stub.methods) {
		stub[method] = stub.factory(method);
	}

	stub.loadJS = () => {
		const script = document.createElement('script');
		script.type = 'text/javascript';
		script.async = true;
		script.src = `${RUDDERSTACK_CDN_ORIGIN}/v1/ra.min.js`;

		const first = document.getElementsByTagName('script')[0];
		if (first?.parentNode) {
			first.parentNode.insertBefore(script, first);
		} else {
			document.head.appendChild(script);
		}
	};

	stub.loadJS();
	stub.load(writeKey, dataPlaneUrl, options);
}

/**
 * Best-effort RudderStack telemetry for MCP app UIs.
 *
 * Runs inside a sandboxed iframe on a third-party host, so every operation is
 * defensive: telemetry is disabled unless the injected config opts in, and any
 * failure (config missing, CSP blocking the SDK, runtime error) degrades
 * silently and never throws into the app.
 */
export class McpAppTelemetry {
	private config?: McpAppTelemetryConfig;
	private ready = false;

	private get rudderStack(): RudderStack | undefined {
		return window.rudderanalytics;
	}

	/**
	 * Initializes RudderStack from the injected runtime config. Idempotent and
	 * a no-op when diagnostics are disabled or the config is missing/invalid.
	 */
	init(config: McpAppTelemetryConfig | undefined = window[MCP_APP_TELEMETRY_GLOBAL]): void {
		if (this.ready) return;
		if (!config?.enabled || !config.writeKey || !config.dataPlaneUrl) return;

		try {
			loadRudderStack(config.writeKey, config.dataPlaneUrl, {
				configUrl: config.configUrl,
				// `All` is RudderStack's required key for disabling all destinations.
				// eslint-disable-next-line @typescript-eslint/naming-convention
				integrations: { All: false },
				loadIntegration: false,
			});
			this.config = config;
			this.ready = true;
		} catch {
			// CSP may block the SDK script; stay disabled rather than throwing.
			this.ready = false;
		}
	}

	track(event: string, properties: Record<string, unknown> = {}): void {
		if (!this.ready || !this.config) return;

		try {
			this.rudderStack?.track(
				event,
				{
					...properties,
					instance_id: this.config.instanceId,
					version_cli: this.config.versionCli,
				},
				// Send a fake IP so RudderStack does not capture the user's real one.
				{ context: { ip: '0.0.0.0' } },
			);
		} catch {
			// Best-effort: never let telemetry break the app.
		}
	}
}

export const telemetry = new McpAppTelemetry();

export function useTelemetry(): McpAppTelemetry {
	return telemetry;
}
