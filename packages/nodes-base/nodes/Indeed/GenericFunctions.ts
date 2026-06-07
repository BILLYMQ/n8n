import type { IExecuteFunctions, IDataObject, JsonObject, IRequestOptions } from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

const BASE_URL = 'https://indeed12.p.rapidapi.com';

export async function indeedApiRequest(
	this: IExecuteFunctions,
	endpoint: string,
	qs: IDataObject = {},
): Promise<IDataObject> {
	const options: IRequestOptions = {
		method: 'GET',
		url: `${BASE_URL}${endpoint}`,
		qs,
		json: true,
	};

	try {
		return await this.helpers.requestWithAuthentication.call(this, 'indeedApi', options);
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}
