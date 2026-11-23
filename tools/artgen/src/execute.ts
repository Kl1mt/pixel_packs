import type { PixelLabClient } from './api/client.js';
import {
  JobCreatedSchema,
  PixfluxResponseSchema,
  UiAssetCreatedSchema,
  UiAssetDetailSchema,
  type JobStatus,
} from './api/schemas.js';
import type { AnyBody } from './build.js';
import { jobCost } from './build.js';
import type { JobSpec } from './spec.js';

/** One finished call: every file it produced, plus what the manifest records. */
export interface ExecResult {
  status: 'completed' | 'failed';
  backgroundJobId?: string | undefined;
  generations: number;
  usd?: number | undefined;
  /** PNG candidates, in PixelLab's order. */
  images: Buffer[];
  /** Other files (e.g. `font.ttf`), written next to the candidates. */
  files: { name: string; data: Buffer }[];
  /** Ids needed by later steps (e.g. `uiAssetId` for `ui-split`). */
  extra: Record<string, unknown>;
  error?: string | undefined;
}

function charged(status: JobStatus, job: JobSpec): number {
  return status.usage?.generations ?? (status.status === 'completed' ? jobCost(job) : 0);
}

function failed(status: JobStatus, jobId: string, job: JobSpec): ExecResult {
  return {
    status: 'failed',
    backgroundJobId: jobId,
    generations: charged(status, job),
    images: [],
    files: [],
    extra: {},
    error: JSON.stringify(status.last_response?.error ?? 'failed').slice(0, 500),
  };
}

/** Waits until a UI asset's PNG exists (its detail can trail the background job briefly). */
async function uiAssetImage(client: PixelLabClient, id: string) {
  for (let i = 0; ; i++) {
    const detail = await client.get(`/ui-assets/${id}`, UiAssetDetailSchema);
    if (detail.image_url) return { detail, png: await client.download(detail.image_url) };
    if (i >= 10) throw new Error(`UI asset ${id} has no image_url`);
    await new Promise((r) => setTimeout(r, 5000));
  }
}

export async function execute(
  client: PixelLabClient,
  job: JobSpec,
  body: AnyBody,
): Promise<ExecResult> {
  const path = `/${job.endpoint}`;

  if (job.endpoint === 'create-image-pixflux') {
    // Synchronous: the image comes back in the response.
    const res = await client.post(path, PixfluxResponseSchema, body);
    return {
      status: 'completed',
      generations: res.usage?.generations ?? jobCost(job),
      usd: res.usage?.usd ?? undefined,
      images: [Buffer.from(res.image.base64, 'base64')],
      files: [],
      extra: {},
    };
  }

  if (job.endpoint === 'create-ui-asset') {
    const created = await client.post(path, UiAssetCreatedSchema, body);
    const status = await client.waitForJob(created.background_job_id);
    if (status.status !== 'completed') return failed(status, created.background_job_id, job);
    const { detail, png } = await uiAssetImage(client, created.ui_asset_id);
    return {
      status: 'completed',
      backgroundJobId: created.background_job_id,
      generations: charged(status, job),
      usd: status.last_response?.usage_cost_usd,
      images: [png],
      files: [],
      extra: { uiAssetId: created.ui_asset_id, nineSlice: detail.nine_slice ?? null },
    };
  }

  const created = await client.post(path, JobCreatedSchema, body);
  const jobId = created.background_job_id;
  const status = await client.waitForJob(jobId);
  if (status.status !== 'completed') return failed(status, jobId, job);
  const last = status.last_response;
  const result: ExecResult = {
    status: 'completed',
    backgroundJobId: jobId,
    generations: charged(status, job),
    usd: last?.usage_cost_usd,
    images: (last?.images ?? []).map((img) => Buffer.from(img.base64, 'base64')),
    files: [],
    extra: {},
  };

  if (job.endpoint === 'generate-font-pro' && last?.ttf_base64) {
    result.files.push({ name: 'font.ttf', data: Buffer.from(last.ttf_base64, 'base64') });
  }
  if (result.images.length === 0 && last?.image_url) {
    result.images.push(await client.download(last.image_url));
  }
  if (job.endpoint === 'ui-assets/states') {
    const ids = last?.created_state_ids ?? [];
    const states: { id: string; name: string | null | undefined }[] = [];
    for (const id of ids) {
      const { detail, png } = await uiAssetImage(client, id);
      result.images.push(png);
      states.push({ id, name: detail.name });
    }
    result.extra = { states };
  }
  return result;
}
