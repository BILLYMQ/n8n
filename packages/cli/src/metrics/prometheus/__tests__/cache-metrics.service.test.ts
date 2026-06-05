import { mockInstance } from '@n8n/backend-test-utils';
import { GlobalConfig } from '@n8n/config';
import { mock } from 'jest-mock-extended';
import promClient from 'prom-client';

import type { CacheService } from '@/services/cache/cache.service';

import { PrometheusCacheMetricsService } from '../cache-metrics.service';

jest.mock('prom-client');

describe('PrometheusCacheMetricsService', () => {
	let globalConfig: GlobalConfig;
	let cacheService: jest.Mocked<CacheService>;
	let service: PrometheusCacheMetricsService;

	beforeEach(() => {
		globalConfig = mockInstance(GlobalConfig, {
			endpoints: {
				metrics: {
					prefix: 'n8n_',
					includeCacheMetrics: true,
				},
			},
		});

		cacheService = mock<CacheService>();
		cacheService.isRedis.mockReturnValue(false);
		service = new PrometheusCacheMetricsService(cacheService, globalConfig);

		promClient.Counter.prototype.inc = jest.fn();
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('enabled', () => {
		it('should be true when includeCacheMetrics is true', () => {
			globalConfig.endpoints.metrics.includeCacheMetrics = true;
			expect(service.enabled).toBe(true);
		});

		it('should be false when includeCacheMetrics is false', () => {
			globalConfig.endpoints.metrics.includeCacheMetrics = false;
			expect(service.enabled).toBe(false);
		});
	});

	describe('init', () => {
		it('should create cache_hits_total counter with correct config', () => {
			service.init();

			expect(promClient.Counter).toHaveBeenCalledWith({
				name: 'n8n_cache_hits_total',
				help: 'Total number of cache hits.',
				labelNames: ['cache'],
			});
		});

		it('should create cache_misses_total counter with correct config', () => {
			service.init();

			expect(promClient.Counter).toHaveBeenCalledWith({
				name: 'n8n_cache_misses_total',
				help: 'Total number of cache misses.',
				labelNames: ['cache'],
			});
		});

		it('should create cache_updates_total counter with correct config', () => {
			service.init();

			expect(promClient.Counter).toHaveBeenCalledWith({
				name: 'n8n_cache_updates_total',
				help: 'Total number of cache updates.',
				labelNames: ['cache'],
			});
		});

		it('should seed all 3 counters at 0 with the cache label', () => {
			service.init();

			expect(promClient.Counter.prototype.inc).toHaveBeenCalledWith({ cache: 'memory' }, 0);
			expect(promClient.Counter.prototype.inc).toHaveBeenCalledTimes(3);
		});

		it('should use redis as cache label when cache backend is redis', () => {
			cacheService.isRedis.mockReturnValue(true);
			service.init();

			expect(promClient.Counter.prototype.inc).toHaveBeenCalledWith({ cache: 'redis' }, 0);
		});

		it('should apply custom prefix to metric names', () => {
			globalConfig.endpoints.metrics.prefix = 'myapp_';
			service.init();

			expect(promClient.Counter).toHaveBeenCalledWith(
				expect.objectContaining({ name: 'myapp_cache_hits_total' }),
			);
			expect(promClient.Counter).toHaveBeenCalledWith(
				expect.objectContaining({ name: 'myapp_cache_misses_total' }),
			);
			expect(promClient.Counter).toHaveBeenCalledWith(
				expect.objectContaining({ name: 'myapp_cache_updates_total' }),
			);
		});

		it('should register a listener for metrics.cache.hit that increments the counter', () => {
			service.init();

			const hitHandler = (cacheService.on as jest.Mock).mock.calls.find(
				(c) => c[0] === 'metrics.cache.hit',
			)?.[1];

			expect(hitHandler).toBeDefined();
			hitHandler();
			expect(promClient.Counter.prototype.inc).toHaveBeenCalledWith({ cache: 'memory' }, 1);
		});

		it('should register a listener for metrics.cache.miss that increments the counter', () => {
			service.init();

			const missHandler = (cacheService.on as jest.Mock).mock.calls.find(
				(c) => c[0] === 'metrics.cache.miss',
			)?.[1];

			expect(missHandler).toBeDefined();
			missHandler();
			expect(promClient.Counter.prototype.inc).toHaveBeenCalledWith({ cache: 'memory' }, 1);
		});

		it('should register a listener for metrics.cache.update that increments the counter', () => {
			service.init();

			const updateHandler = (cacheService.on as jest.Mock).mock.calls.find(
				(c) => c[0] === 'metrics.cache.update',
			)?.[1];

			expect(updateHandler).toBeDefined();
			updateHandler();
			expect(promClient.Counter.prototype.inc).toHaveBeenCalledWith({ cache: 'memory' }, 1);
		});
	});
});
