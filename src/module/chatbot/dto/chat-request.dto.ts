import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ChatRequestDto {
  @ApiProperty()
  @IsString()
  message!: string;
}

