import { ApiProperty } from '@nestjs/swagger';
import { IsLatitude, IsLongitude, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateIncidentDto {
  @ApiProperty({ example: 'Large pothole on Main St' })
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  title!: string;

  @ApiProperty({ example: 'A deep pothole has formed near the intersection, causing cars to swerve.' })
  @IsString()
  @MinLength(10)
  description!: string;

  @ApiProperty({ example: 37.7749 })
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ example: -122.4194 })
  @IsLongitude()
  longitude!: number;

  @ApiProperty({ required: false, example: '123 Main St, Springfield' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({
    required: false,
    description: 'Optional Base64 data URL or hosted image URL (mock storage for this project)',
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiProperty({
    required: false,
    description:
      'Set true when the citizen has confirmed submission despite a "possible duplicate" warning',
    default: false,
  })
  @IsOptional()
  confirmedNotDuplicate?: boolean;
}
