import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { RESOURCE_MIME_TYPE, WORKFLOW_PREVIEW_APP_URI } from '../constants';
import { loadAppHtml } from '../resource-loader';
import {
	injectTelemetryConfig,
	RUDDERSTACK_CDN_ORIGIN,
	type McpAppTelemetryConfig,
} from '../telemetry-config';

export interface RegisterWorkflowPreviewAppOptions {
	/**
	 * Origin (scheme://host[:port]) allowed for telemetry egress via CSP
	 * `connect-src`. Front-end telemetry is proxied through the n8n instance, so
	 * this is the instance origin.
	 */
	instanceOrigin: string;
	/** Front-end telemetry runtime config injected into the app HTML. */
	telemetry: McpAppTelemetryConfig;
	/**
	 * Called when the host reads the app HTML to render it. This is the
	 * backend-observable "render requested" signal. Kept as a neutral callback so
	 * this package stays telemetry-agnostic; the consumer decides what to track.
	 */
	onResourceRead?: () => void;
}

export function registerWorkflowPreviewApp(
	server: Pick<McpServer, 'resource'>,
	options: RegisterWorkflowPreviewAppOptions,
): void {
	const { instanceOrigin, telemetry, onResourceRead } = options;

	server.resource(
		'workflow-preview',
		WORKFLOW_PREVIEW_APP_URI,
		{
			description: 'Loading UI shown after creating a workflow from code',
			mimeType: RESOURCE_MIME_TYPE,
		},
		async () => {
			const html = await loadAppHtml('workflow-preview.html');

			// The host is fetching the app to render it. Telemetry must never break
			// serving the resource, so failures here are swallowed.
			try {
				onResourceRead?.();
			} catch {
				// no-op
			}

			return {
				contents: [
					{
						uri: WORKFLOW_PREVIEW_APP_URI,
						mimeType: RESOURCE_MIME_TYPE,
						text: injectTelemetryConfig(html, telemetry),
						_meta: {
							// Declare the origins the app needs. The host enforces these as
							// the iframe CSP; the secure default is no network access, so
							// both the SDK script origin and the egress origin must be listed.
							ui: {
								csp: {
									resourceDomains: [RUDDERSTACK_CDN_ORIGIN],
									connectDomains: [instanceOrigin],
								},
							},
						},
					},
				],
			};
		},
	);
}
