/**
 * Server-side injection of the front-end telemetry runtime config into MCP app
 * HTML.
 *
 * MCP app UIs run in a sandboxed iframe with no access to n8n's settings, so
 * the RudderStack runtime config is injected into the app HTML at serve time
 * as a global the UI reads on boot. The shared contract (global name, config
 * shape, CDN origin) lives in `../telemetry-contract` so the injector and the
 * UI reader can never drift.
 */
import { MCP_APP_TELEMETRY_GLOBAL, type McpAppTelemetryConfig } from '../telemetry-contract';

export {
	MCP_APP_TELEMETRY_GLOBAL,
	RUDDERSTACK_CDN_ORIGIN,
	type McpAppTelemetryConfig,
} from '../telemetry-contract';

/**
 * Inject the telemetry runtime config into an app's HTML as a global, before
 * the app's module bundle runs. `<` is escaped in the serialized JSON so a
 * value can never break out of the `<script>` context.
 */
export function injectTelemetryConfig(html: string, config: McpAppTelemetryConfig): string {
	const serialized = JSON.stringify(config).replace(/</g, '\\u003c');
	const tag = `<script>window.${MCP_APP_TELEMETRY_GLOBAL}=${serialized};</script>`;

	// Inject right after the opening <head> so the global is set before the
	// app's module script executes.
	const headMatch = /<head[^>]*>/i.exec(html);
	if (headMatch) {
		const insertAt = headMatch.index + headMatch[0].length;
		return `${html.slice(0, insertAt)}${tag}${html.slice(insertAt)}`;
	}

	return `${tag}${html}`;
}
