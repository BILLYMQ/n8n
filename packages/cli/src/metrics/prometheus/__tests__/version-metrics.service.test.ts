import { mockInstance } from '@n8n/backend-test-utils';
import { GlobalConfig } from '@n8n/config';
import promClient from 'prom-client';

import { PrometheusVersionMetricsService } from '../version-metrics.service';

jest.mock('prom-client');

describe('PrometheusVersionMetricsService', () => {
	let globalConfig: GlobalConfig;
	let service: PrometheusVersionMetricsService;

	beforeEach(() => {
		globalConfig = mockInstance(GlobalConfig, {
			endpoints: {
				metrics: {
					prefix: 'n8n_',
				},
			},
		});

		service = new PrometheusVersionMetricsService(globalConfig);

		promClient.Gauge.prototype.set = jest.fn();
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('enabled', () => {
		it('should always be true', () => {
			expect(service.enabled).toBe(true);
		});
	});

	describe('init', () => {
		it('should create version_info gauge with semver label names', () => {
			service.init();

			expect(promClient.Gauge).toHaveBeenCalledWith({
				name: 'n8n_version_info',
				help: 'n8n version info.',
				labelNames: ['version', 'major', 'minor', 'patch'],
			});
		});

		it('should apply custom prefix to metric name', () => {
			globalConfig.endpoints.metrics.prefix = 'custom_';
			service.init();

			expect(promClient.Gauge).toHaveBeenCalledWith(
				expect.objectContaining({ name: 'custom_version_info' }),
			);
		});

		it('should set gauge with version string starting with v and numeric semver parts', () => {
			service.init();

			expect(promClient.Gauge.prototype.set).toHaveBeenCalledWith(
				{
					version: expect.stringMatching(/^v\d+/),
					major: expect.any(Number),
					minor: expect.any(Number),
					patch: expect.any(Number),
				},
				1,
			);
		});

		it('should set gauge value to 1', () => {
			service.init();

			const setCall = (promClient.Gauge.prototype.set as jest.Mock).mock.calls[0];
			expect(setCall[1]).toBe(1);
		});
	});
});
