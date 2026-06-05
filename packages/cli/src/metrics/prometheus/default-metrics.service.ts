import { GlobalConfig } from '@n8n/config';
import { Service } from '@n8n/di';
import promClient from 'prom-client';

import { PrometheusMetricsCollector } from './base';

/** Registers prom-client default process metrics (CPU, memory, GC, etc.) under the configured prefix. */
@Service()
export class PrometheusDefaultMetricsService implements PrometheusMetricsCollector {
	constructor(private readonly globalConfig: GlobalConfig) {}

	init() {
		promClient.collectDefaultMetrics({ prefix: this.globalConfig.endpoints.metrics.prefix });
	}

	get enabled(): boolean {
		return this.globalConfig.endpoints.metrics.includeDefaultMetrics;
	}
}
