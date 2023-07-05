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
		const json: { records?: AirtableRecord[]; error: object } = await response.json();

		if (json.error || json.records === undefined) return [];

		const jobs = json.records.map(
			({ id, createdTime, fields }) =>
				({
					...fields,
					id,
					createdTime: new Date(createdTime),
				} as Job)
		);

		return jobs;
	}

	async #request() {
		const url = `${BASE_URL}/${TABLE}?sort[0][field]=Created&sort[0][direction]=desc`;

		return fetch(url, {
			headers: {
				"Content-Type": "application/json",
				"Authorization": `Bearer ${this.#apiKey}`,
			},
		});
	}
}
