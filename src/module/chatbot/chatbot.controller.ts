import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Query,
} from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { ChatRequestDto } from './dto/chat-request.dto';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { WithKeycloakAuth } from '../auth/decorators/keycloak-auth.decorator';

@ApiTags('chatbot')
@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Post('chat')
  @WithKeycloakAuth()
  @ApiQuery({
    name: 'userId',
    required: true,
    description: 'User ID',
    type: String,
  })
  chat(
    @Body() payload: ChatRequestDto,
    @Query('userId') userId: string,
  ) {
    if (!payload.message?.trim()) {
      throw new BadRequestException('Message is required');
    }

    return this.chatbotService.chat(payload, userId);
  }
}

