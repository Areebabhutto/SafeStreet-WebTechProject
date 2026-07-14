import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AssignIncidentDto {
  @ApiProperty({ description: 'User ID of the WORKER to assign this incident to' })
  @IsUUID()
  workerId!: string;
}
