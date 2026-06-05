import { mockInstance } from '@n8n/backend-test-utils';
import { GlobalConfig } from '@n8n/config';
import type { WorkflowRepository } from '@n8n/db';
import { mock } from 'jest-mock-extended';
import promClient from 'prom-client';

import type { CacheService } from '@/services/cache/cache.service';

import { PrometheusActiveWorkflowMetricsService } from '../active-workflow-metrics.service';

jest.mock('prom-client');

describe('PrometheusActiveWorkflowMetricsService', () => {
	let globalConfig: GlobalConfig;
	let workflowRepository: jest.Mocked<WorkflowRepository>;
	let cacheService: jest.Mocked<CacheService>;
	let service: PrometheusActiveWorkflowMetricsService;

	beforeEach(() => {
		globalConfig = mockInstance(GlobalConfig, {
			endpoints: {
				metrics: {
					prefix: 'n8n_',
					activeWorkflowCountInterval: 30,
				},
			},
		});

		workflowRepository = mock<WorkflowRepository>();
		cacheService = mock<CacheService>();

		service = new PrometheusActiveWorkflowMetricsService(
			globalConfig,
			workflowRepository,
			cacheService,
		);

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
		it('should create active_workflow_count gauge with correct config', () => {
			service.init();

			expect(promClient.Gauge).toHaveBeenCalledWith({
				name: 'n8n_active_workflow_count',
				help: 'Total number of active workflows.',
				collect: expect.any(Function),
			});
		});

		it('should apply custom prefix to metric name', () => {
			globalConfig.endpoints.metrics.prefix = 'custom_';
			service.init();

			expect(promClient.Gauge).toHaveBeenCalledWith(
				expect.objectContaining({ name: 'custom_active_workflow_count' }),
			);
		});

		it('should compute cache TTL from activeWorkflowCountInterval * 1000', () => {
			globalConfig.endpoints.metrics.activeWorkflowCountInterval = 60;
			service.init();

			// TTL used in cacheService.set should be 60 * 1000 = 60000
			// We'll verify this via the collect callback
			const gaugeConfig = (promClient.Gauge as jest.Mock).mock.calls[0][0];
			expect(gaugeConfig.collect).toBeDefined();
		});
	});

	describe('collect callback', () => {
		const extractCollectFn = () => {
			service.init();
			return (promClient.Gauge as jest.Mock).mock.calls[0][0].collect;
		};

		it('should use cached value when cache returns a valid number string', async () => {
			cacheService.get.mockResolvedValue('42');
			const collectFn = extractCollectFn();
			const mockGauge = { set: jest.fn() };

			await collectFn.call(mockGauge);

			expect(cacheService.get).toHaveBeenCalledWith('metrics:active-workflow-count');
			expect(workflowRepository.getActiveCount).not.toHaveBeenCalled();
			expect(mockGauge.set).toHaveBeenCalledWith(42);
		});

		it('should call DB and cache result when cache misses (returns undefined)', async () => {
			cacheService.get.mockResolvedValue(undefined);
			workflowRepository.getActiveCount.mockResolvedValue(15);
			const collectFn = extractCollectFn();
			const mockGauge = { set: jest.fn() };

			await collectFn.call(mockGauge);

			expect(workflowRepository.getActiveCount).toHaveBeenCalled();
			expect(cacheService.set).toHaveBeenCalledWith(
				'metrics:active-workflow-count',
				'15',
				30 * 1000,
			);
			expect(mockGauge.set).toHaveBeenCalledWith(15);
		});

		it('should call DB when cached value is not a finite number', async () => {
			cacheService.get.mockResolvedValue('not-a-number');
			workflowRepository.getActiveCount.mockResolvedValue(7);
			const collectFn = extractCollectFn();
			const mockGauge = { set: jest.fn() };

			await collectFn.call(mockGauge);

			expect(workflowRepository.getActiveCount).toHaveBeenCalled();
			expect(mockGauge.set).toHaveBeenCalledWith(7);
		});

		it('should use the configured interval for the cache TTL', async () => {
			globalConfig.endpoints.metrics.activeWorkflowCountInterval = 120;
			cacheService.get.mockResolvedValue(undefined);
			workflowRepository.getActiveCount.mockResolvedValue(5);
			const collectFn = extractCollectFn();
			const mockGauge = { set: jest.fn() };

			await collectFn.call(mockGauge);

			expect(cacheService.set).toHaveBeenCalledWith(
				'metrics:active-workflow-count',
				'5',
				120 * 1000,
			);
		});
	});
});
