import { ApiProperty } from '@nestjs/swagger';
import type { Project } from './project.entity.js';

/** What the API returns for a project. The raw entity is never returned. */
export class ProjectResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'my-open-source-project' })
  slug: string;

  @ApiProperty({ example: 'My Project' })
  name: string;

  @ApiProperty({ type: String, nullable: true })
  description: string | null;

  @ApiProperty({ type: String, nullable: true })
  logoUrl: string | null;

  @ApiProperty({
    example: 'GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO',
  })
  paymentAddress: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: string;

  static from(project: Project): ProjectResponse {
    return {
      id: project.id,
      slug: project.slug,
      name: project.name,
      description: project.description,
      logoUrl: project.logoUrl,
      paymentAddress: project.paymentAddress,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }
}
