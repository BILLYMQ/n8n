import { mockInstance } from '@n8n/backend-test-utils';
import { GlobalConfig } from '@n8n/config';
import promClient from 'prom-client';

import { PrometheusDefaultMetricsService } from '../default-metrics.service';

jest.mock('prom-client');

describe('PrometheusDefaultMetricsService', () => {
	let globalConfig: GlobalConfig;
	let service: PrometheusDefaultMetricsService;

	beforeEach(() => {
		globalConfig = mockInstance(GlobalConfig, {
			endpoints: {
				metrics: {
					prefix: 'n8n_',
					includeDefaultMetrics: true,
				},
			},
		});

		service = new PrometheusDefaultMetricsService(globalConfig);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('enabled', () => {
		it('should be true when includeDefaultMetrics is true', () => {
			globalConfig.endpoints.metrics.includeDefaultMetrics = true;
			expect(service.enabled).toBe(true);
		});

		it('should be false when includeDefaultMetrics is false', () => {
			globalConfig.endpoints.metrics.includeDefaultMetrics = false;
			expect(service.enabled).toBe(false);
		});
	});

	describe('init', () => {
		it('should call promClient.collectDefaultMetrics with the configured prefix', () => {
			service.init();

			expect(promClient.collectDefaultMetrics).toHaveBeenCalledWith({ prefix: 'n8n_' });
		});

		it('should pass custom prefix to collectDefaultMetrics', () => {
			globalConfig.endpoints.metrics.prefix = 'custom_';
			service.init();

			expect(promClient.collectDefaultMetrics).toHaveBeenCalledWith({ prefix: 'custom_' });
		});
	});
});
