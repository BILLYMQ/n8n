import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class AdzunaApi implements ICredentialType {
	name = 'adzunaApi';

	displayName = 'Adzuna API';

	documentationUrl = 'https://developer.adzuna.com/';

	properties: INodeProperties[] = [
		{
			displayName: 'App ID',
			name: 'appId',
			type: 'string',
			default: '',
			description: 'Your Adzuna App ID from developer.adzuna.com',
		},
		{
			displayName: 'App Key',
			name: 'appKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description: 'Your Adzuna App Key from developer.adzuna.com',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			qs: {
				app_id: '={{$credentials.appId}}',
				app_key: '={{$credentials.appKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.adzuna.com/v1/api',
			url: '/jobs/gb/search/1',
			qs: {
				results_per_page: 1,
				what: 'developer',
			},
		},
	};
}
