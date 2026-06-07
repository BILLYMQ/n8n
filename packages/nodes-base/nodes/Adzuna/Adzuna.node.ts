import type {
	IExecuteFunctions,
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { adzunaApiRequest } from './GenericFunctions';

const SUPPORTED_COUNTRIES = [
	{ name: 'Australia', value: 'au' },
	{ name: 'Austria', value: 'at' },
	{ name: 'Belgium', value: 'be' },
	{ name: 'Brazil', value: 'br' },
	{ name: 'Canada', value: 'ca' },
	{ name: 'France', value: 'fr' },
	{ name: 'Germany', value: 'de' },
	{ name: 'India', value: 'in' },
	{ name: 'Italy', value: 'it' },
	{ name: 'Mexico', value: 'mx' },
	{ name: 'Netherlands', value: 'nl' },
	{ name: 'New Zealand', value: 'nz' },
	{ name: 'Poland', value: 'pl' },
	{ name: 'Russia', value: 'ru' },
	{ name: 'Singapore', value: 'sg' },
	{ name: 'South Africa', value: 'za' },
	{ name: 'Spain', value: 'es' },
	{ name: 'United Kingdom', value: 'gb' },
	{ name: 'United States', value: 'us' },
];

export class Adzuna implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Adzuna',
		name: 'adzuna',
		icon: 'file:adzuna.svg',
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Search for job listings using the Adzuna API',
		defaults: {
			name: 'Adzuna',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'adzunaApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Search Jobs',
						value: 'searchJobs',
						description: 'Search for job listings by keywords and location',
						action: 'Search for job listings',
					},
					{
						name: 'Get Job Count',
						value: 'getJobCount',
						description: 'Get the total number of jobs for a given query',
						action: 'Get job count for a query',
					},
					{
						name: 'Get Salary Data',
						value: 'getSalaryData',
						description: 'Get salary statistics for a job title',
						action: 'Get salary statistics for a job title',
					},
				],
				default: 'searchJobs',
			},

			// ── Country (all operations) ──────────────────────────────────────
			{
				displayName: 'Country',
				name: 'country',
				type: 'options',
				options: SUPPORTED_COUNTRIES,
				default: 'us',
				description: 'The country to search in',
			},

			// ── Search Jobs params ────────────────────────────────────────────
			{
				displayName: 'Keywords',
				name: 'what',
				type: 'string',
				default: '',
				description: 'Job title or skills to search for (e.g. "Python developer")',
				displayOptions: {
					show: { operation: ['searchJobs', 'getJobCount'] },
				},
			},
			{
				displayName: 'Location',
				name: 'where',
				type: 'string',
				default: '',
				description: 'City, region or "remote"',
				displayOptions: {
					show: { operation: ['searchJobs', 'getJobCount'] },
				},
			},
			{
				displayName: 'Results Per Page',
				name: 'results_per_page',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 50 },
				default: 10,
				description: 'Number of job listings to return (max 50)',
				displayOptions: {
					show: { operation: ['searchJobs'] },
				},
			},
			{
				displayName: 'Page',
				name: 'page',
				type: 'number',
				typeOptions: { minValue: 1 },
				default: 1,
				description: 'Page number of results',
				displayOptions: {
					show: { operation: ['searchJobs'] },
				},
			},
			{
				displayName: 'Additional Filters',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				displayOptions: {
					show: { operation: ['searchJobs'] },
				},
				options: [
					{
						displayName: 'Contract Type',
						name: 'contract_type',
						type: 'options',
						options: [
							{ name: 'Any', value: '' },
							{ name: 'Full Time', value: 'full_time' },
							{ name: 'Part Time', value: 'part_time' },
						],
						default: '',
					},
					{
						displayName: 'Contract Time',
						name: 'contract_time',
						type: 'options',
						options: [
							{ name: 'Any', value: '' },
							{ name: 'Permanent', value: 'permanent' },
							{ name: 'Contract', value: 'contract' },
						],
						default: '',
					},
					{
						displayName: 'Minimum Salary',
						name: 'salary_min',
						type: 'number',
						default: 0,
						description: 'Minimum annual salary filter',
					},
					{
						displayName: 'Maximum Salary',
						name: 'salary_max',
						type: 'number',
						default: 0,
						description: 'Maximum annual salary filter (0 = no limit)',
					},
					{
						displayName: 'Sort By',
						name: 'sort_by',
						type: 'options',
						options: [
							{ name: 'Relevance', value: 'relevance' },
							{ name: 'Date', value: 'date' },
							{ name: 'Salary', value: 'salary' },
						],
						default: 'relevance',
					},
					{
						displayName: 'Sort Direction',
						name: 'sort_dir',
						type: 'options',
						options: [
							{ name: 'Descending', value: 'down' },
							{ name: 'Ascending', value: 'up' },
						],
						default: 'down',
					},
					{
						displayName: 'Include Description',
						name: 'content-type',
						type: 'boolean',
						default: true,
						description: 'Whether to include full job description in results',
					},
				],
			},

			// ── Salary Data params ────────────────────────────────────────────
			{
				displayName: 'Job Title',
				name: 'what',
				type: 'string',
				default: '',
				description: 'Job title to get salary data for',
				displayOptions: {
					show: { operation: ['getSalaryData'] },
				},
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;
				const country = this.getNodeParameter('country', i) as string;

				if (operation === 'searchJobs') {
					const what = this.getNodeParameter('what', i) as string;
					const where = this.getNodeParameter('where', i) as string;
					const resultsPerPage = this.getNodeParameter('results_per_page', i) as number;
					const page = this.getNodeParameter('page', i) as number;
					const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

					const qs: IDataObject = {
						results_per_page: resultsPerPage,
						'content-type': 'application/json',
					};

					if (what) qs.what = what;
					if (where) qs.where = where;

					for (const [key, value] of Object.entries(additionalFields)) {
						if (value !== '' && value !== 0) {
							qs[key] = value;
						}
					}

					const response = await adzunaApiRequest.call(
						this,
						'GET',
						`/jobs/${country}/search/${page}`,
						qs,
					);

					const jobs = (response.results ?? []) as IDataObject[];
					const executionData = this.helpers.constructExecutionMetaData(
						this.helpers.returnJsonArray(jobs),
						{ itemData: { item: i } },
					);
					returnData.push(...executionData);
				}

				if (operation === 'getJobCount') {
					const what = this.getNodeParameter('what', i) as string;
					const where = this.getNodeParameter('where', i) as string;

					const qs: IDataObject = { results_per_page: 1 };
					if (what) qs.what = what;
					if (where) qs.where = where;

					const response = await adzunaApiRequest.call(
						this,
						'GET',
						`/jobs/${country}/search/1`,
						qs,
					);

					const executionData = this.helpers.constructExecutionMetaData(
						this.helpers.returnJsonArray([{ count: response.count, query: what, location: where }]),
						{ itemData: { item: i } },
					);
					returnData.push(...executionData);
				}

				if (operation === 'getSalaryData') {
					const what = this.getNodeParameter('what', i) as string;

					const response = await adzunaApiRequest.call(this, 'GET', `/jobs/${country}/history`, {
						what,
					});

					const executionData = this.helpers.constructExecutionMetaData(
						this.helpers.returnJsonArray([response as IDataObject]),
						{ itemData: { item: i } },
					);
					returnData.push(...executionData);
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						error: new NodeOperationError(this.getNode(), error as Error),
						json: {},
						itemIndex: i,
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
