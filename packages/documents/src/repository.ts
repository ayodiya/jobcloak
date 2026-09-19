/**
 * Persistence for application materials. A material is identified by
 * (profileId, kind, jobId, key); every generation saves a new immutable
 * MaterialVersion and bumps the material's current version/status.
 */
import { NotFoundError, ValidationError } from '@jobs-app/shared';
import { Prisma, prisma, type PrismaClient } from '@jobs-app/database';
import type {
  ApplicationMaterial,
  EvidenceSnapshot,
  MaterialVersion,
} from '@jobs-app/database';
import type { MaterialKind, VersionPayload } from './types.js';

export interface MaterialKey {
  profileId: string;
  kind: MaterialKind;
  /** Empty string means general-purpose (no job). */
  jobId: string;
  /** Empty string means non-answer materials; answers use a question digest. */
  key: string;
}

export interface MaterialWithVersion {
  material: ApplicationMaterial;
  latestVersion: MaterialVersion | null;
  snapshot: EvidenceSnapshot | null;
}

type Db = PrismaClient;

export class MaterialRepository {
  constructor(private readonly db: Db = prisma) {}

  async createSnapshot(
    profileId: string,
    spec: { hash: string; evidenceIds: string[] },
  ): Promise<EvidenceSnapshot> {
    return this.db.evidenceSnapshot.create({
      data: { profileId, hash: spec.hash, evidenceIds: spec.evidenceIds },
    });
  }

  /** Fresh snapshot rows are replaced per version: keep a material pinned to the
   *  snapshot that grounded its latest version. */
  async removeIdleSnapshots(profileId: string): Promise<void> {
    await this.db.evidenceSnapshot.deleteMany({
      where: {
        profileId,
        versions: { none: {} },
      },
    });
  }

  async findMaterial(key: MaterialKey): Promise<{ material: ApplicationMaterial; versions: MaterialVersion[] } | null> {
    const material = await this.db.applicationMaterial.findUnique({
      where: {
        profileId_kind_jobId_key: {
          profileId: key.profileId,
          kind: key.kind,
          jobId: key.jobId,
          key: key.key,
        },
      },
      include: { versions: { orderBy: { version: 'desc' } } },
    });
    if (!material) return null;
    return { material, versions: material.versions };
  }

  /** Persist a new immutable version and roll the material forward atomically. */
  async saveVersion(
    key: MaterialKey,
    payload: VersionPayload,
    now?: Date,
  ): Promise<{ material: ApplicationMaterial; version: MaterialVersion }> {
    const at = now ?? new Date();
    if (payload.content.trim().length === 0) {
      throw new ValidationError('Cannot save an empty material version');
    }

    return this.db.$transaction(async (tx) => {
      const material = await tx.applicationMaterial.upsert({
        where: {
          profileId_kind_jobId_key: {
            profileId: key.profileId,
            kind: key.kind,
            jobId: key.jobId,
            key: key.key,
          },
        },
        create: {
          profileId: key.profileId,
          kind: key.kind,
          jobId: key.jobId,
          key: key.key,
          version: 1,
          status: payload.status,
          createdAt: at,
          updatedAt: at,
        },
        update: {},
      });

      const latest = await tx.materialVersion.findFirst({
        where: { materialId: material.id },
        orderBy: { version: 'desc' },
      });
      const version = (latest?.version ?? 0) + 1;
      const stored = await tx.materialVersion.create({
        data: {
          materialId: material.id,
          version,
          content: payload.content,
          draft: (payload.draft as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          promptId: payload.promptId,
          promptVersion: payload.promptVersion,
          aiModel: payload.aiModel ?? null,
          snapshotId: payload.snapshotId ?? null,
          factuality: (payload.factuality as Prisma.InputJsonValue | null) ?? Prisma.JsonNull,
          createdAt: at,
        },
      });

      const updated = await tx.applicationMaterial.update({
        where: { id: material.id },
        data: { version, status: payload.status, updatedAt: at },
      });

      return { material: updated, version: stored };
    });
  }

  async listMaterials(
    profileId: string,
    filter: { kind?: MaterialKind } = {},
  ): Promise<MaterialWithVersion[]> {
    const rows = await this.db.applicationMaterial.findMany({
      where: { profileId, ...(filter.kind ? { kind: filter.kind } : {}) },
      orderBy: [{ kind: 'asc' }, { jobId: 'asc' }, { updatedAt: 'desc' }],
      include: {
        versions: { orderBy: { version: 'desc' }, take: 1 },
      },
    });

    return this.withSnapshots(
      rows.map((row) => ({
        material: row as unknown as ApplicationMaterial,
        latestVersion: (row.versions[0] as MaterialVersion | undefined) ?? null,
      })),
    );
  }

  async getMaterialVersion(materialId: string, version: number): Promise<MaterialVersion | null> {
    return this.db.materialVersion.findUnique({
      where: { materialId_version: { materialId, version } },
      include: { snapshot: true },
    });
  }

  private async withSnapshots(
    rows: Array<{ material: ApplicationMaterial; latestVersion: MaterialVersion | null }>,
  ): Promise<MaterialWithVersion[]> {
    const snapshotIds = rows
      .map((row) => row.latestVersion?.snapshotId)
      .filter((id): id is string => Boolean(id));
    const snapshots = await this.db.evidenceSnapshot.findMany({
      where: { id: { in: snapshotIds } },
    });
    const byId = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
    return rows.map((row) => ({
      ...row,
      snapshot: row.latestVersion?.snapshotId
        ? (byId.get(row.latestVersion.snapshotId) ?? null)
        : null,
    }));
  }

  async requireMaterialVersion(materialId: string, version: number): Promise<MaterialVersion> {
    const stored = await this.getMaterialVersion(materialId, version);
    if (!stored) throw new NotFoundError(`MaterialVersion not found: ${materialId}@${version}`);
    return stored;
  }
}