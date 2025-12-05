import {
  BadRequestException,
  Body,
  Controller,
  Post,
} from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { ChatRequestDto } from './dto/chat-request.dto';
import { ApiTags } from '@nestjs/swagger';
import { WithKeycloakAuth } from '../auth/decorators/keycloak-auth.decorator';
import { InjectKeycloakUser } from '../auth/decorators/keycloak-auth.decorator';
import { KeycloakUser } from '../auth/interfaces/keycloak-user.interface';

@ApiTags('chatbot')
@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Post('chat')
  @WithKeycloakAuth()
  chat(
    @Body() payload: ChatRequestDto,
    @InjectKeycloakUser() user: KeycloakUser,
  ) {
    if (!payload.message?.trim()) {
      throw new BadRequestException('Message is required');
    }
    return this.chatbotService.chat(payload, user.sub);
  }
}

