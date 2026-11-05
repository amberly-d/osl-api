import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthResponseDto } from './health-response.dto.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Check that the API is running' })
  @ApiOkResponse({
    description: 'The API is healthy.',
    type: HealthResponseDto,
  })
  check(): HealthResponseDto {
    return { status: 'ok' };
  }
}
