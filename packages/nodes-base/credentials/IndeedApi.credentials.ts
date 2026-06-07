import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class IndeedApi implements ICredentialType {
	name = 'indeedApi';

	displayName = 'Indeed API';

	documentationUrl = 'https://rapidapi.com/letscrape-6bRBa3QguO5/api/indeed12';

	properties: INodeProperties[] = [
		{
			displayName: 'RapidAPI Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description:
				'Your RapidAPI key. Get one free at rapidapi.com — subscribe to the "Indeed12" API.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-RapidAPI-Key': '={{$credentials.apiKey}}',
				'X-RapidAPI-Host': 'indeed12.p.rapidapi.com',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://indeed12.p.rapidapi.com',
			url: '/jobs/search',
			qs: {
				query: 'developer',
				location: 'New York',
				page_id: '1',
				locality: 'us',
			},
		},
	};
}
