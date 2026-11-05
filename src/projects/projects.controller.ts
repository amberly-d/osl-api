import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CreateProjectDto } from './create-project.dto.js';
import { ProjectResponse } from './project-response.dto.js';
import { ProjectsService } from './projects.service.js';

@ApiTags('projects')
@Controller('projects')
export class ProjectsController {
  constructor(
    @Inject(ProjectsService) private readonly projects: ProjectsService,
  ) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({
    summary: 'Create a project',
    description:
      'Unauthenticated for now: do not expose this endpoint publicly before owner authentication exists.',
  })
  @ApiCreatedResponse({ type: ProjectResponse })
  @ApiBadRequestResponse({ description: 'Invalid or unknown fields.' })
  @ApiConflictResponse({ description: 'The slug is already taken.' })
  async create(@Body() dto: CreateProjectDto): Promise<ProjectResponse> {
    return ProjectResponse.from(await this.projects.create(dto));
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get a project by slug' })
  @ApiOkResponse({ type: ProjectResponse })
  @ApiNotFoundResponse({ description: 'No project has this slug.' })
  async findOne(@Param('slug') slug: string): Promise<ProjectResponse> {
    return ProjectResponse.from(await this.projects.findBySlug(slug));
  }
}
