import type { IExecuteFunctions, IHookFunctions, IDataObject, JsonObject } from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

export async function adzunaApiRequest(
	this: IExecuteFunctions | IHookFunctions,
	method: 'GET',
	endpoint: string,
	qs: IDataObject = {},
): Promise<IDataObject> {
	const options = {
		method,
		url: `https://api.adzuna.com/v1/api${endpoint}`,
		qs,
		json: true,
	};

	try {
		return await this.helpers.requestWithAuthentication.call(this, 'adzunaApi', options);
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}
