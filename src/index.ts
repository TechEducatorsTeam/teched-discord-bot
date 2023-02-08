import { isAfter, subDays } from "date-fns";
import { Job, JobBoard } from "./lib/jobs";

type Env = {
	AIRTABLE_API_TOKEN: string;
	DISCORD_API_TOKEN: string;
	DISCORD_CHANNEL: string;
	DISCORD_LOG_CHANNEL: string;
	WORKER_URL: string;
};

type Locations = Record<string, Job[]>;

export default {
	async scheduled(
		_: ScheduledEvent,
		{ AIRTABLE_API_TOKEN, DISCORD_API_TOKEN, DISCORD_CHANNEL, DISCORD_LOG_CHANNEL, WORKER_URL }: Env
	) {
		// Get Jobs List from the Provider
		const provider = new JobBoard(AIRTABLE_API_TOKEN);
		const jobs = await provider.get();

		// Filter for Jobs created in the last week
		const after = subDays(new Date(), 7);
		const latestJobs = jobs.filter(job => isAfter(job.createdTime, after));

		log(`Collected ${latestJobs.length} jobs from AirTable`);

		// Check we have any results
		if (latestJobs.length === 0) return;

		// Group the jobs in to Locations
		const locations = latestJobs.reduce((locations, job) => {
			if (!locations[job.Location]) {
				locations[job.Location] = [];
			}

			locations[job.Location].push(job);

			return locations;
		}, {} as Locations);

		// Create the message content
		const createJobListing = jobListingGenerator(WORKER_URL);
		const header = "Your weekly dose of job role goodness:";
		const post = Object.keys(locations)
			.map(Location => [
				createJobLocationHeader(Location),
				...locations[Location].map(createJobListing),
			])
			.flat();

		// Limit message to 1500 characters
		const content = [header, ...post].reduce((body, line) =>
			body.length > 1500 ? body : `${body}\n${line}`
		);

		// Send it to Discord
		const response = await discord(DISCORD_API_TOKEN, DISCORD_CHANNEL, content);
		const json = await response.json();
		const body = JSON.stringify(json);

		const status =
			response.status === 200
				? `Sent ${latestJobs.length} jobs from AirTable\n\`\`\`${JSON.stringify(body)}\`\`\``
				: `Failed to send jobs to Discord\n\`\`\`${JSON.stringify(body)}\`\`\``;

		log(status);
		await discord(DISCORD_API_TOKEN, DISCORD_LOG_CHANNEL, status);
	},
	async fetch(request: Request, { AIRTABLE_API_TOKEN }: Env) {
		if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
		if (!request.url.includes("/job/")) return new Response("Not Found", { status: 404 });

		// Get the Record ID that's been requested
		const jobRecordId = request.url.split("/").pop();

		// Get the Job from the Job List Provider
		const provider = new JobBoard(AIRTABLE_API_TOKEN);
		const jobs = await provider.get();
		const job = jobs.find(({ id }) => id === jobRecordId);

		if (!job) return new Response("Not Found", { status: 404 });

		// Redirect them to the Job's application Url
		return Response.redirect(job.Url);
	},
};

export const log = (message: string): void => console.log(message);

export const createJobLocationHeader = (Location: string): string => `\n## ${Location}:\n`;

export const jobListingGenerator =
	(WORKER_URL: string) =>
	({ id, Title, Salary, LocationType }: Job): string => {
		const LocationTypeString = LocationType.join(" | ");
		const SalaryString = Salary ? ` @ ${Salary}` : "";
		const Url = `${WORKER_URL}/jobs/${id}`;

		return `:link: **${Title}:**${SalaryString} [${LocationTypeString}] <${Url}>`;
	};

export const discord = async (token: string, channel: string, content: string): Promise<Response> =>
	await fetch(`https://discord.com/api/v10/channels/${channel}/messages`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Authorization": `Bot ${token}`,
		},
		body: JSON.stringify({
			content,
		}),
	});
