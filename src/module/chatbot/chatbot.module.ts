import { Module } from '@nestjs/common';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';
import { AiService } from '../../lib/ai/ai.service';

@Module({
  controllers: [ChatbotController],
  providers: [ChatbotService, AiService],
})
export class ChatbotModule {}

