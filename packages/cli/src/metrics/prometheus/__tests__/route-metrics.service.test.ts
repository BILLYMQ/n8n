import { mockInstance } from '@n8n/backend-test-utils';
import { GlobalConfig } from '@n8n/config';
import type express from 'express';
import promBundle from 'express-prom-bundle';
import { mock } from 'jest-mock-extended';
import promClient from 'prom-client';

import { PrometheusRouteMetricsService } from '../route-metrics.service';

jest.mock('prom-client');
jest.mock('express-prom-bundle', () =>
	jest.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
);

describe('PrometheusRouteMetricsService', () => {
	let globalConfig: GlobalConfig;
	let app: jest.Mocked<express.Application>;
	let service: PrometheusRouteMetricsService;

	beforeEach(() => {
		globalConfig = mockInstance(GlobalConfig, {
			endpoints: {
				metrics: {
					prefix: 'n8n_',
					includeApiEndpoints: true,
					includeApiPathLabel: false,
					includeApiMethodLabel: false,
					includeApiStatusCodeLabel: false,
				},
				rest: 'rest',
				webhook: 'webhook',
				webhookWaiting: 'webhook-waiting',
				webhookTest: 'webhook-test',
				form: 'form',
				formWaiting: 'form-waiting',
				formTest: 'form-test',
			},
		});

		app = mock<express.Application>();
		service = new PrometheusRouteMetricsService(globalConfig);

		promClient.Gauge.prototype.set = jest.fn();
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('enabled', () => {
		it('should be true when includeApiEndpoints is true', () => {
			globalConfig.endpoints.metrics.includeApiEndpoints = true;
			expect(service.enabled).toBe(true);
		});

		it('should be false when includeApiEndpoints is false', () => {
			globalConfig.endpoints.metrics.includeApiEndpoints = false;
			expect(service.enabled).toBe(false);
		});
	});

	describe('init', () => {
		it('should create last_activity gauge', () => {
			service.init(app);

			expect(promClient.Gauge).toHaveBeenCalledWith(
				expect.objectContaining({
					name: 'n8n_last_activity',
					help: 'last instance activity (backend request) in Unix time (seconds).',
				}),
			);
		});

		it('should apply custom prefix to metric names', () => {
			globalConfig.endpoints.metrics.prefix = 'custom_';
			service.init(app);

			expect(promClient.Gauge).toHaveBeenCalledWith(
				expect.objectContaining({ name: 'custom_last_activity' }),
			);
		});

		it('should call promBundle with correct options', () => {
			service.init(app);

			expect(promBundle).toHaveBeenCalledWith({
				autoregister: false,
				includeUp: false,
				includePath: false,
				includeMethod: false,
				includeStatusCode: false,
				httpDurationMetricName: 'n8n_http_request_duration_seconds',
			});
		});

		it('should pass custom prefix to httpDurationMetricName', () => {
			globalConfig.endpoints.metrics.prefix = 'custom_';
			service.init(app);

			expect(promBundle).toHaveBeenCalledWith(
				expect.objectContaining({
					httpDurationMetricName: 'custom_http_request_duration_seconds',
				}),
			);
		});

		it('should pass includeApiPathLabel to promBundle', () => {
			globalConfig.endpoints.metrics.includeApiPathLabel = true;
			service.init(app);

			expect(promBundle).toHaveBeenCalledWith(expect.objectContaining({ includePath: true }));
		});

		it('should pass includeApiMethodLabel to promBundle', () => {
			globalConfig.endpoints.metrics.includeApiMethodLabel = true;
			service.init(app);

			expect(promBundle).toHaveBeenCalledWith(expect.objectContaining({ includeMethod: true }));
		});

		it('should pass includeApiStatusCodeLabel to promBundle', () => {
			globalConfig.endpoints.metrics.includeApiStatusCodeLabel = true;
			service.init(app);

			expect(promBundle).toHaveBeenCalledWith(expect.objectContaining({ includeStatusCode: true }));
		});

		it('should register app.use with the correct route paths', () => {
			service.init(app);

			expect(app.use).toHaveBeenCalledWith(
				[
					'/api/',
					'/rest/',
					'/webhook/',
					'/webhook-waiting/',
					'/webhook-test/',
					'/form/',
					'/form-waiting/',
					'/form-test/',
				],
				expect.any(Function),
			);
		});

		it('should update last_activity gauge when the registered middleware is called', async () => {
			service.init(app);

			const middleware = (app.use as jest.Mock).mock.calls[0][1];
			const req = mock<express.Request>();
			const res = mock<express.Response>();
			const next = jest.fn();

			await middleware(req, res, next);

			expect(promClient.Gauge.prototype.set).toHaveBeenCalledTimes(2); // once in init, once in middleware
		});
	});
});
