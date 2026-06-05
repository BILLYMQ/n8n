import { mockInstance } from '@n8n/backend-test-utils';
import { GlobalConfig } from '@n8n/config';
import { mock } from 'jest-mock-extended';
import type { StorageConfig } from 'n8n-core';
import promClient from 'prom-client';

import type { EventService } from '@/events/event.service';

import { DURATION_BUCKETS_SECONDS } from '../constant';
import { PrometheusExecutionDataMetricsService } from '../execution-data-metrics.service';

jest.mock('prom-client');

describe('PrometheusExecutionDataMetricsService', () => {
	let globalConfig: GlobalConfig;
	let eventService: jest.Mocked<EventService>;
	let storageConfig: jest.Mocked<StorageConfig>;
	let service: PrometheusExecutionDataMetricsService;

	const getEventHandler = (eventName: string) => {
		const call = (eventService.on as jest.Mock).mock.calls.find((c) => c[0] === eventName);
		return call?.[1];
	};

	beforeEach(() => {
		globalConfig = mockInstance(GlobalConfig, {
			endpoints: {
				metrics: {
					prefix: 'n8n_',
					includeExecutionDataMetrics: true,
				},
			},
		});

		eventService = mock<EventService>();
		storageConfig = mock<StorageConfig>({ modeTag: 'db' });

		service = new PrometheusExecutionDataMetricsService(globalConfig, eventService, storageConfig);

		promClient.Counter.prototype.inc = jest.fn();
		promClient.Gauge.prototype.set = jest.fn();
		promClient.Histogram.prototype.observe = jest.fn();
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('enabled', () => {
		it('should be true when includeExecutionDataMetrics is true', () => {
			globalConfig.endpoints.metrics.includeExecutionDataMetrics = true;
			expect(service.enabled).toBe(true);
		});

		it('should be false when includeExecutionDataMetrics is false', () => {
			globalConfig.endpoints.metrics.includeExecutionDataMetrics = false;
			expect(service.enabled).toBe(false);
		});
	});

	describe('init', () => {
		it('should create execution_data_reads_total counter', () => {
			service.init();

			expect(promClient.Counter).toHaveBeenCalledWith({
				name: 'n8n_execution_data_reads_total',
				help: 'Total number of execution data reads.',
				labelNames: ['mode', 'result'],
			});
		});

		it('should create execution_data_writes_total counter', () => {
			service.init();

			expect(promClient.Counter).toHaveBeenCalledWith({
				name: 'n8n_execution_data_writes_total',
				help: 'Total number of execution data writes.',
				labelNames: ['mode', 'result'],
			});
		});

		it('should create execution_data_unreadable_bundles_total counter', () => {
			service.init();

			expect(promClient.Counter).toHaveBeenCalledWith({
				name: 'n8n_execution_data_unreadable_bundles_total',
				help: 'Total number of execution data bundles that were missing or corrupt on read.',
				labelNames: ['mode'],
			});
		});

		it('should create execution_data_read_duration_seconds histogram with DURATION_BUCKETS_SECONDS', () => {
			service.init();

			expect(promClient.Histogram).toHaveBeenCalledWith({
				name: 'n8n_execution_data_read_duration_seconds',
				help: 'Execution data read duration in seconds (fetch + deserialize).',
				labelNames: ['mode'],
				buckets: DURATION_BUCKETS_SECONDS,
			});
		});

		it('should create execution_data_write_duration_seconds histogram with DURATION_BUCKETS_SECONDS', () => {
			service.init();

			expect(promClient.Histogram).toHaveBeenCalledWith({
				name: 'n8n_execution_data_write_duration_seconds',
				help: 'Execution data write duration in seconds.',
				labelNames: ['mode'],
				buckets: DURATION_BUCKETS_SECONDS,
			});
		});

		it('should create execution_data_storage_mode gauge', () => {
			service.init();

			expect(promClient.Gauge).toHaveBeenCalledWith({
				name: 'n8n_execution_data_storage_mode',
				help: 'Configured execution data storage mode (1 for the active mode, 0 otherwise).',
				labelNames: ['mode'],
			});
		});

		it('should seed reads and writes counters with all mode+result combinations at 0', () => {
			service.init();

			expect(promClient.Counter.prototype.inc).toHaveBeenCalledWith(
				{ mode: 'db', result: 'success' },
				0,
			);
			expect(promClient.Counter.prototype.inc).toHaveBeenCalledWith(
				{ mode: 'db', result: 'failure' },
				0,
			);
			expect(promClient.Counter.prototype.inc).toHaveBeenCalledWith(
				{ mode: 'fs', result: 'success' },
				0,
			);
			expect(promClient.Counter.prototype.inc).toHaveBeenCalledWith(
				{ mode: 'fs', result: 'failure' },
				0,
			);
		});

		it('should seed unreadable bundles counter for each mode at 0', () => {
			service.init();

			expect(promClient.Counter.prototype.inc).toHaveBeenCalledWith({ mode: 'db' }, 0);
			expect(promClient.Counter.prototype.inc).toHaveBeenCalledWith({ mode: 'fs' }, 0);
		});

		it('should set storage mode gauge with db=0, fs=0, and configured modeTag=1', () => {
			storageConfig.modeTag = 'db';
			service.init();

			expect(promClient.Gauge.prototype.set).toHaveBeenCalledWith({ mode: 'db' }, 0);
			expect(promClient.Gauge.prototype.set).toHaveBeenCalledWith({ mode: 'fs' }, 0);
			expect(promClient.Gauge.prototype.set).toHaveBeenCalledWith({ mode: 'db' }, 1);
		});

		it('should set storage mode gauge with fs=1 when modeTag is fs', () => {
			storageConfig.modeTag = 'fs';
			service.init();

			expect(promClient.Gauge.prototype.set).toHaveBeenCalledWith({ mode: 'db' }, 0);
			expect(promClient.Gauge.prototype.set).toHaveBeenCalledWith({ mode: 'fs' }, 0);
			expect(promClient.Gauge.prototype.set).toHaveBeenCalledWith({ mode: 'fs' }, 1);
		});
	});

	describe('execution-data-read event handler', () => {
		it('should increment reads counter with mode and result:success on success', () => {
			service.init();
			const handler = getEventHandler('execution-data-read');

			handler({ mode: 'db', durationMs: 200, success: true, unreadableBundles: 0 });

			expect(promClient.Counter.prototype.inc).toHaveBeenCalledWith(
				{ mode: 'db', result: 'success' },
				1,
			);
		});

		it('should observe read histogram with duration in seconds on success', () => {
			service.init();
			const handler = getEventHandler('execution-data-read');

			handler({ mode: 'db', durationMs: 200, success: true, unreadableBundles: 0 });

			expect(promClient.Histogram.prototype.observe).toHaveBeenCalledWith({ mode: 'db' }, 0.2);
		});

		it('should increment reads counter with result:failure on failure', () => {
			service.init();
			const handler = getEventHandler('execution-data-read');

			handler({ mode: 'fs', durationMs: 50, success: false, unreadableBundles: 0 });

			expect(promClient.Counter.prototype.inc).toHaveBeenCalledWith(
				{ mode: 'fs', result: 'failure' },
				1,
			);
		});

		it('should NOT observe read histogram on failure', () => {
			service.init();
			const handler = getEventHandler('execution-data-read');

			handler({ mode: 'db', durationMs: 50, success: false, unreadableBundles: 0 });

			expect(promClient.Histogram.prototype.observe).not.toHaveBeenCalled();
		});

		it('should increment unreadable bundles counter when unreadableBundles > 0', () => {
			service.init();
			const handler = getEventHandler('execution-data-read');

			handler({ mode: 'fs', durationMs: 5, success: true, unreadableBundles: 3 });

			expect(promClient.Counter.prototype.inc).toHaveBeenCalledWith({ mode: 'fs' }, 3);
		});

		it('should NOT increment unreadable bundles counter when unreadableBundles == 0', () => {
			service.init();
			// Capture the handler before clearing mocks
			const handler = getEventHandler('execution-data-read');
			// Reset after seeding to isolate event handler behavior from seeding calls
			jest.clearAllMocks();

			handler({ mode: 'db', durationMs: 5, success: true, unreadableBundles: 0 });

			// The unreadable bundles counter inc uses a single {mode} label (no 'result').
			// It should NOT be called when unreadableBundles == 0.
			const incCalls = (promClient.Counter.prototype.inc as jest.Mock).mock.calls;
			const unreadableCalls = incCalls.filter(
				(c) =>
					c[0] !== null &&
					typeof c[0] === 'object' &&
					Object.keys(c[0]).length === 1 &&
					'mode' in c[0],
			);
			expect(unreadableCalls).toHaveLength(0);
		});
	});

	describe('execution-data-write event handler', () => {
		it('should increment writes counter with mode and result:success on success', () => {
			service.init();
			const handler = getEventHandler('execution-data-write');

			handler({ mode: 'db', durationMs: 100, success: true });

			expect(promClient.Counter.prototype.inc).toHaveBeenCalledWith(
				{ mode: 'db', result: 'success' },
				1,
			);
		});

		it('should observe write histogram with duration in seconds on success', () => {
			service.init();
			const handler = getEventHandler('execution-data-write');

			handler({ mode: 'db', durationMs: 100, success: true });

			expect(promClient.Histogram.prototype.observe).toHaveBeenCalledWith({ mode: 'db' }, 0.1);
		});

		it('should increment writes counter with result:failure on failure', () => {
			service.init();
			const handler = getEventHandler('execution-data-write');

			handler({ mode: 'fs', durationMs: 10, success: false });

			expect(promClient.Counter.prototype.inc).toHaveBeenCalledWith(
				{ mode: 'fs', result: 'failure' },
				1,
			);
		});

		it('should NOT observe write histogram on failure', () => {
			service.init();
			const handler = getEventHandler('execution-data-write');

			handler({ mode: 'db', durationMs: 10, success: false });

			expect(promClient.Histogram.prototype.observe).not.toHaveBeenCalled();
		});
	});
});
