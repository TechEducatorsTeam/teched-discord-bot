import { isAfter, subDays } from "date-fns";
import { Job, JobBoard } from "./lib/jobs";

type Env = {
	AIRTABLE_API_TOKEN: string;
	DISCORD_API_TOKEN: string;
	DISCORD_CHANNEL: string;
};

type Locations = Record<string, Job[]>;

export default {
	async scheduled(
		event: ScheduledEvent,
		{ AIRTABLE_API_TOKEN, DISCORD_API_TOKEN, DISCORD_CHANNEL }: Env,
		ctx: ExecutionContext
	) {
		// Get Jobs List from the Provider
		const provider = new JobBoard(AIRTABLE_API_TOKEN);
		const jobs = await provider.get();

		// Filter for Jobs created in the last week
		const after = subDays(new Date(), 7);
		const latestJobs = jobs.filter(job => isAfter(job.createdTime, after));

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
		const header = "Your weekly dose of job role goodness:";
		const body = Object.keys(locations)
			.map(Location => [
				createJobLocationHeader(Location),
				...locations[Location].map(createJobListing),
			])
			.flat();
		const content = [header, ...body].join("\n");

		// Send it to Discord
		await fetch(`https://discord.com/api/v10/channels/${DISCORD_CHANNEL}/messages`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Authorization": `Bot ${DISCORD_API_TOKEN}`,
			},
			body: JSON.stringify({
				content,
			}),
		});
	},
};

const createJobLocationHeader = (Location: string): string => `\n## ${Location}:\n`;

const createJobListing = ({ Title, Salary, LocationType, Url }: Job): string => {
	const LocationTypeString = LocationType.join(" | ");

	return `:link: **${Title}:** @ ${Salary} [${LocationTypeString}] <${Url}>`;
};
