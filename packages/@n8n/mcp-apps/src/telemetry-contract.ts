/**
 * Shared contract between the server-side config injector
 * (`server/telemetry-config.ts`) and the UI-side reader (`telemetry/`).
 *
 * Keeping these in one neutral module — imported by both the CommonJS server
 * build and the ESM UI build — ensures the injected global name, the config
 * shape, and the CDN origin can never drift between the two sides.
 */

/** Global the MCP app UI reads its RudderStack runtime config from. */
export const MCP_APP_TELEMETRY_GLOBAL = '__N8N_MCP_TELEMETRY__';

/** Origin the RudderStack browser SDK script is loaded from (CSP `script-src`). */
export const RUDDERSTACK_CDN_ORIGIN = 'https://cdn-rs.n8n.io';

/**
 * Front-end telemetry runtime config injected into an MCP app's HTML.
 *
 * Intentionally instance-level only — no `userId` — both for privacy and so
 * the injected HTML is identical for every user of an instance.
 */
export interface McpAppTelemetryConfig {
	/** Whether diagnostics are enabled. When false the UI must not load RudderStack. */
	enabled: boolean;
	/** RudderStack write key. */
	writeKey: string;
	/** Data plane URL (proxied through the n8n instance). */
	dataPlaneUrl: string;
	/** Source config URL (proxied through the n8n instance). */
	configUrl: string;
	/** Instance ID, used for event enrichment. */
	instanceId: string;
	/** n8n version, used for event enrichment. */
	versionCli: string;
}
