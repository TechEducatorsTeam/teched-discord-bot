import { unstable_dev } from "wrangler";
import type { UnstableDevWorker } from "wrangler";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createJobLocationHeader, jobListingGenerator } from ".";

describe("Scheduled task test", () => {
	let worker: UnstableDevWorker;

	beforeAll(async () => {
		worker = await unstable_dev("src/index.ts", {}, { disableExperimentalWarning: true });
	});

	afterAll(async () => {
		await worker.stop();
	});

	it("should parse a job and return a Location header", () => {
		expect(createJobLocationHeader("Norwich")).toBe("\n## Norwich:\n");
		expect(createJobLocationHeader("Cambridge")).toBe("\n## Cambridge:\n");
	});

	it("should parse a job and return a Location String", () => {
		const createJobListing = jobListingGenerator("https://example.com");
		expect(
			createJobListing({
				id: "airtable_record_id",
				createdTime: new Date(),
				Title: "title",
				Salary: "salary",
				Location: "location",
				LocationType: ["Hybrid"],
				Url: "url",
			})
		).toBe(":link: **title:** @ salary [Hybrid] <https://example.com/jobs/airtable_record_id>");

		expect(
			createJobListing({
				id: "airtable_record_id",
				createdTime: new Date(),
				Title: "title",
				Salary: "",
				Location: "location",
				LocationType: ["Hybrid"],
				Url: "url",
			})
		).toBe(":link: **title:** [Hybrid] <https://example.com/jobs/airtable_record_id>");
	});
});
