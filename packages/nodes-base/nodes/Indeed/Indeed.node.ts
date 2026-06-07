import type {
	IExecuteFunctions,
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { indeedApiRequest } from './GenericFunctions';

const LOCALITY_OPTIONS = [
	{ name: 'Argentina', value: 'ar' },
	{ name: 'Australia', value: 'au' },
	{ name: 'Austria', value: 'at' },
	{ name: 'Belgium', value: 'be' },
	{ name: 'Brazil', value: 'br' },
	{ name: 'Canada', value: 'ca' },
	{ name: 'Chile', value: 'cl' },
	{ name: 'Colombia', value: 'co' },
	{ name: 'France', value: 'fr' },
	{ name: 'Germany', value: 'de' },
	{ name: 'India', value: 'in' },
	{ name: 'Italy', value: 'it' },
	{ name: 'Mexico', value: 'mx' },
	{ name: 'Netherlands', value: 'nl' },
	{ name: 'New Zealand', value: 'nz' },
	{ name: 'Nigeria', value: 'ng' },
	{ name: 'Poland', value: 'pl' },
	{ name: 'Portugal', value: 'pt' },
	{ name: 'Singapore', value: 'sg' },
	{ name: 'South Africa', value: 'za' },
	{ name: 'Spain', value: 'es' },
	{ name: 'Sweden', value: 'se' },
	{ name: 'Switzerland', value: 'ch' },
	{ name: 'United Kingdom', value: 'uk' },
	{ name: 'United States', value: 'us' },
];

export class Indeed implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Indeed',
		name: 'indeed',
		icon: 'file:indeed.svg',
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Search and retrieve job listings from Indeed',
		defaults: {
			name: 'Indeed',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'indeedApi',
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
						action: 'Search for job listings on Indeed',
					},
					{
						name: 'Get Job Details',
						value: 'getJobDetails',
						description: 'Retrieve full details for a specific job by its ID',
						action: 'Get full details for a job',
					},
				],
				default: 'searchJobs',
			},

			// ── Search Jobs ──────────────────────────────────────────────────
			{
				displayName: 'Keywords',
				name: 'query',
				type: 'string',
				default: '',
				placeholder: 'e.g. Python developer, Data Scientist',
				description: 'Job title, skills, or keywords to search for',
				displayOptions: {
					show: { operation: ['searchJobs'] },
				},
			},
			{
				displayName: 'Location',
				name: 'location',
				type: 'string',
				default: '',
				placeholder: 'e.g. Paris, Remote',
				description: 'City, region, or "Remote"',
				displayOptions: {
					show: { operation: ['searchJobs'] },
				},
			},
			{
				displayName: 'Country',
				name: 'locality',
				type: 'options',
				options: LOCALITY_OPTIONS,
				default: 'us',
				description: 'Country site of Indeed to search',
				displayOptions: {
					show: { operation: ['searchJobs'] },
				},
			},
			{
				displayName: 'Page',
				name: 'page_id',
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
						displayName: 'Date Posted',
						name: 'fromage',
						type: 'options',
						options: [
							{ name: 'Any Time', value: 'any' },
							{ name: 'Last 24 Hours', value: '1' },
							{ name: 'Last 3 Days', value: '3' },
							{ name: 'Last 7 Days', value: '7' },
							{ name: 'Last 14 Days', value: '14' },
						],
						default: 'any',
						description: 'Filter by posting date',
					},
					{
						displayName: 'Radius (km)',
						name: 'radius',
						type: 'number',
						default: 25,
						description: 'Search radius from the location in kilometres',
					},
					{
						displayName: 'Sort By',
						name: 'sort',
						type: 'options',
						options: [
							{ name: 'Relevance', value: 'relevance' },
							{ name: 'Date', value: 'date' },
						],
						default: 'relevance',
					},
					{
						displayName: 'Job Type',
						name: 'job_type',
						type: 'options',
						options: [
							{ name: 'Any', value: '' },
							{ name: 'Full Time', value: 'fulltime' },
							{ name: 'Part Time', value: 'parttime' },
							{ name: 'Contract', value: 'contract' },
							{ name: 'Internship', value: 'internship' },
						],
						default: '',
					},
					{
						displayName: 'Remote Only',
						name: 'remote_jobs_only',
						type: 'boolean',
						default: false,
						description: 'Whether to return only remote job listings',
					},
				],
			},

			// ── Get Job Details ──────────────────────────────────────────────
			{
				displayName: 'Job ID',
				name: 'jobId',
				type: 'string',
				default: '',
				description: 'The Indeed job ID (from a Search Jobs result)',
				displayOptions: {
					show: { operation: ['getJobDetails'] },
				},
			},
			{
				displayName: 'Country',
				name: 'locality',
				type: 'options',
				options: LOCALITY_OPTIONS,
				default: 'us',
				description: 'Country site where the job was found',
				displayOptions: {
					show: { operation: ['getJobDetails'] },
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

				if (operation === 'searchJobs') {
					const query = this.getNodeParameter('query', i) as string;
					const location = this.getNodeParameter('location', i) as string;
					const locality = this.getNodeParameter('locality', i) as string;
					const pageId = this.getNodeParameter('page_id', i) as number;
					const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

					const qs: IDataObject = {
						query,
						page_id: String(pageId),
						locality,
					};

					if (location) qs.location = location;

					for (const [key, value] of Object.entries(additionalFields)) {
						if (value !== '' && value !== false && value !== 0) {
							qs[key] = value;
						}
					}

					const response = await indeedApiRequest.call(this, '/jobs/search', qs);

					const hits = (response.hits ?? []) as IDataObject[];
					const executionData = this.helpers.constructExecutionMetaData(
						this.helpers.returnJsonArray(hits),
						{ itemData: { item: i } },
					);
					returnData.push(...executionData);
				}

				if (operation === 'getJobDetails') {
					const jobId = this.getNodeParameter('jobId', i) as string;
					const locality = this.getNodeParameter('locality', i) as string;

					const response = await indeedApiRequest.call(this, `/job/${jobId}`, { locality });

					const executionData = this.helpers.constructExecutionMetaData(
						this.helpers.returnJsonArray([response]),
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
