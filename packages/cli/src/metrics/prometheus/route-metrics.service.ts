import { GlobalConfig } from '@n8n/config';
import { Service } from '@n8n/di';
import type express from 'express';
import promBundle from 'express-prom-bundle';
import { DateTime } from 'luxon';
import promClient, { Gauge } from 'prom-client';

import { PrometheusMetricsCollector } from './base';

/**
 * Instruments Express routes with `express-prom-bundle` for HTTP request duration metrics,
 * and tracks last backend activity time via `n8n_last_activity` gauge.
 */
@Service()
export class PrometheusRouteMetricsService implements PrometheusMetricsCollector {
	constructor(private readonly globalConfig: GlobalConfig) {}

	get enabled(): boolean {
		return this.globalConfig.endpoints.metrics.includeApiEndpoints;
	}

	init(app?: express.Application) {
		const gauge = new promClient.Gauge({
			name: `${this.globalConfig.endpoints.metrics.prefix}last_activity`,
			help: 'last instance activity (backend request) in Unix time (seconds).',
		});

		gauge.set(DateTime.now().toUnixInteger());
		this.registerMiddleware(app!, gauge);
	}

	private registerMiddleware(app: express.Application, gauge: Gauge) {
		const metricsMiddleware = promBundle({
			autoregister: false,
			includeUp: false,
			includePath: this.globalConfig.endpoints.metrics.includeApiPathLabel,
			includeMethod: this.globalConfig.endpoints.metrics.includeApiMethodLabel,
			includeStatusCode: this.globalConfig.endpoints.metrics.includeApiStatusCodeLabel,
			httpDurationMetricName: `${this.globalConfig.endpoints.metrics.prefix}http_request_duration_seconds`,
		});

		app.use(
			[
				'/api/',
				`/${this.globalConfig.endpoints.rest}/`,
				`/${this.globalConfig.endpoints.webhook}/`,
				`/${this.globalConfig.endpoints.webhookWaiting}/`,
				`/${this.globalConfig.endpoints.webhookTest}/`,
				`/${this.globalConfig.endpoints.form}/`,
				`/${this.globalConfig.endpoints.formWaiting}/`,
				`/${this.globalConfig.endpoints.formTest}/`,
			],
			async (req, res, next) => {
				gauge.set(DateTime.now().toUnixInteger());
				await metricsMiddleware(req, res, next);
			},
		);
	}
}
