const BASE_URL = "https://api.airtable.com/v0/appgLXjsOyliS6ndz";
const TABLE = "Jobs";

type AirtableRecord = {
	id: string;
	createdTime: string;
	fields: object;
};

export type Job = {
	id: string;
	createdTime: Date;
	Title: string;
	Salary: string;
	Location: string;
	LocationType: LocationType[];
	Url: string;
};

type LocationType = "Hybrid" | "Remote" | "On Site";

export class JobBoard {
	#apiKey;

	constructor(apiKey: string) {
		this.#apiKey = apiKey;
	}

	async get(): Promise<Job[]> {
		const response = await this.#request();
		const json: { records: AirtableRecord[] } = await response.json();

		const jobs = json.records.map(({ id, createdTime, fields }) => ({
			...fields,
			id,
			createdTime: new Date(createdTime),
		}));

		return jobs;
	}

	async #request() {
		const url = `${BASE_URL}/${TABLE}`;

		return fetch(url, {
			headers: {
				"Content-Type": "application/json",
				"Authorization": `Bearer ${this.#apiKey}`,
			},
		});
	}
}
