import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({
    description: 'The API is running and can serve requests.',
    example: 'ok',
  })
  status: string;
}
