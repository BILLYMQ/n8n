import { readFileSync } from 'node:fs';

import { mockInstance } from '@n8n/backend-test-utils';
import { GlobalConfig } from '@n8n/config';
import promClient from 'prom-client';

import { PrometheusPssMetricsService } from '../pss-metrics.service';

jest.mock('prom-client');

const mockedReadFileSync = jest.mocked(readFileSync);

describe('PrometheusPssMetricsService', () => {
	let globalConfig: GlobalConfig;
	let service: PrometheusPssMetricsService;

	beforeEach(() => {
		globalConfig = mockInstance(GlobalConfig, {
			endpoints: {
				metrics: {
					prefix: 'n8n_',
					includeDefaultMetrics: true,
				},
			},
		});

		// Default: readFileSync throws so smaps_rollup is not available
		mockedReadFileSync.mockImplementation(() => {
			throw new Error('ENOENT: no such file or directory');
		});

		service = new PrometheusPssMetricsService(globalConfig);

		promClient.Gauge.prototype.set = jest.fn();
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('enabled', () => {
		it('should be false when includeDefaultMetrics is false', () => {
			globalConfig.endpoints.metrics.includeDefaultMetrics = false;
			// readFileSync still throws here, so both conditions fail
			expect(service.enabled).toBe(false);
		});

		it('should be false when readFileSync throws (smaps_rollup not readable)', () => {
			globalConfig.endpoints.metrics.includeDefaultMetrics = true;
			mockedReadFileSync.mockImplementation(() => {
				throw new Error('ENOENT');
			});
			expect(service.enabled).toBe(false);
		});

		it('should be true when includeDefaultMetrics is true and smaps_rollup is readable', () => {
			globalConfig.endpoints.metrics.includeDefaultMetrics = true;
			mockedReadFileSync.mockReturnValue('Pss: 1 kB' as never);
			expect(service.enabled).toBe(true);
		});
	});

	describe('init', () => {
		it('should create process_pss_bytes gauge with a collect function', () => {
			// Call init directly regardless of enabled state
			service.init();

			expect(promClient.Gauge).toHaveBeenCalledWith({
				name: 'n8n_process_pss_bytes',
				help: 'Proportional Set Size of the process in bytes.',
				collect: expect.any(Function),
			});
		});

		it('should apply custom prefix to metric name', () => {
			globalConfig.endpoints.metrics.prefix = 'custom_';
			service.init();

			expect(promClient.Gauge).toHaveBeenCalledWith(
				expect.objectContaining({ name: 'custom_process_pss_bytes' }),
			);
		});
	});

	describe('collect callback', () => {
		const extractCollectFn = () => {
			service.init();
			return (promClient.Gauge as jest.Mock).mock.calls[0][0].collect;
		};

		it('should parse Pss value and convert kB to bytes', () => {
			mockedReadFileSync.mockReturnValue(
				'Rss:   100000 kB\nPss:    12345 kB\nShared_Clean:  5000 kB' as never,
			);
			const collectFn = extractCollectFn();
			const mockGauge = { set: jest.fn() };

			collectFn.call(mockGauge);

			expect(mockGauge.set).toHaveBeenCalledWith(12345 * 1024);
		});

		it('should not call set when Pss line is not found', () => {
			mockedReadFileSync.mockReturnValue('some content without pss' as never);
			const collectFn = extractCollectFn();
			const mockGauge = { set: jest.fn() };

			collectFn.call(mockGauge);

			expect(mockGauge.set).not.toHaveBeenCalled();
		});

		it('should not throw and not call set when readFileSync fails in collect', () => {
			// service.init() does not call readFileSync — only collect() does.
			// So we extract collect first (init doesn't touch readFileSync),
			// then override to throw before the collect call.
			const collectFn = extractCollectFn();

			mockedReadFileSync.mockImplementation(() => {
				throw new Error('EACCES: permission denied');
			});

			const mockGauge = { set: jest.fn() };
			expect(() => collectFn.call(mockGauge)).not.toThrow();
			expect(mockGauge.set).not.toHaveBeenCalled();
		});
	});
});
