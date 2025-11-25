import { Injectable } from '@nestjs/common';
import { AiService } from '../../lib/ai/ai.service';
import { ChatRequestDto } from './dto/chat-request.dto';

@Injectable()
export class ChatbotService {
  constructor(private readonly aiService: AiService) {}

  async chat(request: ChatRequestDto) {
    return this.aiService.chat(request.message);
  }
}

