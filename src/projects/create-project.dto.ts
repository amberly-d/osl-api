import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
} from 'class-validator';
import { IsSlug, IsStellarPublicKey } from './validators.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateProjectDto {
  @ApiProperty({
    description:
      'Public URL name: 3-40 lowercase letters, digits or hyphens, starting and ending with a letter or digit. Reserved words are rejected.',
    example: 'my-open-source-project',
  })
  @IsSlug()
  slug: string;

  @ApiProperty({
    description: '1-80 characters after trimming.',
    example: 'My Project',
  })
  @Transform(trim)
  @IsString()
  @Length(1, 80)
  name: string;

  @ApiPropertyOptional({ description: 'Up to 1000 characters.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({
    description: 'https:// URL of a logo.',
    example: 'https://example.com/logo.png',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @IsUrl(
    { protocols: ['https'], require_protocol: true, disallow_auth: true },
    { message: 'logoUrl must be an https:// URL.' },
  )
  logoUrl?: string;

  @ApiProperty({
    description: 'Stellar public key (G...) that receives support.',
    example: 'GCALNQQBXAPZ2WIRSDDBMSTAKCUH5SG6U76YBFLQLIXJTF7FE5AX7AOO',
  })
  @IsStellarPublicKey()
  paymentAddress: string;
}
