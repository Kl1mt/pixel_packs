import { JobStatusSchema } from './api/schemas.js';
import { findEntry, writeManifest, type Manifest } from './manifest.js';
import { buildRequest, writeOutputs } from './run.js';
import type { SpecFile } from './spec.js';

/**
 * Records a job that ran outside `artgen run` (e.g. a first manual API probe) from its
 * saved GET /background-jobs response, writing its images like a normal run.
 */
export async function importJob(
  spec: SpecFile,
  jobId: string,
  rawStatus: unknown,
  manifest: Manifest,
  /** The request body that was actually sent, if it differs from what the spec builds. */
  sentBody?: Record<string, unknown>,
  manifestPath?: string,
): Promise<void> {
  const job = spec.jobs.find((j) => j.id === jobId);
  if (!job) throw new Error(`no job ${jobId} in spec ${spec.id}`);
  const id = `${spec.id}/${job.id}`;
  if (findEntry(manifest, id)) throw new Error(`${id} is already in the manifest`);
  const status = JobStatusSchema.parse(rawStatus);
  if (status.status !== 'completed') throw new Error(`job status is ${status.status}`);
  const params = sentBody ?? (await buildRequest(job)).params;
  manifest.entries.push({
    id,
    spec: spec.id,
    job: job.id,
    cardId: job.cardId,
    endpoint: job.endpoint,
    params,
    seed: job.seed,
    status: 'completed',
    backgroundJobId: status.id,
    cost: {
      generations: status.usage?.generations ?? 0,
      usd: status.last_response?.usage_cost_usd,
    },
    createdAt: status.created_at,
    outputs: await writeOutputs(
      job,
      (status.last_response?.images ?? []).map((i) => Buffer.from(i.base64, 'base64')),
    ),
  });
  await writeManifest(manifest, manifestPath);
}
