import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class DraftResolutionDto {
  @ApiProperty({ example: 'Filled the pothole with asphalt and compacted the surface.' })
  @IsString()
  @MinLength(5)
  resolutionNotes!: string;
}
