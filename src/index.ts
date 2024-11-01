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

		// Filter for Jobs created in the last day (-24h)
		const after = subDays(new Date(), 1);
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
		const messages = Object.keys(locations)
			.map(
				Location =>
					createJobLocationHeader(Location) + locations[Location].map(createJobListing).join("\n")
			)
			.reduce(
				(messages, location) => {
					if (messages[messages.length - 1].length + location.length > 1500) {
						messages.push("");
					}

					messages[messages.length - 1] = messages[messages.length - 1] + location;

					return messages;
				},
				[""]
			);

		// Send it to Discord
		const responses = await Promise.all(
			messages.map(message => discord(DISCORD_API_TOKEN, DISCORD_CHANNEL, message))
		);

		const status = responses.every(res => res.status === 200)
			? `Sent ${latestJobs.length} jobs from AirTable to <#${DISCORD_CHANNEL}>`
			: "Failed to send jobs to Discord";

		await discord(DISCORD_API_TOKEN, DISCORD_LOG_CHANNEL, `[teched-job-discord-bot] ${status}`);
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
		const LocationTypeString = LocationType ? LocationType.join(" | ") : "Unknown";
		const SalaryString = Salary ? ` @ ${Salary}` : "";
		const Url = `${WORKER_URL}/job/${id}`;

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
