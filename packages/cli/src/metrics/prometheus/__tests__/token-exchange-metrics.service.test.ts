import { mockInstance } from '@n8n/backend-test-utils';
import { GlobalConfig } from '@n8n/config';
import { mock } from 'jest-mock-extended';
import promClient from 'prom-client';

import type { EventService } from '@/events/event.service';

import { PrometheusTokenExchangeMetricsService } from '../token-exchange-metrics.service';

jest.mock('prom-client');

describe('PrometheusTokenExchangeMetricsService', () => {
	let globalConfig: GlobalConfig;
	let eventService: jest.Mocked<EventService>;
	let service: PrometheusTokenExchangeMetricsService;

	const getEventHandler = (eventName: string) => {
		const call = (eventService.on as jest.Mock).mock.calls.find((c) => c[0] === eventName);
		return call?.[1];
	};

	beforeEach(() => {
		globalConfig = mockInstance(GlobalConfig, {
			endpoints: {
				metrics: {
					prefix: 'n8n_',
				},
			},
		});

		eventService = mock<EventService>();
		service = new PrometheusTokenExchangeMetricsService(globalConfig, eventService);

		promClient.Counter.prototype.inc = jest.fn();
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('enabled', () => {
		it('should always be true', () => {
			expect(service.enabled).toBe(true);
		});
	});

	describe('init — counter registration', () => {
		it('should register token_exchange_requests_total counter with result label', () => {
			service.init();

			expect(promClient.Counter).toHaveBeenCalledWith({
				name: 'n8n_token_exchange_requests_total',
				help: 'Total number of token exchange requests.',
				labelNames: ['result'],
			});
		});

		it('should register token_exchange_failures_total counter with reason label', () => {
			service.init();

			expect(promClient.Counter).toHaveBeenCalledWith({
				name: 'n8n_token_exchange_failures_total',
				help: 'Total number of token exchange failures broken down by reason.',
				labelNames: ['reason'],
			});
		});

		it('should register embed_login_requests_total counter with result label', () => {
			service.init();

			expect(promClient.Counter).toHaveBeenCalledWith({
				name: 'n8n_embed_login_requests_total',
				help: 'Total number of embed login requests.',
				labelNames: ['result'],
			});
		});

		it('should register embed_login_failures_total counter with reason label', () => {
			service.init();

			expect(promClient.Counter).toHaveBeenCalledWith({
				name: 'n8n_embed_login_failures_total',
				help: 'Total number of embed login failures broken down by reason.',
				labelNames: ['reason'],
			});
		});

		it('should register token_exchange_jit_provisioning_total counter with no labels', () => {
			service.init();

			expect(promClient.Counter).toHaveBeenCalledWith({
				name: 'n8n_token_exchange_jit_provisioning_total',
				help: 'Total number of users JIT-provisioned via token exchange.',
			});
		});

		it('should register token_exchange_identity_linked_total counter with no labels', () => {
			service.init();

			expect(promClient.Counter).toHaveBeenCalledWith({
				name: 'n8n_token_exchange_identity_linked_total',
				help: 'Total number of external identities linked to existing users via token exchange.',
			});
		});

		it('should register all 6 counters', () => {
			service.init();

			expect(promClient.Counter).toHaveBeenCalledTimes(6);
		});
	});

	describe('init — pre-seeding', () => {
		it('should pre-seed token exchange requests counter with success and failure at 0', () => {
			service.init();

			expect(promClient.Counter.prototype.inc).toHaveBeenCalledWith({ result: 'success' }, 0);
			expect(promClient.Counter.prototype.inc).toHaveBeenCalledWith({ result: 'failure' }, 0);
		});

		it('should pre-seed embed login requests counter with success and failure at 0', () => {
			service.init();

			// inc({result:'success'}, 0) and inc({result:'failure'}, 0) called for both request counters
			const incCalls = (promClient.Counter.prototype.inc as jest.Mock).mock.calls;
			const successSeeds = incCalls.filter((c) => c[0]?.result === 'success' && c[1] === 0);
			const failureSeeds = incCalls.filter((c) => c[0]?.result === 'failure' && c[1] === 0);
			expect(successSeeds).toHaveLength(2);
			expect(failureSeeds).toHaveLength(2);
		});

		it('should pre-seed JIT provisioning counter at 0', () => {
			service.init();

			expect(promClient.Counter.prototype.inc).toHaveBeenCalledWith(0);
		});

		it('should pre-seed identity linked counter at 0', () => {
			service.init();

			const incCalls = (promClient.Counter.prototype.inc as jest.Mock).mock.calls;
			const zeroSeeds = incCalls.filter((c) => c[0] === 0);
			expect(zeroSeeds).toHaveLength(2); // JIT and identity linked
		});
	});

	describe('event handlers', () => {
		it('should increment token exchange requests success on token-exchange-succeeded', () => {
			service.init();
			const handler = getEventHandler('token-exchange-succeeded');
			jest.clearAllMocks();

			handler({});

			expect(promClient.Counter.prototype.inc).toHaveBeenCalledWith({ result: 'success' }, 1);
		});

		it('should increment token exchange requests failure and failures counter on token-exchange-failed', () => {
			service.init();
			const handler = getEventHandler('token-exchange-failed');
			jest.clearAllMocks();

			handler({ failureReason: 'unknown_key' });

			expect(promClient.Counter.prototype.inc).toHaveBeenCalledWith({ result: 'failure' }, 1);
			expect(promClient.Counter.prototype.inc).toHaveBeenCalledWith({ reason: 'unknown_key' }, 1);
		});

		it('should pass through "other" failure reason', () => {
			service.init();
			const handler = getEventHandler('token-exchange-failed');
			jest.clearAllMocks();

			handler({ failureReason: 'other' });

			expect(promClient.Counter.prototype.inc).toHaveBeenCalledWith({ reason: 'other' }, 1);
		});

		it('should pass through "role_not_allowed" failure reason', () => {
			service.init();
			const handler = getEventHandler('token-exchange-failed');
			jest.clearAllMocks();

			handler({ failureReason: 'role_not_allowed' });

			expect(promClient.Counter.prototype.inc).toHaveBeenCalledWith(
				{ reason: 'role_not_allowed' },
				1,
			);
		});

		it('should pass through "invalid_signature" failure reason', () => {
			service.init();
			const handler = getEventHandler('token-exchange-failed');
			jest.clearAllMocks();

			handler({ failureReason: 'invalid_signature' });

			expect(promClient.Counter.prototype.inc).toHaveBeenCalledWith(
				{ reason: 'invalid_signature' },
				1,
			);
		});

		it('should increment embed login success on embed-login', () => {
			service.init();
			const handler = getEventHandler('embed-login');
			jest.clearAllMocks();

			handler({});

			expect(promClient.Counter.prototype.inc).toHaveBeenCalledWith({ result: 'success' }, 1);
		});

		it('should increment embed login failure and failures counter on embed-login-failed', () => {
			service.init();
			const handler = getEventHandler('embed-login-failed');
			jest.clearAllMocks();

			handler({ failureReason: 'invalid_signature' });

			expect(promClient.Counter.prototype.inc).toHaveBeenCalledWith({ result: 'failure' }, 1);
			expect(promClient.Counter.prototype.inc).toHaveBeenCalledWith(
				{ reason: 'invalid_signature' },
				1,
			);
		});

		it('should increment JIT provisioning counter on token-exchange-user-provisioned', () => {
			service.init();
			const handler = getEventHandler('token-exchange-user-provisioned');
			jest.clearAllMocks();

			handler({});

			expect(promClient.Counter.prototype.inc).toHaveBeenCalledWith(1);
		});

		it('should increment identity linked counter on token-exchange-identity-linked', () => {
			service.init();
			const handler = getEventHandler('token-exchange-identity-linked');
			jest.clearAllMocks();

			handler({});

			expect(promClient.Counter.prototype.inc).toHaveBeenCalledWith(1);
		});
	});
});
