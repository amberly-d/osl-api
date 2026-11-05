import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import type { CreateProjectDto } from './create-project.dto.js';
import { Project } from './project.entity.js';

/** Postgres error code for a unique constraint violation. */
const UNIQUE_VIOLATION = '23505';

@Injectable()
export class ProjectsService {
  // Explicit @InjectRepository: Vitest does not emit decorator metadata, so
  // injection by constructor type would not resolve in tests.
  constructor(
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
  ) {}

  async create(dto: CreateProjectDto): Promise<Project> {
    try {
      return await this.projects.save(
        this.projects.create({
          slug: dto.slug,
          name: dto.name,
          description: dto.description ?? null,
          logoUrl: dto.logoUrl ?? null,
          paymentAddress: dto.paymentAddress,
        }),
      );
    } catch (error) {
      // Rely on the unique index rather than a read-then-write check, which
      // would race under concurrent requests.
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string }).code === UNIQUE_VIOLATION
      ) {
        throw new ConflictException(
          `A project with slug "${dto.slug}" already exists.`,
        );
      }
      throw error;
    }
  }

  async findBySlug(slug: string): Promise<Project> {
    const project = await this.projects.findOneBy({ slug });
    if (!project) {
      throw new NotFoundException(`Project "${slug}" was not found.`);
    }
    return project;
  }
}
