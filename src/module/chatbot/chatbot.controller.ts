import {
  BadRequestException,
  Body,
  Controller,
  Post,
} from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { ChatRequestDto } from './dto/chat-request.dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('chatbot')
@Controller('chatbot')
export class ChatbotController {
  constructor(private readonly chatbotService: ChatbotService) {}

  @Post('chat')
  chat(@Body() payload: ChatRequestDto) {
    if (!payload.message?.trim()) {
      throw new BadRequestException('Message is required');
    }
    return this.chatbotService.chat(payload);
  }
}

