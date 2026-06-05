import { mockInstance } from '@n8n/backend-test-utils';
import { GlobalConfig } from '@n8n/config';
import { mock } from 'jest-mock-extended';
import type { InstanceSettings } from 'n8n-core';
import promClient from 'prom-client';

import type { EventService } from '@/events/event.service';

import { PrometheusQueueMetricsService } from '../queue-metrics.service';

jest.mock('prom-client');

describe('PrometheusQueueMetricsService', () => {
	let globalConfig: GlobalConfig;
	let instanceSettings: jest.Mocked<InstanceSettings>;
	let eventService: jest.Mocked<EventService>;
	let service: PrometheusQueueMetricsService;

	const getEventHandler = (eventName: string) => {
		const call = (eventService.on as jest.Mock).mock.calls.find((c) => c[0] === eventName);
		return call?.[1];
	};

	beforeEach(() => {
		globalConfig = mockInstance(GlobalConfig, {
			endpoints: {
				metrics: {
					prefix: 'n8n_',
					includeQueueMetrics: true,
				},
			},
			executions: {
				mode: 'queue',
			},
		});

		instanceSettings = mock<InstanceSettings>({ instanceType: 'main' });
		eventService = mock<EventService>();

		service = new PrometheusQueueMetricsService(globalConfig, instanceSettings, eventService);

		promClient.Gauge.prototype.set = jest.fn();
		promClient.Counter.prototype.inc = jest.fn();
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('enabled', () => {
		it('should be true when all conditions are met (includeQueueMetrics, queue mode, main instance)', () => {
			expect(service.enabled).toBe(true);
		});

		it('should be false when includeQueueMetrics is false', () => {
			globalConfig.endpoints.metrics.includeQueueMetrics = false;
			expect(service.enabled).toBe(false);
		});

		it('should be false when executions.mode is not queue', () => {
			globalConfig.executions.mode = 'regular';
			expect(service.enabled).toBe(false);
		});

		it('should be false when instanceType is not main', () => {
			instanceSettings.instanceType = 'worker';
			expect(service.enabled).toBe(false);
		});
	});

	describe('init', () => {
		it('should create scaling_mode_queue_jobs_waiting gauge', () => {
			service.init();

			expect(promClient.Gauge).toHaveBeenCalledWith({
				name: 'n8n_scaling_mode_queue_jobs_waiting',
				help: 'Current number of enqueued jobs waiting for pickup in scaling mode.',
			});
		});

		it('should create scaling_mode_queue_jobs_active gauge', () => {
			service.init();

			expect(promClient.Gauge).toHaveBeenCalledWith({
				name: 'n8n_scaling_mode_queue_jobs_active',
				help: 'Current number of jobs being processed across all workers in scaling mode.',
			});
		});

		it('should create scaling_mode_queue_jobs_completed counter', () => {
			service.init();

			expect(promClient.Counter).toHaveBeenCalledWith({
				name: 'n8n_scaling_mode_queue_jobs_completed',
				help: 'Total number of jobs completed across all workers in scaling mode since instance start.',
			});
		});

		it('should create scaling_mode_queue_jobs_failed counter', () => {
			service.init();

			expect(promClient.Counter).toHaveBeenCalledWith({
				name: 'n8n_scaling_mode_queue_jobs_failed',
				help: 'Total number of jobs failed across all workers in scaling mode since instance start.',
			});
		});

		it('should seed both gauges at 0', () => {
			service.init();

			// Gauge.prototype.set called twice for the 2 gauges
			expect(promClient.Gauge.prototype.set).toHaveBeenCalledWith(0);
			expect(promClient.Gauge.prototype.set).toHaveBeenCalledTimes(2);
		});

		it('should seed both counters at 0', () => {
			service.init();

			expect(promClient.Counter.prototype.inc).toHaveBeenCalledWith(0);
			expect(promClient.Counter.prototype.inc).toHaveBeenCalledTimes(2);
		});

		it('should register a job-counts-updated event listener', () => {
			service.init();

			expect(eventService.on).toHaveBeenCalledWith('job-counts-updated', expect.any(Function));
		});
	});

	describe('job-counts-updated event handler', () => {
		it('should update gauges and counters with correct values from job counts', () => {
			service.init();
			const handler = getEventHandler('job-counts-updated');
			jest.clearAllMocks();

			handler({ waiting: 5, active: 3, completed: 10, failed: 2 });

			// The gauges and counters are called via prototype mocks
			expect(promClient.Gauge.prototype.set).toHaveBeenCalledWith(5);
			expect(promClient.Gauge.prototype.set).toHaveBeenCalledWith(3);
			expect(promClient.Counter.prototype.inc).toHaveBeenCalledWith(10);
			expect(promClient.Counter.prototype.inc).toHaveBeenCalledWith(2);
		});
	});
});
